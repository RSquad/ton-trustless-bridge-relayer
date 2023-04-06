import { OnModuleDestroy } from '@nestjs/common';
import { INestApplication, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TonBlock } from '@prisma/client';
import { concatMap, delay, exhaustMap, of, Subject, Subscription } from 'rxjs';
import { GotKeyblock } from 'src/events/got-keyblock.event';
import { BaseTonBlockInfo, BaseTonTransactionInfo } from 'src/lib/types';
import { hexToBase64 } from 'src/lib/utils';
import { parseBlock } from 'src/lib/utils/blockReader';
import { ContractService } from 'src/modules/eth-provider/services/contract/contract.service';
import { LoggerService } from 'src/modules/logger/services/logger/logger.service';
import { TonBlockService } from 'src/modules/prisma/services/ton-block/ton-block.service';
import { TonTransactionService } from 'src/modules/prisma/services/ton-transaction/ton-transaction.service';
import { TonApiService } from '../../../ton-reader/services/ton-api/ton-api.service';

const MC_INTERVAL = 10 * 1000;

@Injectable()
export class BlockSubscriptionService implements OnModuleDestroy {
  private sub: Subscription;
  actualBlock$ = new Subject<BaseTonBlockInfo>();
  loop$ = this.actualBlock$.pipe(
    delay(MC_INTERVAL),
    concatMap((block) => {
      return of(this.tick(block));
    }),
  );
  shouldVerifyKeyblock = true;

  constructor(
    private tonApi: TonApiService,
    private logger: LoggerService,
    private contractService: ContractService,
    private tonBlockService: TonBlockService,
    private tonTransactionService: TonTransactionService,
    private eventEmitter: EventEmitter2,
  ) {
    this.sub = this.loop$.subscribe();
    this.getInitialKeyblock().then((block) => {
      this.actualBlock$.next(block);
    });
  }

  onModuleDestroy() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  async tick(initialblock: BaseTonBlockInfo) {
    this.logger.apiLog('[BlockSub] run tick...');
    let seqno = initialblock.seqno;
    const actualBlock = await this.tonApi.getLastBlock();
    this.logger.apiLog(
      `[BlockSub] checking mcblocks from ${seqno} to ${actualBlock.seqno} `,
    );

    while (seqno < actualBlock.seqno) {
      const shardsData = await this.tonApi.getMasterchainBlockWithShards(seqno);
      const mcBlock = shardsData.find(
        (block) => block.seqno === seqno && block.workchain === -1,
      );
      const shards = shardsData.filter(
        (block) => block.seqno !== seqno && block.workchain != -1,
      );

      if (!mcBlock) {
        console.error('NO MC BLOCK FROM API');
        return initialblock;
      }

      const boc = await this.tonApi.getBlockBoc(mcBlock);
      const parsedBlock = await parseBlock(boc);
      const prismaMCBlock = await this.tonBlockService.createTonBlock(mcBlock);

      await this.saveBlockTransactions(mcBlock, prismaMCBlock);
      await this.saveShardBlocks(shards, prismaMCBlock);

      if (parsedBlock.info.key_block && this.shouldVerifyKeyblock) {
        this.eventEmitter.emit(
          'keyblock.new',
          new GotKeyblock(mcBlock, boc, parsedBlock, prismaMCBlock),
        );
      }

      this.shouldVerifyKeyblock =
        !!parsedBlock?.extra?.custom?.config?.config?.map.get('24');
      seqno += 1;
    }

    this.logger.apiLog('[BlockSub] end tick.');
    this.actualBlock$.next(actualBlock);
  }

  async saveBlockTransactions(
    block: BaseTonBlockInfo & { transactions: BaseTonTransactionInfo[] },
    prismaBlock: TonBlock,
  ) {
    for (let idx = 0; idx < block.transactions.length; idx++) {
      const tx = block.transactions[idx];
      await this.tonTransactionService.createTonTransaction(tx, prismaBlock.id);
    }
  }

  async saveShardBlocks(
    shards: (BaseTonBlockInfo & { transactions: BaseTonTransactionInfo[] })[],
    prismaBlock: TonBlock,
  ) {
    for (let idx = 0; idx < shards.length; idx++) {
      const shard = shards[idx];
      const prismaShard = await this.tonBlockService.createTonBlock(
        shard,
        false,
        prismaBlock.id,
      );
      await this.saveBlockTransactions(shard, prismaShard);
    }
  }

  async getInitialKeyblock() {
    this.logger.apiLog('[BlockSub] finding initial keyblock...');
    // const hasKeyblock =
    //   (await this.contractService.validatorContract.getValidators())[0]
    //     .node_id !==
    //   '0x0000000000000000000000000000000000000000000000000000000000000000';

    const hasKeyblock = false;

    if (hasKeyblock) {
      this.logger.apiLog(
        '[BlockSub] Contract has verified keyblock. Trying to find it...',
      );
      let keyblock = await this.tonApi.getLastKeyBlock();
      let validated =
        await this.contractService.validatorContract.isVerifiedBlock(
          Buffer.from(keyblock.rootHash, 'hex'),
        );

      while (!validated) {
        this.logger.apiLog(
          '[BlockSub] Found not verified keyblock:',
          keyblock.seqno,
        );
        keyblock = await this.tonApi.getPreviousKeyBlock(keyblock);
        validated =
          await this.contractService.validatorContract.isVerifiedBlock(
            Buffer.from(keyblock.rootHash, 'hex'),
          );
      }

      this.logger.apiLog(
        '[BlockSub] initial keyblock founded:',
        keyblock.seqno,
      );
      // keyblock = (
      //   await this.tonApi.getMasterchainBlockWithShards(8372792)
      // ).find((b) => b.seqno === 8372792 && b.workchain === -1);
      return keyblock;
    } else {
      // 8372790
      // 8371747
      // 8372792
      // shard: 9881488 8371766?? h7xg3RIiceOnsU7oah+ZnzPXUpGZkIuCMLu45IJTyQw=
      // 8374206
      // 8376603
      // const keyblock = (
      //   await this.tonApi.getMasterchainBlockWithShards(8376603)
      // ).find((b) => b.seqno === 8376603 && b.workchain === -1);
      const keyblock = await this.tonApi.getLastKeyBlock();
      this.logger.apiLog(
        '[BlockSub] initial keyblock founded:',
        keyblock.seqno,
      );
      return keyblock;
    }
  }
}
