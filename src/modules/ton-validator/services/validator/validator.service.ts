import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { concatMap, of, Subject } from 'rxjs';
import { GotKeyblock } from 'src/events/got-keyblock.event';
import {
  ProvenState,
  PSProofValidators,
  PSSetValidators,
  PSTransaction,
} from 'src/lib/steps';
import {
  BlockIdExt,
  CFriendlyAddressString,
  InternalTransactionId,
} from 'src/lib/ton-types';
import { ContractService } from 'src/modules/eth-provider/services/contract/contract.service';
import { ProviderService } from 'src/modules/eth-provider/services/provider/provider.service';
import { LoggerService } from 'src/modules/logger/services/logger/logger.service';
import { TonBlockService } from 'src/modules/prisma/services/ton-block/ton-block.service';
import { TonTransactionService } from 'src/modules/prisma/services/ton-transaction/ton-transaction.service';
import { TonApiService } from 'src/modules/ton-reader/services/ton-api/ton-api.service';
import createLock from '../../utils/SimpleLock';
import _ from 'lodash';
import { parseBlock } from 'src/lib/utils/blockReader';
import { TonTransaction } from '@prisma/client';

@Injectable()
export class ValidatorService {
  nonce = 0;
  validatorLock = createLock('validator');
  bridgeLock = createLock('bridge');

  keyblockBuffer = new Subject<GotKeyblock>();

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

    if (await this.checkInitValidatorsNeeded()) {
      await this.initValidators(data);
    } else {
      await this.updateValidators(data);
    }

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
    return await this.contractService.validatorContract.isVerifiedBlock(hash);
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

      await this.contractService.validatorContract.parseCandidatesRootBlock(
        boc,
      );
      if (bocs.length > 1) {
        for (let i = 1; i < bocs.length; i++) {
          await this.contractService.validatorContract.parsePartValidators(
            bocs[i],
          );
        }
      }
      await this.contractService.validatorContract.initValidators();
    } catch (error) {
      console.error(error.message);
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

      await this.contractService.validatorContract.parseCandidatesRootBlock(
        boc,
      );
      if (bocs.length > 1) {
        for (let i = 1; i < bocs.length; i++) {
          await this.contractService.validatorContract.parsePartValidators(
            bocs[i],
          );
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

        await this.contractService.validatorContract.verifyValidators(
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          // `0x${Buffer.from(
          //   // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          //   jsonData.find((el) => el.type === 'proof-validators')!.id!.fileHash,
          //   'base64',
          // ).toString('hex')}`,
          `0x${data.boc.id.file_hash}`,
          subArr.map((c) => ({
            node_id: `0x${c.node_id}`,
            r: `0x${c.r}`,
            s: `0x${c.s}`,
          })) as any[5],
        );
      }
      await this.contractService.validatorContract.setValidatorSet();
    } catch (error) {
      console.error(error.message);
    } finally {
      this.validatorLock.release();
    }
  }

  async validateMcBlockByValidator(id: number) {
    try {
      await this.validateMCBlockByState(id);
    } catch (error) {}

    await this.tonBlockService.updateTonBlockStatus({
      blockId: id,
      inprogress: true,
    });
    const prismaBlock = await this.tonBlockService.tonBlock({ id: id });

    if (await this.syncVerifying(prismaBlock.rootHash, prismaBlock.id)) {
      await this.tonBlockService.updateTonBlockStatus({
        blockId: id,
        inprogress: false,
      });
      return;
    }
    this.logger.validatorLog('[Validator] validatong block by validators...');
    const blockData = await this.tonApi.getBlockBoc(prismaBlock);
    const signaturesRes = await this.tonApi.getSignatures(prismaBlock.seqno);

    const signatures = signaturesRes.map((el) => ({
      node_id: Buffer.from(el.node_id_short, 'base64').toString('hex'),
      r: Buffer.from(el.signature, 'base64').slice(0, 32).toString('hex'),
      s: Buffer.from(el.signature, 'base64').slice(32).toString('hex'),
    }));

    try {
      await this.validatorLock.acquire();
      for (let i = 0; i < signatures.length; i += 5) {
        const subArr = signatures.slice(i, i + 5);
        while (subArr.length < 5) {
          subArr.push(signatures[0]);
        }

        await this.contractService.validatorContract.verifyValidators(
          '0x' + blockData.id.root_hash,
          `0x${blockData.id.file_hash}`,
          subArr.map((c) => ({
            node_id: `0x${c.node_id}`,
            r: `0x${c.r}`,
            s: `0x${c.s}`,
          })) as any[5],
        );
      }

      await this.contractService.validatorContract.addCurrentBlockToVerifiedSet(
        '0x' + blockData.id.root_hash,
      );

      await this.tonBlockService.updateTonBlockStatus({
        blockId: prismaBlock.id,
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

  async validateShardBlock(id: number) {
    this.logger.validatorLog('start shard validating...');
    await this.tonBlockService.updateTonBlockStatus({
      blockId: id,
      inprogress: true,
    });

    const prismaShardBlock = await this.tonBlockService.tonBlock({
      id: id,
    });

    if (await this.syncVerifying(prismaShardBlock.rootHash, id)) {
      await this.tonBlockService.updateTonBlockStatus({
        blockId: id,
        inprogress: false,
      });

      this.logger.validatorLog('shard already verified.');
      return;
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
      await this.validateMcBlockByValidator(prismaShardBlock.mcParent.id);
    }

    try {
      await this.validatorLock.acquire();
      await this.contractService.validatorContract.parseShardProofPath(
        Buffer.from(bocProof, 'base64'),
      );
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
      this.logger.validatorLog('shard is verified.');
    }
  }

  async validateMCBlockByState(id: number) {
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
      await this.contractService.validatorContract.readStateProof(
        Buffer.from(mc_proof.state_proof, 'base64'),
        Buffer.from(nextBlock.rootHash, 'hex'),
      );
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
    const prismaTx = (
      await this.tonTransactionService.tonTransactions({
        where: { ...transaction },
      })
    )[0];

    const block = await this.tonApi.getBlockBoc(prismaTx.mcParent);

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
