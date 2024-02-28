import {
  BaseTonBlockInfo,
  BaseTonTransactionInfo,
  LiteApiBlockRequest,
} from '../types/index.js';

export function hexToBase64(hex: string) {
  return Buffer.from(hex, 'hex').toString('base64');
}

export function base64ToHex(base64: string) {
  return Buffer.from(base64, 'base64').toString('hex');
}

export function formatTonBlock<T extends BaseTonBlockInfo>(block: T): T {
  return {
    ...block,
    rootHash: base64ToHex(block.rootHash),
    fileHash: base64ToHex(block.fileHash),
  };
}

export function formatTonTransaction<T extends BaseTonTransactionInfo>(
  tx: T,
): T {
  return {
    ...tx,
    account: base64ToHex(tx.account),
    hash: base64ToHex(tx.hash),
  };
}

export function sleep(ms = 1000) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(undefined);
    }, ms);
  });
}

export function tonClientBlockRequestToLiteApiBlockRequest<
  T extends BaseTonBlockInfo,
>(req: T): LiteApiBlockRequest {
  return {
    seqno: req.seqno,
    shard: req.shard,
    workchain: req.workchain,
    file_hash: req.fileHash,
    root_hash: req.rootHash,
  };
}
