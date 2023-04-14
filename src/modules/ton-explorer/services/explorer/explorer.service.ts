import { Injectable } from '@nestjs/common';
import { TonBlockService } from 'src/modules/prisma/services/ton-block/ton-block.service';
import { TonTransactionService } from 'src/modules/prisma/services/ton-transaction/ton-transaction.service';
import { TonApiService } from 'src/modules/ton-reader/services/ton-api/ton-api.service';
import { BlockSubscriptionService } from '../block-subscription/block-subscription.service';

@Injectable()
export class ExplorerService {
  constructor(
    private tonBlockService: TonBlockService,
    private tonTransactionService: TonTransactionService,
    private tonApi: TonApiService,
    private blockSub: BlockSubscriptionService,
  ) {}

  findLast5Transactions() {
    // TODO: include
    return this.tonTransactionService.tonTransactions({
      orderBy: { id: 'desc' },
      take: 5,
    });
  }

  countAllBlocks() {
    return this.tonBlockService.tonBlockCount({
      orderBy: { id: 'desc' },
    });
  }

  findAllBlocks(skip = 0) {
    return this.tonBlockService.tonBlocks({
      // where: {
      //   workchain: -1,
      // },
      orderBy: { id: 'desc' },
      take: 10,
      skip,
    });
  }

  findAllKeyBlocks() {
    return this.tonBlockService.tonBlocks({
      where: {
        workchain: -1,
        isKeyBlock: true,
      },
    });
  }

  countValidatedBlocks() {
    return this.tonBlockService.tonBlockCount({
      where: {
        checked: true,
        // workchain: -1,
      },
      orderBy: { id: 'desc' },
    });
  }

  findAllValidatedBlocks(skip = 0) {
    return this.tonBlockService.tonBlocks({
      where: {
        checked: true,
        // workchain: -1,
      },
      orderBy: { id: 'desc' },
      take: 10,
      skip,
    });
  }

  async findTransactionByHash(hash: string, workchain: number, lt: number) {
    try {
      const res = await this.tonTransactionService.tonTransactions({
        where: {
          hash: Buffer.from(hash, 'hex').toString('base64'),
        },
        orderBy: { id: 'desc' },
        take: 5,
      });
      if (res.length === 0) {
        throw Error('not found tx');
      }
      return res;
    } catch (error) {
      // transaction not found in db, try by hand
      console.log('got info', hash, workchain, lt);
      // 1. find a block
      const block = await this.tonApi.lookupBlock(workchain, lt);
      let shardsData: any;
      let seqno = block.seqno;
      if (block.workchain === 0) {
        const proofBlock = await this.tonApi.getMcblockByProof(block);
        seqno = proofBlock.seqno;
        shardsData = await this.tonApi.getMasterchainBlockWithShards(
          proofBlock.seqno,
        );
      } else {
        shardsData = await this.tonApi.getMasterchainBlockWithShards(
          block.seqno,
        );
      }
      // 2. save
      const mcBlock = shardsData.find(
        (block) => block.seqno === seqno && block.workchain === -1,
      );
      const shards = shardsData.filter(
        (block) => block.seqno !== seqno && block.workchain != -1,
      );

      const prismaMCBlock = await this.tonBlockService.createTonBlock(mcBlock);

      await this.blockSub.saveBlockTransactions(mcBlock, prismaMCBlock);
      await this.blockSub.saveShardBlocks(shards, prismaMCBlock);
      const res = await this.tonTransactionService.tonTransactions({
        where: {
          hash: Buffer.from(hash, 'hex').toString('base64'),
        },
        orderBy: { id: 'desc' },
        take: 5,
      });
      if (res.length === 0) {
        throw Error('not found tx');
      }
      return res;
    }
  }
}
