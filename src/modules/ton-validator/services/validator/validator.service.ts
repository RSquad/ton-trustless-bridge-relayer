import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ethers } from 'ethers';
import {
  BlockParser,
  Bridge,
  TransactionParser,
  TreeOfCellsParser,
  Validator,
} from 'src/contracts/typechain';
import {
  ProvenState,
  PSProofValidators,
  PSSetValidators,
  PSTransaction,
} from 'src/lib/steps';
import { ProviderService } from 'src/modules/eth-provider/services/provider/provider.service';
import { TonBlock } from 'src/modules/ton-explorer/entities/block.entity';
import { KeyBlockSaved } from 'src/modules/ton-explorer/events/key-block-saved.event';
import {
  parseMcBlockRocks,
  parseShardBlockRocks,
} from 'src/modules/ton-explorer/utils';
import { TonClient4 } from 'ton';
import ValidatorAbi from '../../../../contracts/contracts/Validator.sol/Validator.json';
import BridgeAbi from '../../../../contracts/contracts/Bridge.sol/Bridge.json';
import TransactionParserAbi from '../../../../contracts/contracts/parser/TransactionParser.sol/TransactionParser.json';
import BlockParserAbi from '../../../../contracts/contracts/parser/BlockParser.sol/BlockParser.json';
import TOCParserAbi from '../../../../contracts/contracts/parser/TreeOfCellsParser.sol/TreeOfCellsParser.json';
import { MoreThan, Repository } from 'typeorm';
import {
  BlockIdExt,
  CFriendlyAddressString,
  InternalTransactionId,
} from 'src/lib/ton-types';
import axios from 'axios';
import _ from 'lodash';
import { TonTransaction } from 'src/modules/ton-explorer/entities/transaction.entity';
import { concatMap, from, Subject } from 'rxjs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import TonRocks from '../../../../lib/ton-rocks-js';

const toncenterUrl = 'https://testnet.toncenter.com/api/v2/';

function sleep() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(undefined);
    }, 1000);
  });
}

interface Signature {
  node_id_short: string;
  signature: string;
}

@Injectable()
export class ValidatorService {
  validatorContract: Validator = new ethers.Contract(
    this.configService.get<string>('VALIDATOR_ADDR'),
    ValidatorAbi.abi,
    this.providerService.signer,
  ) as any;

  bridgeContract: Bridge = new ethers.Contract(
    this.configService.get<string>('BRIDGE_ADDR'),
    BridgeAbi.abi,
    this.providerService.signer,
  ) as any;

  transactionParserContract: TransactionParser = new ethers.Contract(
    this.configService.get<string>('TRANSACTION_PARSER_ADDR'),
    TransactionParserAbi.abi,
    this.providerService.signer,
  ) as any;

  blockParserContract: BlockParser = new ethers.Contract(
    this.configService.get<string>('BLOCK_PARSER_ADDR'),
    BlockParserAbi.abi,
    this.providerService.signer,
  ) as any;

  tocParserContract: TreeOfCellsParser = new ethers.Contract(
    this.configService.get<string>('TOC_PARSER_ADDR'),
    TOCParserAbi.abi,
    this.providerService.signer,
  ) as any;

  tonClient4 = new TonClient4({
    endpoint: 'https://testnet-v4.tonhubapi.com',
  });

  keyblocksBuffer = new Subject<KeyBlockSaved>();

  nonce = 0;

  constructor(
    private providerService: ProviderService,
    private configService: ConfigService,
    @InjectRepository(TonBlock)
    private blocksRepository: Repository<TonBlock>,
    @InjectRepository(TonTransaction)
    private transactionsRepository: Repository<TonTransaction>,
  ) {
    this.keyblocksBuffer
      .pipe(
        concatMap((data) => {
          return from(this.handleKeyBlockSavedEvent2(data));
        }),
      )
      .subscribe();

    this.providerService.provider
      .getTransactionCount(this.configService.get<string>('VALIDATOR_ADDR'))
      .then((nonce) => {
        this.nonce = nonce;
      });
  }

  @OnEvent('keyblock.saved')
  handleKeyBlockSavedEvent(data: KeyBlockSaved) {
    console.log('keyblock saved cached');
    this.keyblocksBuffer.next(data);
  }

  async handleKeyBlockSavedEvent2(data: KeyBlockSaved) {
    console.log(
      'check keyblock',
      data.data.seqno,
      data.data.workchain,
      data.data.rootHash,
    );
    if (await this.checkIfBlockValidated(data)) {
      console.log('key block already checked');
      await this.blocksRepository.update(
        { id: data.data.id },
        { checked: true },
      );
      return;
    }
    const needInit = await this.checkInitValidatorsNeeded();
    if (needInit) {
      console.log('start init validators');
      await this.initValidators(data);
      console.log('end init validators');
    } else {
      console.log('start update validators');
      await this.updateValidators(data);
      console.log('end update validators');
    }
  }

  async checkInitValidatorsNeeded() {
    const validators = await this.validatorContract.getValidators();
    const nonEmptyValidators = validators.filter(
      (v) =>
        v.pubkey !==
        '0x0000000000000000000000000000000000000000000000000000000000000000',
    );

    if (nonEmptyValidators.length) {
      return false;
    }
    return true;
  }

  async checkIfBlockValidated(data: KeyBlockSaved) {
    const rootHash = Buffer.from(data.data.rootHash, 'base64');
    return await this.validatorContract.isVerifiedBlock(rootHash);
  }

  async initValidators(data: KeyBlockSaved) {
    const blockData = await parseMcBlockRocks(data.data.seqno, this.tonClient4);

    // console.log('True root hash', blockData.id.root_hash);
    // console.log('parts:', await PSSetValidators.fromBlock(blockData.data));
    const proven = new ProvenState();
    await proven.add(await PSSetValidators.fromBlock(blockData.data));

    const jsonData = proven.toJSON();
    console.log('how works');
    console.log(jsonData);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const bocs: string[] = jsonData.find((el) => el.type === 'set-validators')!
      .boc as string[];

    const boc = Buffer.from(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      bocs[0],
      'hex',
    );

    await this.validatorContract.parseCandidatesRootBlock(boc);
    if (bocs.length > 1) {
      for (let i = 1; i < bocs.length; i++) {
        await this.validatorContract.parsePartValidators(bocs[i]);
      }
    }
    await this.validatorContract.initValidators();
    await this.blocksRepository.update({ id: data.data.id }, { checked: true });
  }

  async updateValidators(data: KeyBlockSaved) {
    const blockData = await parseMcBlockRocks(data.data.seqno, this.tonClient4);

    // cannot get from ton client
    const signaturesRes: Signature[] = (
      await axios.get(
        `${toncenterUrl}getMasterchainBlockSignatures?seqno=${blockData.id.seqno}`,
      )
    ).data.result.signatures;

    const proven = new ProvenState();
    await proven.add(
      await PSProofValidators.fromBlock(
        BlockIdExt.fromJSON(blockData.id),
        blockData.data,
        _.map(signaturesRes, (el) => ({
          node_id: Buffer.from(el.node_id_short, 'base64').toString('hex'),
          r: Buffer.from(el.signature, 'base64').slice(0, 32).toString('hex'),
          s: Buffer.from(el.signature, 'base64').slice(32).toString('hex'),
        })),
      ),
    );

    const jsonData = proven.toJSON() as any;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const bocs: string[] = jsonData.find(
      (el) => el.type === 'proof-validators',
    )!.boc;

    const boc = Buffer.from(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      bocs[0],
      'hex',
    );

    // console.log(
    //   'filehash',
    //   Buffer.from(
    //     jsonData.find((el) => el.type === 'proof-validators')!.id!.fileHash,

    //   ).toString('hex'),
    //   blockData.id.file_hash,
    // );

    await this.validatorContract.parseCandidatesRootBlock(boc);
    if (bocs.length > 1) {
      for (let i = 1; i < bocs.length; i++) {
        await this.validatorContract.parsePartValidators(bocs[i]);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const signatures = jsonData.find((el) => el.type === 'proof-validators')!
      .signatures!;

    for (let i = 0; i < signatures.length; i += 20) {
      const subArr = signatures.slice(i, i + 20);
      while (subArr.length < 20) {
        subArr.push(signatures[0]);
      }

      await this.validatorContract.verifyValidators(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        // `0x${Buffer.from(
        //   // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        //   jsonData.find((el) => el.type === 'proof-validators')!.id!.fileHash,
        //   'base64',
        // ).toString('hex')}`,
        `0x${blockData.id.file_hash}`,
        subArr.map((c) => ({
          node_id: `0x${c.node_id}`,
          r: `0x${c.r}`,
          s: `0x${c.s}`,
        })) as any[20],
      );
    }
    await this.validatorContract.setValidatorSet();
    await this.blocksRepository.update({ id: data.data.id }, { checked: true });
  }

  async validateMcBlockByValidator(seqno: number) {
    const blockData = await parseMcBlockRocks(seqno, this.tonClient4);
    const isVerified = await this.validatorContract.isVerifiedBlock(
      '0x' + blockData.id.root_hash,
    );
    if (isVerified) {
      return await this.blocksRepository.update(
        { seqno: blockData.id.seqno, workchain: -1 },
        { checked: true },
      );
    }
    console.log('start validate block', blockData.id.root_hash);

    // cannot get from ton client
    const signaturesRes: Signature[] = (
      await axios.get(
        `${toncenterUrl}getMasterchainBlockSignatures?seqno=${blockData.id.seqno}`,
      )
    ).data.result.signatures;

    const signatures = signaturesRes.map((el) => ({
      node_id: Buffer.from(el.node_id_short, 'base64').toString('hex'),
      r: Buffer.from(el.signature, 'base64').slice(0, 32).toString('hex'),
      s: Buffer.from(el.signature, 'base64').slice(32).toString('hex'),
    }));

    for (let i = 0; i < signatures.length; i += 20) {
      const subArr = signatures.slice(i, i + 20);
      while (subArr.length < 20) {
        subArr.push(signatures[0]);
      }

      console.log(blockData.id);
      await this.validatorContract.verifyValidators(
        '0x' + blockData.id.root_hash,
        `0x${blockData.id.file_hash}`,
        subArr.map((c) => ({
          node_id: `0x${c.node_id}`,
          r: `0x${c.r}`,
          s: `0x${c.s}`,
        })) as any[20],
      );
    }
    console.log('verifyValidators ended successfully', blockData.id.root_hash);
    await this.validatorContract.addCurrentBlockToVerifiedSet(
      '0x' + blockData.id.root_hash,
    );

    return await this.blocksRepository.update(
      { seqno: blockData.id.seqno, workchain: -1 },
      { checked: true },
    );
  }

  async validateTransaction(transaction: TonTransaction) {
    const dbTx = await this.transactionsRepository.findOne({
      where: {
        ...transaction,
      },
      relations: { mcParent: { mcParent: true } },
    });

    const block =
      dbTx.mcParent.workchain === -1
        ? await parseMcBlockRocks(dbTx.mcParent.seqno, this.tonClient4)
        : await parseShardBlockRocks(
            dbTx.mcParent.seqno,
            dbTx.mcParent.mcParent.seqno,
            this.tonClient4,
          );
    const proven = new ProvenState();
    await proven.add(
      await PSTransaction.fromBlock(
        block.data,
        InternalTransactionId.fromJSON({
          lt: dbTx.lt,
          hash: dbTx.hash,
        }),
        CFriendlyAddressString.from(dbTx.account).asAddress(),
      ),
    );

    const jsonData = proven.toJSON() as any;

    const boc = Buffer.from(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      jsonData.find((el) => el.type === 'tx-proof')!.boc as any,
      'hex',
    );

    const txBoc = Buffer.from(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      jsonData.find((el) => el.type === 'tx-proof')!.txBoc! as any,
      'hex',
    );

    // await this.bridgeContract.readTransaction(
    //   txBoc,
    //   boc,
    //   '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    // );

    return {
      txBoc: txBoc.toString('hex'),
      boc: boc.toString('hex'),
      adapter: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    };

    // return await this.transactionsRepository.update(
    //   { id: dbTx.id },
    //   { checked: true },
    // );
  }

  async validateShardBlock(blockDbId: number) {
    const dbShardBlock = await this.blocksRepository.findOne({
      where: {
        id: blockDbId,
      },
      relations: ['mcParent'],
    });

    const shardIsVerified = await this.validatorContract.isVerifiedBlock(
      Buffer.from(dbShardBlock.rootHash, 'base64'),
    );

    if (shardIsVerified) {
      return await this.blocksRepository.update(
        {
          id: dbShardBlock.id,
          seqno: dbShardBlock.seqno,
          workchain: dbShardBlock.workchain,
        },
        { checked: true },
      );
    }

    const shardProofRes = (
      await axios.get(
        toncenterUrl +
          `getShardBlockProof?workchain=${dbShardBlock.workchain}&shard=${dbShardBlock.shard}&seqno=${dbShardBlock.seqno}&from_seqno=${dbShardBlock.mcParent.seqno}`,
      )
    ).data.result;

    console.log(shardProofRes.links);

    const bocProof = shardProofRes.links.find(
      (l) => l.id.seqno === dbShardBlock.seqno,
    )?.proof;

    if (!bocProof) {
      throw Error('wrong proof');
    }

    const isVerified = await this.validatorContract.isVerifiedBlock(
      Buffer.from(dbShardBlock.mcParent.rootHash, 'base64'),
    );

    if (!isVerified) {
      await sleep();
      await this.validateMcBlockByValidator(dbShardBlock.mcParent.seqno);
    }

    console.log('hsard proof boc:', bocProof);
    console.log(
      'fixed proof boc:',
      Buffer.from(bocProof, 'base64').toString('hex'),
    );

    const mcBlockCell = await TonRocks.types.Cell.fromBoc(
      Buffer.from(bocProof, 'base64').toString('hex'),
    );

    console.log('hash check block: ==============');
    console.log(
      mcBlockCell[0].refs[0].hashes.map((h) =>
        Buffer.from(h).toString('base64'),
      ),
    );

    await this.validatorContract.parseShardProofPath(
      Buffer.from(bocProof, 'base64'),
    );

    return await this.blocksRepository.update(
      {
        id: dbShardBlock.id,
        seqno: dbShardBlock.seqno,
        workchain: dbShardBlock.workchain,
      },
      { checked: true },
    );
  }

  async validateMCBlockByState(blockDbId: number) {
    const dbBlock = await this.blocksRepository.findOne({
      where: {
        id: blockDbId,
      },
    });

    const nextBlock = await this.blocksRepository.findOne({
      where: {
        workchain: -1,
        seqno: MoreThan(dbBlock.seqno),
      },
    });

    if (!nextBlock) {
      throw Error('no validated future block');
    }

    const mc_proof = (
      await axios.get(
        toncenterUrl +
          `getShardBlockProof?workchain=${
            nextBlock.workchain
          }&shard=${+nextBlock.shard}&seqno=${nextBlock.seqno}&from_seqno=${
            nextBlock.seqno
          }`,
      )
    ).data.result.mc_proof[0];

    await this.validatorContract.readStateProof(
      Buffer.from(mc_proof.state_proof, 'base64'),
      Buffer.from(nextBlock.rootHash, 'base64'),
    );

    return await this.blocksRepository.update(
      {
        id: dbBlock.id,
        seqno: dbBlock.seqno,
        workchain: dbBlock.workchain,
      },
      { checked: true },
    );
  }
}
