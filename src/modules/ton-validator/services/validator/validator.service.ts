import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { concatMap, of, Subject } from 'rxjs';
import { GotKeyblock } from '../../../../events/got-keyblock.event.js';
import {
  ProvenState,
  PSProofValidators,
  PSSetValidators,
  PSTransaction,
} from '../../../../lib/steps/index.js';
import {
  BlockIdExt,
  CFriendlyAddressString,
  InternalTransactionId,
} from '../../../../lib/ton-types/index.js';
import { ContractService } from '../../../../modules/eth-provider/services/contract/contract.service.js';
import { ProviderService } from '../../../../modules/eth-provider/services/provider/provider.service.js';
import { LoggerService } from '../../../../modules/logger/services/logger/logger.service.js';
import { TonBlockService } from '../../../../modules/prisma/services/ton-block/ton-block.service.js';
import { TonTransactionService } from '../../../../modules/prisma/services/ton-transaction/ton-transaction.service.js';
import { TonApiService } from '../../../../modules/ton-reader/services/ton-api/ton-api.service.js';
import createLock from '../../utils/SimpleLock.js';
import _ from 'lodash';
import { TonTransaction } from '@prisma/client';
import { ethers } from 'ethers';

@Injectable()
export class ValidatorService {
  nonce = 0;
  validatorLock = createLock('validator');

  keyblockBuffer = new Subject<GotKeyblock>();
  isInitialKeyblock = true;

  constructor(
    private providerService: ProviderService,
    private configService: ConfigService,
    private tonBlockService: TonBlockService,
    private tonTransactionService: TonTransactionService,
    private contractService: ContractService,
    private tonApi: TonApiService,
    private logger: LoggerService,
  ) {
    this.keyblockBuffer
      .pipe(concatMap((data) => this.handleKeyblock(data)))
      .subscribe((res) => {
        console.log('validating ending:', res);
      });
  }

  @OnEvent('keyblock.new')
  gotKeyblock(data: GotKeyblock) {
    this.keyblockBuffer.next(data);
  }

  async handleKeyblock(data: GotKeyblock) {
    this.logger.validatorLog('[Validator] got keyblock:', data.block.seqno);
    await this.tonBlockService.updateTonBlockStatus({
      blockId: data.prismaBlock.id,
      inprogress: true,
    });

    const isVerified = await this.syncVerifying(
      data.block.rootHash,
      data.prismaBlock.id,
    );

    if (isVerified) {
      this.logger.validatorLog(
        '[Validator] keyblock is veryfied:',
        data.block.seqno,
      );
      return false;
    }

    this.logger.validatorLog(
      '[Validator] keyblock verifying...:',
      data.block.seqno,
    );

    if (this.isInitialKeyblock || (await this.checkInitValidatorsNeeded())) {
      await this.initValidators(data);
    } else {
      // await this.initValidators(data);
      await this.updateValidators(data);
    }
    this.isInitialKeyblock = false;

    await this.tonBlockService.updateTonBlockStatus({
      blockId: data.prismaBlock.id,
      inprogress: false,
      checked: true,
    });

    this.logger.validatorLog(
      '[Validator] keyblock verifying complete:',
      data.block.seqno,
    );

    return false;
  }

  async isBlockVerified(rootHash: string) {
    const hash = Buffer.from(rootHash, 'hex');
    console.log(hash.toString('hex'));
    return await this.contractService.validatorContract.isVerifiedBlock(hash);
    // return true;
  }

  async syncVerifying(rootHash: string, prismaId: number) {
    const isVerified = await this.isBlockVerified(rootHash);

    await this.tonBlockService.updateTonBlockStatus({
      blockId: prismaId,
      checked: isVerified,
    });

    return isVerified;
  }

  async checkInitValidatorsNeeded() {
    const validators =
      await this.contractService.validatorContract.getValidators();
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

  async initValidators(data: GotKeyblock) {
    const proven = new ProvenState();
    await proven.add(await PSSetValidators.fromBlock(data.boc.data));
    const jsonData = proven.toJSON();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const bocs: string[] = jsonData.find((el) => el.type === 'set-validators')!
      .boc as string[];

    const boc = Buffer.from(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      bocs[0],
      'hex',
    );

    try {
      await this.validatorLock.acquire();
      console.log('start parseCandidatesRootBlock');

      await this.contractService.validatorContract
        .parseCandidatesRootBlock(boc, {
          maxFeePerGas: ethers.parseUnits('6', 'gwei'),
          // gasPrice: ethers.parseUnits('0.002', 'gwei'),
        })
        .then((tx) => (tx as any).wait());

      if (bocs.length > 1) {
        for (let i = 1; i < bocs.length; i++) {
          console.log('start parsePartValidators');
          await this.contractService.validatorContract
            .parsePartValidators(bocs[i], {

              maxFeePerGas: ethers.parseUnits('6', 'gwei'),
              // gasPrice: ethers.parseUnits('0.2', 'gwei'),
            })
            .then((tx) => (tx as any).wait());
        }
      }
      console.log('start initValidators');
      await this.contractService.validatorContract
        .initValidators({
          gasPrice: ethers.parseUnits('0.002', 'gwei'),
        })
        .then((tx) => (tx as any).wait());
    } catch (error) {
      console.error(error?.info);
    } finally {
      this.validatorLock.release();
    }
  }

  async updateValidators(data: GotKeyblock) {
    const signatures = await this.tonApi.getSignatures(data.block.seqno);

    const proven = new ProvenState();
    await proven.add(
      await PSProofValidators.fromBlock(
        BlockIdExt.fromJSON(data.boc.id),
        data.boc.data,
        _.map(signatures, (el) => ({
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

    try {
      await this.validatorLock.acquire();

      await this.contractService.validatorContract
        .parseCandidatesRootBlock(boc, {
          gasPrice: ethers.parseUnits('0.002', 'gwei'),
        })
        .then((tx) => (tx as any).wait());
      if (bocs.length > 1) {
        for (let i = 1; i < bocs.length; i++) {
          await this.contractService.validatorContract
            .parsePartValidators(bocs[i], {
              gasPrice: ethers.parseUnits('0.002', 'gwei'),
            })
            .then((tx) => (tx as any).wait());
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const signatures = jsonData.find((el) => el.type === 'proof-validators')!
        .signatures!;

      for (let i = 0; i < signatures.length; i += 5) {
        const subArr = signatures.slice(i, i + 5);
        while (subArr.length < 5) {
          subArr.push(signatures[0]);
        }

        await this.contractService.validatorContract
          .verifyValidators(
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            `0x${data.boc.id.file_hash}`,
            subArr.map((c) => ({
              node_id: `0x${c.node_id}`,
              r: `0x${c.r}`,
              s: `0x${c.s}`,
            })) as any[5],
            {
              gasPrice: ethers.parseUnits('0.002', 'gwei'),
            },
          )
          .then((tx) => (tx as any).wait());
      }
      await this.contractService.validatorContract
        .setValidatorSet({
          gasPrice: ethers.parseUnits('0.002', 'gwei'),
        })
        .then((tx) => (tx as any).wait());
    } catch (error) {
      console.error(error.message);
    } finally {
      this.validatorLock.release();
    }
  }

  async validateMcBlockByValidator(id: number) {
    try {
      await this.validateMCBlockByState(id);
    } catch (error) {
      console.log(error);
    }

    const prismaBlock = await this.tonBlockService.tonBlock({ id: id });

    if (await this.syncVerifying(prismaBlock.rootHash, prismaBlock.id)) {
      return {};
    }
    this.logger.validatorLog('[Validator] validatong block by validators...');
    const blockData = await this.tonApi.getBlockBoc(prismaBlock);
    const signaturesRes = await this.tonApi.getSignatures(prismaBlock.seqno);

    const signatures = signaturesRes.map((el) => ({
      node_id: Buffer.from(el.node_id_short, 'base64').toString('hex'),
      r: Buffer.from(el.signature, 'base64').slice(0, 32).toString('hex'),
      s: Buffer.from(el.signature, 'base64').slice(32).toString('hex'),
    }));

    return {
      signatures,
      blockData,
    };
  }

  async validateShardBlock(id: number) {
    this.logger.validatorLog('start shard validating...');

    const prismaShardBlock = await this.tonBlockService.tonBlock({
      id: id,
    });

    if (await this.syncVerifying(prismaShardBlock.rootHash, id)) {
      this.logger.validatorLog('shard already verified.');
      return {};
    }

    const shardProofRes = await this.tonApi.getShardProof(prismaShardBlock);
    const bocProof = shardProofRes.links.find(
      (l) => l.id.seqno === prismaShardBlock.seqno,
    )?.proof;

    if (!bocProof) {
      throw Error('wrong proof');
    }

    const isVerified = await this.syncVerifying(
      prismaShardBlock.mcParent.rootHash,
      prismaShardBlock.mcParent.id,
    );

    if (!isVerified) {
      throw Error('first check mc block');
      // await this.validateMcBlockByValidator(prismaShardBlock.mcParent.id);
    }

    return {
      bocProof,
    };
  }

  async validateMCBlockByState(id: number) {
    console.log('try check block by validator');
    await this.tonBlockService.updateTonBlockStatus({
      blockId: id,
      inprogress: true,
    });
    const prismaBlock = await this.tonBlockService.tonBlock({ id: id });
    const [nextBlock] = await this.tonBlockService.tonBlocks({
      where: {
        workchain: -1,
        checked: true,
        seqno: {
          gt: prismaBlock.seqno,
        },
      },
    });

    try {
      if (!nextBlock) {
        throw Error('no validated future block');
      }
      await this.validatorLock.acquire();
      const mc_proof = await this.tonApi.getStateProof(prismaBlock, nextBlock);

      await this.contractService.validatorContract
        .readStateProof(
          Buffer.from(mc_proof.state_proof, 'base64'),
          Buffer.from(nextBlock.rootHash, 'hex'),
          {
            gasPrice: ethers.parseUnits('0.002', 'gwei'),
          },
        )
        .then((tx) => (tx as any).wait());
      await this.tonBlockService.updateTonBlockStatus({
        blockId: id,
        checked: true,
      });
    } catch (error) {
      console.error(error.message);
    } finally {
      this.validatorLock.release();
      await this.tonBlockService.updateTonBlockStatus({
        blockId: id,
        inprogress: false,
      });
    }
  }

  async validateTransaction(transaction: TonTransaction) {
    const prismaTx: any = ((
      await this.tonTransactionService.tonTransactions({
        where: { ...transaction },
      })
    )[0]) || transaction;

    const block = await this.tonApi.getBlockBoc(prismaTx?.mcParent);

    const proven = new ProvenState();
    await proven.add(
      await PSTransaction.fromBlock(
        block.data,
        InternalTransactionId.fromJSON({
          lt: prismaTx.lt,
          hash: prismaTx.hash,
        }),
        CFriendlyAddressString.from(prismaTx.account).asAddress(),
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

    return {
      txBoc: txBoc.toString('hex'),
      boc: boc.toString('hex'),
      adapter: this.configService.get<string>('BASEADAPTER_ADDR'),
    };
  }
}
