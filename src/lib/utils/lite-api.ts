import axios from 'axios';

const liteApiUrl = 'http://167.172.88.200:8081/v1/';

function sleep() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(undefined);
    }, 1000);
  });
}

export interface BlockRequest {
  workchain: number;
  shard: string;
  seqno: number;
  root_hash: string;
  file_hash: string;
}

export interface BlockInfo {
  id: BlockRequest;
  data: string;
}

export interface TonClient4BlockReq {
  seqno: number;
  shard: string;
  workchain: number;
  fileHash: string;
  rootHash: string;
}

export function tonClientBlockRequestToLiteApiBlockRequest(
  req: TonClient4BlockReq,
): BlockRequest {
  return {
    seqno: req.seqno,
    shard: req.shard,
    workchain: req.workchain,
    file_hash: Buffer.from(req.fileHash, 'base64').toString('hex'),
    root_hash: Buffer.from(req.rootHash, 'base64').toString('hex'),
  };
}

export function getBlockInfo(id: BlockRequest, retry = 0) {
  return axios
    .post<BlockInfo>(liteApiUrl + 'lite_server_get_block', {
      id,
    })
    .then((res) => res.data)
    .catch(async (e) => {
      if (retry >= 100) {
        throw e;
      }
      console.log('failed req, attemp:', retry);
      await sleep();
      return getBlockInfo(id, retry + 1);
    });
}

export function getBlock(id: TonClient4BlockReq) {
  return getBlockInfo(tonClientBlockRequestToLiteApiBlockRequest(id));
}
