import BN from 'bn.js';
import {
  Builder,
  Cell,
  CellType,
  CurrencyCollection,
  Dictionary,
  DictionaryValue,
  loadCurrencyCollection,
  loadShardIdent,
  loadTransaction,
  ShardIdent,
  Slice,
} from '../ton-core/src';

interface GlobalVersion {
  version: number;
  capabilities: number;
}

export interface ExtBlkRef {
  end_lt: number;
  seq_no: number;
  root_hash: string;
  file_hash: string;
}

export interface BlkMasterInfo {
  master: ExtBlkRef;
}

export type BlkPrevInfo =
  | {
      type: 'prev_blk_info';
      prev: ExtBlkRef;
    }
  | {
      type: 'prev_blks_info';
      prev1: ExtBlkRef;
      prev2: ExtBlkRef;
    };

export interface MerkleUpdate {
  old_hash: string;
  new_hash: string;
}

export interface BlockInfo {
  version: number;
  not_master: boolean;
  after_merge: number;
  before_split: boolean;
  after_split: boolean;
  want_split: boolean;
  want_merge: boolean;
  key_block: boolean;
  vert_seqno_incr: number;
  flags: number;
  seq_no: number;
  vert_seq_no: number;
  prev_seq_no: number;
  shard: ShardIdent;
  gen_utime: number;
  start_lt: number;
  end_lt: number;
  gen_validator_list_hash_short: number;
  gen_catchain_seqno: number;
  min_ref_mc_seqno: number;
  prev_key_block_seqno: number;
  gen_software?: GlobalVersion;
  master_ref?: BlkMasterInfo;
  prev_ref: BlkPrevInfo;
  prev_vert_ref?: BlkPrevInfo;
}

export interface Block {
  global_id: number;
  info: BlockInfo;
  state_update: MerkleUpdate;
  extra: ReturnType<typeof loadBlockExtra>;
}

export function readBlockRootCell(base64Boc: string, root_hash?: string) {
  const blockRootCell = Cell.fromBoc(Buffer.from(base64Boc, 'base64'))[0];

  if (root_hash && blockRootCell.hash(0).toString('hex') !== root_hash) {
    throw Error('Incorrect block hash calculation');
  }

  return blockRootCell;
}

/*
 * block#11ef55aa global_id:int32 <br>
 *   info:^BlockInfo value_flow:^ValueFlow <br>
 *   state_update:^(MERKLE_UPDATE ShardState)  <br>
 *   extra:^BlockExtra = Block;
 */
export function loadBlock(cell: Cell): Block {
  const data: Block = {} as any;
  const slice = cell.beginParse();

  const magic = slice.loadUint(32);

  if (magic !== 0x11ef55aa) {
    throw Error('not a Block');
  }

  data.global_id = slice.loadInt(32);
  data.info = loadBlockInfo(slice.loadRef());
  // skip value_flow
  //   data.value_flow = loadRefIfExist(cell, t, loadValueFlow);
  slice.loadRef();

  data.state_update = loadMERKLE_UPDATE(slice.loadRef());
  data.extra = loadBlockExtra(slice.loadRef());
  return data;
}

/*
 * block_info#9bc7a987 version:uint32  <br>
 *   not_master:(## 1)  <br>
 *   after_merge:(## 1) before_split:(## 1)  <br>
 *   after_split:(## 1)  <br>
 *   want_split:Bool want_merge:Bool <br>
 *   key_block:Bool vert_seqno_incr:(## 1) <br>
 *   flags:(## 8) { flags <= 1 } <br>
 *   seq_no:# vert_seq_no:# { vert_seq_no >= vert_seqno_incr }  <br>
 *   { prev_seq_no:# } { ~prev_seq_no + 1 = seq_no }  <br>
 *   shard:ShardIdent gen_utime:uint32 <br>
 *   start_lt:uint64 end_lt:uint64 <br>
 *   gen_validator_list_hash_short:uint32 <br>
 *   gen_catchain_seqno:uint32 <br>
 *   min_ref_mc_seqno:uint32 <br>
 *   prev_key_block_seqno:uint32 <br>
 *   gen_software:flags . 0?GlobalVersion <br>
 *   master_ref:not_master?^BlkMasterInfo  <br>
 *   prev_ref:^(BlkPrevInfo after_merge) <br>
 *   prev_vert_ref:vert_seqno_incr?^(BlkPrevInfo 0) <br>
 *   = BlockInfo;
 */
function loadBlockInfo(cell: Cell): BlockInfo {
  const data: BlockInfo = {} as any;
  let slice: Slice;
  try {
    slice = cell.beginParse();
  } catch (error) {
    return {} as any;
  }

  if (slice.loadUint(32) !== 0x9bc7a987) {
    throw Error('not a BlockInfo');
  }

  data.version = slice.loadUint(32);
  data.not_master = slice.loadBit();
  data.after_merge = +slice.loadBit();
  data.before_split = slice.loadBit();
  data.after_split = slice.loadBit();
  data.want_split = slice.loadBoolean();
  data.want_merge = slice.loadBoolean();
  data.key_block = slice.loadBoolean();
  data.vert_seqno_incr = +slice.loadBit();
  data.flags = slice.loadUint(8);

  if (data.flags > 1) {
    throw Error('data.flags > 1');
  }

  data.seq_no = slice.loadUint(32);
  data.vert_seq_no = slice.loadUint(32);

  if (data.vert_seqno_incr > data.vert_seq_no)
    throw Error('data.vert_seqno_incr > data.vert_seq_no');

  data.prev_seq_no = data.seq_no - 1;

  data.shard = loadShardIdent(slice);

  data.gen_utime = slice.loadUint(32);
  data.start_lt = slice.loadUint(64);
  data.end_lt = slice.loadUint(64);
  data.gen_validator_list_hash_short = slice.loadUint(32);
  data.gen_catchain_seqno = slice.loadUint(32);
  data.min_ref_mc_seqno = slice.loadUint(32);
  data.prev_key_block_seqno = slice.loadUint(32);
  if (data.flags & 1) {
    data.gen_software = loadGlobalVersion(slice);
  }
  if (data.not_master) {
    data.master_ref = loadBlkMasterInfo(slice.loadRef().beginParse());
  }
  data.prev_ref = loadBlkPrevInfo(
    slice.loadRef().beginParse(),
    data.after_merge,
  );
  if (data.vert_seqno_incr) {
    data.prev_vert_ref = loadBlkPrevInfo(slice.loadRef().beginParse(), 0);
  }

  return data;
}

function loadGlobalVersion(slice: Slice) {
  if (slice.loadUint(8) !== 0xc4) throw Error('not a GlobalVersion');
  return {
    version: slice.loadUint(32),
    capabilities: slice.loadUint(64),
  };
}

function loadBlkMasterInfo(slice: Slice): BlkMasterInfo {
  return {
    master: loadExtBlkRef(slice),
  };
}

function loadExtBlkRef(slice: Slice): ExtBlkRef {
  return {
    end_lt: slice.loadUint(64),
    seq_no: slice.loadUint(32),
    root_hash: slice.loadBits(256).toString().toLowerCase(),
    file_hash: slice.loadBits(256).toString().toLowerCase(),
  };
}

function loadBlkPrevInfo(slice: Slice, n: number): BlkPrevInfo {
  const data = { _: 'BlkPrevInfo' };
  if (n === 0) {
    return {
      type: 'prev_blk_info',
      prev: loadExtBlkRef(slice),
    };
  } else {
    return {
      type: 'prev_blks_info',
      prev1: loadExtBlkRef(slice.loadRef().beginParse()),
      prev2: loadExtBlkRef(slice.loadRef().beginParse()),
    };
  }
}

function loadMERKLE_UPDATE(cell: Cell): MerkleUpdate {
  if (cell.type === CellType.PrunedBranch) {
    return {} as any;
  }
  const slice: Slice = cell.beginParse(true);
  // exotic cell with type = 4
  if (slice.loadUint(8) !== 0x04) {
    throw Error('not a MERKLE_UPDATE');
  }

  // data.old = cell.refs[t.ref++]; // TODO
  // data.new = cell.refs[t.ref++];
  return {
    old_hash: slice.loadBits(256).toString().toLowerCase(),
    new_hash: slice.loadBits(256).toString().toLowerCase(),
  };
}

function loadBlockExtra(cell: Cell) {
  if (cell.type === CellType.PrunedBranch) {
    return {};
  }
  const slice = cell.beginParse();
  if (slice.loadUint(32) !== 0x4a33f6fd) {
    throw Error('not a BlockExtra');
  }

  // skip in_msg_descr
  slice.loadRef();
  // skip out_msg_descr
  slice.loadRef();
  const account_blocks = loadShardAccountBlocks(slice.loadRef());
  const rand_seed = slice.loadBits(256).toString();
  const created_by = slice.loadBits(256).toString();
  const custom = loadMcBlockExtra(slice.loadMaybeRef());
  return {
    account_blocks,
    rand_seed,
    created_by,
    custom,
  };
}

interface ShardAccountBlock {
  extra: CurrencyCollection;
  value: ReturnType<typeof loadAccountBlock>;
}

export function loadShardAccountBlock(slice: Slice): ShardAccountBlock {
  return {
    extra: loadCurrencyCollection(slice),
    value: loadAccountBlock(slice),
    // public: slice.loadBit(),
    // root: slice.loadRef()
  };
}

export function storeShardAccountBlock(src: ShardAccountBlock) {
  return (builder: Builder) => {
    // builder.storeBit(src.public);
    // builder.storeRef(src.root);
  };
}

export const ShardAccountBlockValue: DictionaryValue<ShardAccountBlock> = {
  serialize(src, builder) {
    storeShardAccountBlock(src)(builder);
  },
  parse(src) {
    return loadShardAccountBlock(src);
  },
};

function loadShardAccountBlocks(cell: Cell) {
  if (cell.type === CellType.PrunedBranch) {
    return undefined;
  }
  const slice = cell.beginParse();

  const res = slice.loadDict(
    Dictionary.Keys.Buffer(32),
    ShardAccountBlockValue,
  );

  return res;
}

interface Transactions {
  extra: CurrencyCollection;
  value: ReturnType<typeof loadTransaction>;
}

export function loadTransactions(slice: Slice): Transactions {
  const transactionCell = slice.loadRef();
  if (transactionCell.type !== CellType.Ordinary) {
    return {
      extra: loadCurrencyCollection(slice),
      value: undefined as any,
    };
  }
  return {
    extra: loadCurrencyCollection(slice),
    value: loadTransaction(transactionCell.beginParse()),
  };
}

export function storeTransactions(src: Transactions) {
  return (builder: Builder) => {
    // builder.storeBit(src.public);
    // builder.storeRef(src.root);
  };
}

export const TransactionsValue: DictionaryValue<Transactions> = {
  serialize(src, builder) {
    storeTransactions(src)(builder);
  },
  parse(src) {
    return loadTransactions(src);
  },
};

function loadAccountBlock(slice: Slice) {
  if (slice.loadUint(4) !== 0x5) {
    throw Error('not an AccountBlock');
  }
  const account_addr = slice.loadBits(256).toString();
  const transactions = slice.loadDictDirect(
    Dictionary.Keys.Buffer(8),
    TransactionsValue,
  );
  const state_update = loadHASH_UPDATE(slice.loadRef());

  return {
    account_addr,
    transactions,
    state_update,
  };
}

function loadHASH_UPDATE(cell: Cell) {
  const slice = cell.beginParse();
  if (slice.loadUint(8) !== 0x72) {
    throw Error('not a HASH_UPDATE');
  }

  const old_hash = slice.loadBuffer(32).toString('hex');
  const new_hash = slice.loadBuffer(32).toString('hex');
  return {
    old_hash,
    new_hash,
  };
}

function loadMcBlockExtra(cell: Cell | null) {
  if (!cell || cell.type !== CellType.Ordinary) {
    return;
  }

  const slice = cell.beginParse();

  const magic = slice.loadUint(16);

  if (magic !== 0xcca5) {
    throw Error('not a McBlockExtra');
  }
  const data: {
    _: string;
    key_block: boolean;
    shard_hashes: ReturnType<typeof loadShardHashes>;
    shard_fees: ReturnType<typeof loadShardFees>;
    config?: Dictionary<number, Cell>;
  } = { _: 'McBlockExtra' } as any;

  data.key_block = slice.loadBit();
  data.shard_hashes = loadShardHashes(slice);
  data.shard_fees = loadShardFees(slice);

  // skip
  slice.loadRef();
  // let cell_r1 = cell.refs[t.ref++];
  // let tr1 = {cs: 0, ref: 0};
  // if (cell_r1.type === Cell.OrdinaryCell) {
  //   data.prev_blk_signatures = loadHashmapE(cell_r1, tr1, 16, loadCryptoSignaturePair);
  //   data.recover_create_msg = loadMaybeRef(cell_r1, tr1, loadInMsg);
  //   data.mint_msg = loadMaybeRef(cell_r1, tr1, loadInMsg);
  // }

  if (data.key_block) {
    const configAddress = slice.loadBuffer(32).toString('hex');

    if (slice.preloadRef().type === CellType.PrunedBranch) {
      return data;
    }

    data.config = Dictionary.loadDirect(
      Dictionary.Keys.Int(32),
      Dictionary.Values.Cell(),
      slice.loadRef(),
    );
  }

  return data;
}

type ShardDescription = BinTree<ShardDescr>;

export function loadShardDescription(slice: Slice): ShardDescription {
  return loadBinTree(slice.loadRef().beginParse(), loadShardDescr);
}

export function storeShardDescription(src: ShardDescription) {
  return (builder: Builder) => {
    // builder.storeBit(src.public);
    // builder.storeRef(src.root);
  };
}

export const ShardDescriptionValue: DictionaryValue<ShardDescription> = {
  serialize(src, builder) {
    storeShardDescription(src)(builder);
  },
  parse(src) {
    return loadShardDescription(src);
  },
};

function loadShardHashes(slice: Slice) {
  const shardsDescr = slice.loadDict(
    Dictionary.Keys.Buffer(4),
    ShardDescriptionValue,
  );
  // return  loadHashmapE(cell, t, 32,
  //   (c, p) => loadRefIfExist(c, p,
  //     (c2, p2) => loadBinTree(c2, p2, loadShardDescr)));

  return shardsDescr;
}

function loadBinTree<T, F extends (slice: Slice) => T>(slice: Slice, f: F) {
  const data = loadBinTreeR<T, F>(slice, f);
  type f = (d: number) => number;
  return data;
}

type BinTree<T> =
  | {
      type: 'leaf';
      leaf: T | null;
    }
  | {
      type: 'fork';
      left?: BinTree<T>;
      right?: BinTree<T>;
    };

function loadBinTreeR<T, F extends (slice: Slice) => T>(
  slice: Slice,
  fn: F,
): BinTree<T> {
  if (!slice) {
    return {} as any;
  }

  if (+slice.loadBit() === 0) {
    const type = 'leaf';
    const leaf = fn ? fn(slice) : null;
    return { type, leaf };
  } else {
    const type = 'fork';
    const left = loadBinTreeR<T, F>(slice.loadRef().beginParse(), fn);
    const right = loadBinTreeR<T, F>(slice.loadRef().beginParse(), fn);
    return { type, left, right };
  }
}

interface ShardDescr {
  seq_no: number;
  reg_mc_seqno: number;
  start_lt: number;
  end_lt: number;
  root_hash: string;
  file_hash: string;
  before_split: boolean;
  before_merge: boolean;
  want_split: boolean;
  want_merge: boolean;
  nx_cc_updated: boolean;
  flags: number;

  next_catchain_seqno: number;
  next_validator_shard: number;
  min_ref_mc_seqno: number;
  gen_utime: number;
  split_merge_at: ReturnType<typeof loadFutureSplitMerge>;

  fees_collected?: CurrencyCollection;
  funds_created?: CurrencyCollection;
}

function loadShardDescr(slice: Slice) {
  const type = slice.loadUint(4);

  if (type !== 0xa && type !== 0xb) throw Error('not a ShardDescr');
  const data: ShardDescr = {} as any;
  data.seq_no = slice.loadUint(32);
  data.reg_mc_seqno = slice.loadUint(32);
  data.start_lt = slice.loadUint(64);
  data.end_lt = slice.loadUint(64);
  data.root_hash = slice.loadBuffer(32).toString('hex');
  data.file_hash = slice.loadBuffer(32).toString('hex');
  data.before_split = slice.loadBoolean();
  data.before_merge = slice.loadBoolean();
  data.want_split = slice.loadBoolean();
  data.want_merge = slice.loadBoolean();
  data.nx_cc_updated = slice.loadBoolean();
  data.flags = slice.loadUint(3);
  if (data.flags !== 0) throw Error('ShardDescr data.flags !== 0');
  data.next_catchain_seqno = slice.loadUint(32);
  data.next_validator_shard = slice.loadUint(64);
  data.min_ref_mc_seqno = slice.loadUint(32);
  data.gen_utime = slice.loadUint(32);
  data.split_merge_at = loadFutureSplitMerge(slice);
  if (type === 0xb) {
    data.fees_collected = loadCurrencyCollection(slice);
    data.funds_created = loadCurrencyCollection(slice);
  } else if (type === 0xa) {
    const cell_r1 = slice.loadRef();

    if (cell_r1.type === CellType.Ordinary) {
      const slice_r1 = cell_r1.beginParse();
      data.fees_collected = loadCurrencyCollection(slice_r1);
      data.funds_created = loadCurrencyCollection(slice_r1);
    }
  }
  return data;
}

function loadFutureSplitMerge(slice: Slice) {
  const type = slice.loadBit();

  if (+type === 0) {
    return 'none';
  } else {
    const type2 = slice.loadBit();
    if (+type2 === 0) {
      const type = 'split';
      const split_utime = slice.loadUint(32);
      const interval = slice.loadUint(32);
      return {
        type,
        split_utime,
        interval,
      };
    } else {
      const type = 'merge';
      const merge_utime = slice.loadUint(32);
      const interval = slice.loadUint(32);
      return {
        type,
        merge_utime,
        interval,
      };
    }
  }
}

interface ShardFees {
  extra: ReturnType<typeof loadShardFeeCreated>;
  value: ReturnType<typeof loadShardFeeCreated>;
}

export function loadShardFeesD(slice: Slice): ShardFees {
  return {
    extra: loadShardFeeCreated(slice),
    value: loadShardFeeCreated(slice),
  };
}

export function storeShardFees(src: ShardFees) {
  return (builder: Builder) => {
    // builder.storeBit(src.public);
    // builder.storeRef(src.root);
  };
}

export const ShardFeesValue: DictionaryValue<ShardFees> = {
  serialize(src, builder) {
    storeShardFees(src)(builder);
  },
  parse(src) {
    return loadShardFeesD(src);
  },
};

function loadShardFees(slice: Slice) {
  return slice.loadDict(Dictionary.Keys.Buffer(12), ShardFeesValue);
}

function loadShardFeeCreated(slice: Slice) {
  const fees = loadCurrencyCollection(slice);
  const create = loadCurrencyCollection(slice);
  return { fees, create };
}

type ValidatorDescription = ReturnType<typeof loadValidatorDescr>;

export function loadValidatorDescription(slice: Slice): ValidatorDescription {
  return loadValidatorDescr(slice);
}

export function storeValidatorDescription(src: ValidatorDescription) {
  return (builder: Builder) => {
    // builder.storeBit(src.public);
    // builder.storeRef(src.root);
  };
}

export const ValidatorDescriptionValue: DictionaryValue<ValidatorDescription> =
  {
    serialize(src, builder) {
      storeValidatorDescription(src)(builder);
    },
    parse(src) {
      return loadValidatorDescription(src);
    },
  };

export function loadValidatorSet(cell: Cell) {
  const slice = cell.beginParse();

  const type = slice.loadUint(8);

  if (type === 0x11) {
    const type = '';
    const utime_since = slice.loadUint(32);
    const utime_until = slice.loadUint(32);
    const total = slice.loadUint(16);
    const main = slice.loadUint(16);
    if (total < main) throw Error('const total < const main');
    if (main < 1) throw Error('const main < 1');
    const list = slice.loadDictDirect(
      Dictionary.Keys.Int(16),
      ValidatorDescriptionValue,
    );

    return {
      type,
      utime_since,
      utime_until,
      total,
      main,
      list,
    };
  } else if (type === 0x12) {
    const type = 'ext';
    const utime_since = slice.loadUint(32);
    const utime_until = slice.loadUint(32);
    const total = slice.loadUint(16);
    const main = slice.loadUint(16);
    if (total < main) throw Error('const total < const main');
    if (main < 1) throw Error('const main < 1');
    const total_weight = slice.loadUintBig(64);
    const list = slice.loadDict(
      Dictionary.Keys.Int(16),
      ValidatorDescriptionValue,
    );

    return { type, utime_since, utime_until, total, main, list, total_weight };
  }
  throw Error('not a ValidatorSet');
}

function loadValidatorDescr(slice: Slice) {
  // const slice = cell.beginParse();
  const data = { _: 'ValidatorDescr' };
  const type = slice.loadUint(8);
  if (type === 0x53) {
    const type = '';
    const public_key = loadSigPubKey(slice);
    const weight = slice.loadUintBig(64);
    return {
      type,
      public_key,
      weight,
    };
  } else if (type === 0x73) {
    const type = 'addr';
    const public_key = loadSigPubKey(slice);
    const weight = slice.loadUintBig(64);
    const adnl_addr = slice.loadBuffer(32).toString('hex');
    return {
      type,
      public_key,
      weight,
      adnl_addr,
    };
  }
  throw Error('not a ValidatorDescr');
}

function loadSigPubKey(slice: Slice) {
  if (slice.loadUint(32) !== 0x8e81278a) throw Error('not a SigPubKey');
  const pubkey = slice.loadBuffer(32).toString('hex');
  return pubkey;
}
