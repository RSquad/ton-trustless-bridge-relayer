import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseTonBlockInfo,
  LiteApiBlockRequest,
  LiteApiBlockResponse,
  Signature,
} from 'src/lib/types';
import {
  base64ToHex,
  formatTonBlock,
  formatTonTransaction,
  sleep,
  tonClientBlockRequestToLiteApiBlockRequest,
} from 'src/lib/utils';
import { TonClient4, TonClient } from 'ton';
import axios from 'axios';
import { parseBlock } from 'src/lib/utils/blockReader';
import createLock from 'src/modules/ton-validator/utils/SimpleLock';
import { TonBlock } from '@prisma/client';
import axiosRetry from 'axios-retry';

// https://testnet.toncenter.com/api/v2/lookupBlock?workchain=0&shard=-9223372036854775808&lt=9882134000003
// https://testnet.toncenter.com/api/v2/lookupBlock?workchain=0&shard=-9223372036854776000&lt=9882134000003

// axiosRetry(axios, {
//   retries: 100, // number of retries
//   retryDelay: (retryCount) => {
//     console.log(`retry attempt: ${retryCount}`);
//     // return retryCount * 2000; // time interval between retries
//     return 2000;
//   },
//   retryCondition: (error) => {
//     // if retry condition is not specified, by default idempotent requests are retried
//     // return error.response.status === 503;
//     // if (error?.request)
//     // console.log(error?.request);
//     return true;
//   },
// });

// this.getMasterchainBlockWithShards(8293606)
//   .then((blocks) => {
//     const msBlock = blocks.find((b) => b.workchain === -1);
//     if (!msBlock) {
//       throw Error('no ms block');
//     }
//     return this.getBlockBoc(msBlock).then((data) => {
//       return parseBlock(data);
//     });
//   })
//   .then((data) => {
//     const importantData = {
//       isKeyBlock: data.info.key_block,
//       startLt: new Date(data.info.start_lt.toNumber()),
//       endLt: new Date(data.info.end_lt.toNumber()),
//       prev_keyblock: data.info.prev_key_block_seqno,
//     };
//     console.log(importantData);
//   });
// this.test();

@Injectable()
export class TonApiService {
  private tonClient4 = new TonClient4({
    timeout: 31000,
    endpoint: this.configService.get<string>('TON_CLIENT4_ENDPOINT'),
  });

  private tonClient = new TonClient({
    endpoint: this.configService.get<string>('TON_CLIENT_ENDPOINT'),
  });

  private liteApiUrl = this.configService.get<string>('LITE_API_ENDPOINT');
  private toncenterUrl = this.configService.get<string>('TONCENTER_ENDPOINT');

  private toncenterLock = createLock('toncenter');

  constructor(private configService: ConfigService) {}

  // async test() {
  //   let currentKeyBlock = await this.getLastKeyBlock();
  //   let block = await this.getBlockBoc(currentKeyBlock).then(parseBlock);
  //   let date = block.info.end_lt.toNumber();
  //   let configParam15 = block.extra.custom.config.config.map.get('f');
  //   // prev_validators
  //   let configParam32 = block.extra.custom.config.config.map.get('20');
  //   // new_validators
  //   let configParam34 = block.extra.custom.config.config.map.get('22');
  //   let configParam36 = block.extra.custom.config.config.map.get('24');
  //   function prevValidatorsShort(v: any) {
  //     // console.log(v.cur_validators.list.map);
  //     for (const validator of v.prev_validators.list.map.values()) {
  //       console.log(Buffer.from(validator.public_key.pubkey).toString('hex'));
  //       break;
  //     }
  //   }
  //   function validatorsShort(v: any) {
  //     // console.log(v.cur_validators.list.map);
  //     for (const validator of v.cur_validators.list.map.values()) {
  //       console.log(Buffer.from(validator.public_key.pubkey).toString('hex'));
  //       break;
  //     }
  //   }
  //   function nextvalidatorsShort(v: any) {
  //     if (!v) {
  //       console.log('no new validators');
  //       return;
  //     }
  //     // console.log(v.cur_validators.list.map);
  //     for (const validator of v.next_validators.list.map.values()) {
  //       console.log(Buffer.from(validator.public_key.pubkey).toString('hex'));
  //       break;
  //     }
  //   }
  //   // console.log('block rh:', currentKeyBlock.rootHash);
  //   // console.log('time update:', configParam15.validators_elected_for);
  //   console.log('prev validators');
  //   prevValidatorsShort(configParam32);
  //   console.log('curr validators');
  //   validatorsShort(configParam34);
  //   console.log('next validators');
  //   nextvalidatorsShort(configParam36);
  //   // console.log({
  //   //   hash: currentKeyBlock.rootHash,
  //   //   date: new Date(date),
  //   // });
  //   console.log(configParam36);
  //   for (let i = 0; i < 30; i++) {
  //     currentKeyBlock = await this.getPreviousKeyBlock(currentKeyBlock);
  //     block = await this.getBlockBoc(currentKeyBlock).then(parseBlock);
  //     const newDate = block.info.end_lt.toNumber();
  //     const diffMs = date - newDate;
  //     const diffHrs = Math.floor((diffMs % 86400000) / 3600000);
  //     const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
  //     date = newDate;
  //     console.log({
  //       // hash: currentKeyBlock.rootHash,
  //       // date: new Date(date),
  //       diff: diffHrs,
  //       diffMins,
  //     });
  //     configParam15 = block.extra.custom.config.config.map.get('f');
  //     configParam32 = block.extra.custom.config.config.map.get('20');
  //     configParam34 = block.extra.custom.config.config.map.get('22');
  //     configParam36 = block.extra.custom.config.config.map.get('24');
  //     // console.log('block rh:', currentKeyBlock.rootHash);
  //     // console.log('time update:', configParam15.validators_elected_for);
  //     console.log('prev validators');
  //     prevValidatorsShort(configParam32);
  //     console.log('curr validators');
  //     validatorsShort(configParam34);
  //     console.log('next validators');
  //     nextvalidatorsShort(configParam36);
  //   }
  // }

  async getLastBlock(count = 0): Promise<BaseTonBlockInfo> {
    try {
      const { last: lastBlock } = await this.tonClient4.getLastBlock();

      return formatTonBlock(lastBlock);
    } catch (error) {
      if (count >= 20) {
        throw Error('getLastblock failed by timeout');
      }
      return this.getLastBlock(count + 1);
    }
  }

  async getMasterchainBlockWithShards(seqno: number, count = 0) {
    try {
      const { shards } = await this.tonClient4.getBlock(seqno);

      return shards.map((shard) => ({
        ...formatTonBlock(shard),
        transactions: shard.transactions,
      }));
    } catch (error) {
      if (count >= 20) {
        throw Error('getMasterchainBlockWithShards failed by timeout');
      }
      return this.getMasterchainBlockWithShards(seqno, count + 1);
    }
  }

  async getBlockBoc(
    id: BaseTonBlockInfo,
    retry = 0,
  ): Promise<LiteApiBlockResponse> {
    return axios
      .post<LiteApiBlockResponse>(this.liteApiUrl + 'lite_server_get_block', {
        id: tonClientBlockRequestToLiteApiBlockRequest(id),
      })
      .then((res) => res.data)
      .catch(async (e) => {
        if (retry >= 100) {
          throw e;
        }

        await sleep();
        return this.getBlockBoc(id, retry + 1);
      });
  }

  async getPreviousKeyBlock(
    currentMSblock: BaseTonBlockInfo,
    canReturnCurrent = false,
  ) {
    const block = await this.getBlockBoc(currentMSblock).then(parseBlock);
    if (block.info.key_block && canReturnCurrent) {
      return currentMSblock;
    }
    const previousKeyBlock = (
      await this.getMasterchainBlockWithShards(block.info.prev_key_block_seqno)
    ).find(
      (shard) =>
        shard.workchain === -1 &&
        shard.seqno === block.info.prev_key_block_seqno,
    );

    return previousKeyBlock;
  }

  async getLastKeyBlock() {
    const lastBlock = await this.getLastBlock();
    return this.getPreviousKeyBlock(lastBlock, true);
  }

  async getNKeyBlocks(n: number) {
    const seqnoes: number[] = [];
    let block = await this.getLastKeyBlock();
    seqnoes.unshift(block.seqno);
    for (let i = 0; i <= n; i++) {
      block = await this.getPreviousKeyBlock(block);
      seqnoes.unshift(block.seqno);
    }
    return seqnoes;
  }

  async getSignatures(seqno: number) {
    let signaturesRes: Signature[] = [];
    try {
      await this.toncenterLock.acquire();
      await sleep();
      signaturesRes = (
        await axios.get(
          `${this.toncenterUrl}getMasterchainBlockSignatures?seqno=${seqno}`,
          {
            headers: {
              'X-API-KEY':
                '54dbf47689e0a421871a07296c5f8b443d4b140ad18d26391db4f96e9e19eb0c',
            },
          },
        )
      ).data.result.signatures;
    } catch (error) {
      console.error(error.message);
    } finally {
      await this.toncenterLock.release();
    }

    return signaturesRes;
  }

  async getShardProof(block: TonBlock & { mcParent: TonBlock }) {
    let shardProofRes: any;

    try {
      await this.toncenterLock.acquire();
      await sleep();
      shardProofRes = (
        await axios.get(
          this.toncenterUrl +
            `getShardBlockProof?workchain=${block.workchain}&shard=${block.shard}&seqno=${block.seqno}&from_seqno=${block.mcParent.seqno}`,
          {
            headers: {
              'X-API-KEY':
                '54dbf47689e0a421871a07296c5f8b443d4b140ad18d26391db4f96e9e19eb0c',
            },
          },
        )
      ).data.result;
    } catch (error) {
      console.error(error.message);
    } finally {
      await this.toncenterLock.release();
    }

    return shardProofRes;
  }

  async getStateProof(nextBlock: TonBlock, block: TonBlock) {
    let mc_proof: any;

    try {
      await this.toncenterLock.acquire();
      await sleep(1000);
      // await sleep();
      // console.log(nextBlock, block.seqno);
      // const reaStr =
      //   this.toncenterUrl +
      //   `getShardBlockProof?workchain=${nextBlock.workchain}&shard=${nextBlock.shard}&seqno=${nextBlock.seqno}&from_seqno=${block.seqno}`;
      //   console.log(reaStr);
      mc_proof = (
        await axios.get(
          this.toncenterUrl +
            `getShardBlockProof?workchain=${nextBlock.workchain}&shard=${nextBlock.shard}&seqno=${nextBlock.seqno}&from_seqno=${block.seqno}`,
          {
            headers: {
              'X-API-KEY':
                '54dbf47689e0a421871a07296c5f8b443d4b140ad18d26391db4f96e9e19eb0c',
            },
          },
        )
      ).data.result.mc_proof[0];

      // console.log(nextBlock);
      // console.log(block.seqno, block.workchain);
      // console.log(mc_proof);
    } catch (error) {
      // console.log(nextBlock);
      // console.log(block.seqno, block.workchain);
      console.error(error.message);
    } finally {
      await this.toncenterLock.release();
    }

    return mc_proof;
  }

  async getMcblockByProof(block: TonBlock) {
    let data: any;

    try {
      await this.toncenterLock.acquire();
      await sleep(1000);

      data = (
        await axios.get(
          this.toncenterUrl +
            `getShardBlockProof?workchain=${block.workchain}&shard=${block.shard}&seqno=${block.seqno}`,
          {
            headers: {
              'X-API-KEY':
                '54dbf47689e0a421871a07296c5f8b443d4b140ad18d26391db4f96e9e19eb0c',
            },
          },
        )
      ).data.result.mc_id;
    } catch (error) {
      // console.log(nextBlock);
      // console.log(block.seqno, block.workchain);
      console.error(error.message);
    } finally {
      await this.toncenterLock.release();
    }

    return data;
  }

  async lookupBlock(workchain: number, lt: number) {
    let res: any;
    try {
      await this.toncenterLock.acquire();
      await sleep(1000);
      res = (
        await axios
          .get(
            this.toncenterUrl +
              'lookupBlock' +
              `?workchain=${workchain}&shard=${'-9223372036854775808'}&lt=${lt}&api_key=54dbf47689e0a421871a07296c5f8b443d4b140ad18d26391db4f96e9e19eb0c`,
            {
              headers: {
                'Content-Type': 'application/json',

                'X-API-KEY':
                  '54dbf47689e0a421871a07296c5f8b443d4b140ad18d26391db4f96e9e19eb0c',
                // 'User-Agent': 'PostmanRuntime/7.31.1',
              },
            },
          )
          .then((r) => {
            console.log(r.data);
            return r;
          })
          .catch((e) => {
            console.log(e);
            return { data: { result: 'failure' } };
          })
      ).data.result;
    } catch (error) {
    } finally {
      await this.toncenterLock.release();
    }

    return res;
  }
}
