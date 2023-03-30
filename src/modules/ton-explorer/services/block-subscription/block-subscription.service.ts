import { Injectable } from '@nestjs/common';
import { getInitialBlock, initExample, parseMcBlockRocks } from '../../utils';
import { TonClient4 } from 'ton';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KeyBlockSaved } from '../../events/key-block-saved.event';
import { TonTransactionService } from 'src/modules/prisma/services/ton-transaction/ton-transaction.service';
import { TonBlockService } from 'src/modules/prisma/services/ton-block/ton-block.service';

const MC_INTERVAL = 10 * 1000;

@Injectable()
export class BlockSubscriptionService {
  mcIntervalId?: NodeJS.Timer = undefined;
  startLT?: number;
  startMcBlockNumber?: number;
  mcInterval = MC_INTERVAL;

  tonClient4 = new TonClient4({
    endpoint: 'https://testnet-v4.tonhubapi.com',
  });

  constructor(
    private tonBlockService: TonBlockService,
    private tonTransactionService: TonTransactionService,
    private eventEmitter: EventEmitter2,
  ) {
    this.init();
  }

  async start() {
    this.stop();

    let isMcProcessing = false;

    const mcTick = async () => {
      if (isMcProcessing) return;

      isMcProcessing = true;

      try {
        const lastMcBlickRes = (await this.tonClient4.getLastBlock()).last;
        const lastMcBlock = lastMcBlickRes.seqno;
        if (!lastMcBlock)
          throw new Error('invalid last masterchain block from provider');

        for (let i = this.startMcBlockNumber + 1; i < lastMcBlock; i++) {
          console.log('start parse block with seqno:', i);
          const blockShards = await this.tonClient4.getBlock(i);

          const mcBlock = blockShards.shards.find(
            (b) => b.seqno === i && b.workchain === -1,
          );

          if (!mcBlock) {
            throw Error('no mc block');
          }

          const blockData = await parseMcBlockRocks(
            mcBlock.seqno,
            this.tonClient4,
          );

          const tonMasterChainBlock = await this.tonBlockService.createTonBlock(
            {
              ...mcBlock,
              transactions: undefined,
              isKeyBlock: blockData.boc.info.key_block,
            },
          );

          // const dbMcBlock = this.blocksRepository.create(mcBlock);
          // dbMcBlock.isKeyBlock = blockData.boc.info.key_block;
          // const mcTonBlock = await this.blocksRepository.save(dbMcBlock);

          for (let k = 0; k < mcBlock.transactions.length; k++) {
            console.log('start parse tx with index:', k);
            const transaction = mcBlock.transactions[k];

            const tonMCTransaction =
              await this.tonTransactionService.createTonTransaction({
                ...transaction,
                mcParent: { connect: { id: tonMasterChainBlock.id } },
              });

            // const dbTransaction =
            //   this.transactionsRepository.create(transaction);
            // await this.transactionsRepository.save({
            //   ...dbTransaction,
            //   mcParent: mcTonBlock,
            // });
          }

          for (let j = 0; j < blockShards.shards.length; j++) {
            console.log('start parse shardblock with seqno:', j);
            const block = blockShards.shards[j];
            if (block.seqno === mcBlock.seqno && block.workchain === -1) {
              continue;
            }

            const tonShardBlock = await this.tonBlockService.createTonBlock({
              ...block,
              transactions: undefined,
              mcParent: { connect: { id: tonMasterChainBlock.id } },
            });
            // const dbBlock = this.blocksRepository.create(block);
            // dbBlock.mcParent = mcTonBlock;
            // const tonBlock = await this.blocksRepository.save(dbBlock);

            for (let k = 0; k < block.transactions.length; k++) {
              console.log('start parse shard tx with index:', k);
              const transaction = block.transactions[k];

              const shardTransaction =
                await this.tonTransactionService.createTonTransaction({
                  ...transaction,
                  mcParent: { connect: { id: tonShardBlock.id } },
                });
              // const dbTransaction =
              //   this.transactionsRepository.create(transaction);
              // await this.transactionsRepository.save({
              //   ...dbTransaction,
              //   mcParent: tonBlock,
              // });
            }
          }
          console.log(blockData.boc.info.key_block);
          if (blockData.boc.info.key_block) {
            this.eventEmitter.emit(
              'keyblock.saved',
              new KeyBlockSaved(tonMasterChainBlock),
            );
          }

          this.startMcBlockNumber = lastMcBlock - 1;
        }
      } catch (e) {
        console.error(e);
      }

      isMcProcessing = false;
    };

    this.mcIntervalId = setInterval(() => mcTick(), this.mcInterval);
    mcTick();
  }
  stop() {
    clearInterval(this.mcIntervalId);
  }

  async init() {
    const initData = await initExample();
    const initialBlockInfo = await getInitialBlock(initData);

    if (!this.startMcBlockNumber) {
      this.startMcBlockNumber = initialBlockInfo.id.seqno - 1;
      if (!this.startMcBlockNumber)
        throw new Error('Cannot get start mc block number from provider');
    }
    this.startLT = initialBlockInfo.info.end_lt;
    if (!this.startLT) throw new Error('Cannot get startLT from provider');

    this.start();
  }
}
