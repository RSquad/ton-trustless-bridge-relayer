import BN from 'bn.js';

export interface BaseTonBlockInfo {
  workchain: number;
  seqno: number;
  shard: string;
  rootHash: string;
  fileHash: string;
}

export interface BaseTonTransactionInfo {
  account: string;
  hash: string;
  lt: string;
}

export interface LiteApiBlockRequest {
  workchain: number;
  shard: string;
  seqno: number;
  root_hash: string;
  file_hash: string;
}

export interface LiteApiBlockResponse {
  id: LiteApiBlockRequest;
  data: string;
}

export interface ParsedBlock {
  global_id: number;
  info: {
    version: number;
    key_block: boolean;
    seq_no: number;
    prev_seq_no: number;
    gen_utime: number;
    prev_key_block_seqno: number;
    start_lt: BN;
    end_lt: BN;
  };
  extra?: {
    custom?: {
      config?: {
        config?: {
          map: Map<string, any>;
        };
      };
    };
  };
}

export interface Signature {
  node_id_short: string;
  signature: string;
}
