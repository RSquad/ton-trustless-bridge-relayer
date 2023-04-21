import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseTonBlockInfo,
  LiteApiBlockResponse,
  Signature,
} from 'src/lib/types';
import {
  formatTonBlock,
  tonClientBlockRequestToLiteApiBlockRequest,
} from 'src/lib/utils';
import { TonClient4 } from 'ton';
import axios from 'axios';
import { parseBlock } from 'src/lib/utils/blockReader';
import { TonBlock } from '@prisma/client';
import axiosRetry from 'axios-retry';

axiosRetry(axios, {
  retries: 100, // number of retries
  retryDelay: (retryCount) => {
    console.log(`retry attempt: ${retryCount}`);
    return 2000;
  },
  retryCondition: () => {
    return true;
  },
});

@Injectable()
export class TonApiService {
  private tonClient4 = new TonClient4({
    timeout: 31000,
    endpoint: this.configService.get<string>('TON_CLIENT4_ENDPOINT'),
  });

  private liteApiUrl = this.configService.get<string>('LITE_API_ENDPOINT');
  private toncenterUrl = this.configService.get<string>('TONCENTER_ENDPOINT');

  constructor(private configService: ConfigService) {}

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

  async getBlockBoc(id: BaseTonBlockInfo): Promise<LiteApiBlockResponse> {
    return axios
      .post<LiteApiBlockResponse>(this.liteApiUrl + 'lite_server_get_block', {
        id: tonClientBlockRequestToLiteApiBlockRequest(id),
      })
      .then((res) => res.data);
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
      signaturesRes = (
        await axios.get(
          `${this.toncenterUrl}getMasterchainBlockSignatures?seqno=${seqno}`,
          {
            headers: {
              'X-API-KEY': this.configService.get<string>('TONCENTER_API_KEY'),
            },
          },
        )
      ).data.result.signatures;
    } catch (error) {
      console.error(error.message);
    }

    return signaturesRes;
  }

  async getShardProof(block: TonBlock & { mcParent: TonBlock }) {
    let shardProofRes: any;

    try {
      shardProofRes = (
        await axios.get(
          this.toncenterUrl +
            `getShardBlockProof?workchain=${block.workchain}&shard=${block.shard}&seqno=${block.seqno}&from_seqno=${block.mcParent.seqno}`,
          {
            headers: {
              'X-API-KEY': this.configService.get<string>('TONCENTER_API_KEY'),
            },
          },
        )
      ).data.result;
    } catch (error) {
      console.error(error.message);
    }

    return shardProofRes;
  }

  async getStateProof(nextBlock: TonBlock, block: TonBlock) {
    let mc_proof: any;

    try {
      mc_proof = (
        await axios.get(
          this.toncenterUrl +
            `getShardBlockProof?workchain=${nextBlock.workchain}&shard=${nextBlock.shard}&seqno=${nextBlock.seqno}&from_seqno=${block.seqno}`,
          {
            headers: {
              'X-API-KEY': this.configService.get<string>('TONCENTER_API_KEY'),
            },
          },
        )
      ).data.result.mc_proof[0];
    } catch (error) {
      console.error(error.message);
    }

    return mc_proof;
  }

  async getMcblockByProof(block: TonBlock) {
    let data: any;

    try {
      data = (
        await axios.get(
          this.toncenterUrl +
            `getShardBlockProof?workchain=${block.workchain}&shard=${block.shard}&seqno=${block.seqno}`,
          {
            headers: {
              'X-API-KEY': this.configService.get<string>('TONCENTER_API_KEY'),
            },
          },
        )
      ).data.result.mc_id;
    } catch (error) {
      console.error(error.message);
    }

    return data;
  }

  async lookupBlock(workchain: number, lt: number) {
    let res: any;
    try {
      res = (
        await axios
          .get(
            this.toncenterUrl +
              'lookupBlock' +
              `?workchain=${workchain}&shard=${'-9223372036854775808'}&lt=${lt}&api_key=54dbf47689e0a421871a07296c5f8b443d4b140ad18d26391db4f96e9e19eb0c`,
            {
              headers: {
                'X-API-KEY':
                  this.configService.get<string>('TONCENTER_API_KEY'),
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
    } catch (error) {}

    return res;
  }
}
