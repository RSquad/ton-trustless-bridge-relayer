import _ from 'lodash';
import { BN } from 'bn.js';

// @ts-ignore
import TonRocks from '../ton-rocks-js';

export type TBN = typeof TonRocks.utils.BN;

/*
  td::Bits256 compute_node_id_short(td::Bits256 ed25519_pubkey) {
    // pub.ed25519#4813b4c6 key:int256 = PublicKey;
    struct pubkey {
      int magic = 0x4813b4c6;
      unsigned char ed25519_key[32];
    } PK;
    std::memcpy(PK.ed25519_key, ed25519_pubkey.data(), 32);
    static_assert(sizeof(pubkey) == 36, "PublicKey structure is not 36 bytes long");
    td::Bits256 hash;
    digest::hash_str<digest::SHA256>(hash.data(), (void*)&PK, sizeof(pubkey));
    return hash;
  }
*/
const compute_node_id_short = async (pk: Buffer): Promise<Buffer> => {
  const baData = new Uint8Array(36);
  const bufMagic = Buffer.from([0xc6, 0xb4, 0x13, 0x48]);

  baData.set(bufMagic, 0);
  baData.set(pk, 4);

  const baNodeId = await TonRocks.utils.sha256(baData);
  const bufNodeId = Buffer.from(baNodeId);

  return bufNodeId;
};

export type TSignature = {
  node_id: string;
  r: string;
  s: string;
};

class ByteArray {
  public constructor(private buf: Buffer) {
    //
  }

  public static from(
    data: string | Buffer,
    encoding?: BufferEncoding,
  ): ByteArray {
    let buf: Buffer | null = null;

    if (data instanceof Buffer) {
      buf = data;
    } else {
      if (encoding) {
        buf = Buffer.from(data, encoding);
      } else if (data.startsWith('0x')) {
        buf = Buffer.from(data.slice(2), 'hex');
      } else {
        buf = Buffer.from(data);
      }
    }

    if (!buf) {
      throw new Error('');
    }
    return new ByteArray(buf);
  }

  public concat(ba: ByteArray[]) {
    // ba.push()
    return new ByteArray(
      Buffer.concat([this.buf, ..._.map(ba, ({ buf }) => buf)]),
    );
  }

  public toString(
    encoding?: BufferEncoding,
    start?: number,
    end?: number,
  ): string {
    return this.buf.toString(encoding, start, end);
  }

  public toJSON() {
    return this.toString('hex');
  }
}

export class ByteArray32 extends ByteArray {
  public static from(
    data: string | Buffer,
    encoding?: BufferEncoding,
  ): ByteArray {
    if (_.isString(data) && data.length < 64) {
      return new ByteArray(Buffer.from(data as string, 'base64'));
    }

    return super.from(data, encoding);
  }

  public constructor(buf: Buffer) {
    super(buf);
  }
}

// /*
//   shard_ident$00 shard_pfx_bits:(#<= 60)
//     workchain_id:int32 shard_prefix:uint64 = ShardIdent;
// */
// type TShardIdent = {
//   shard_pfx_bits: TBN; // uint64 // dec
//   workchain_id: number; // uint32
//   shard_prefix: TBN; // uint64 // dec
// };
// class ShardIdent {
//   public static from(data: TExtBlkRef) {
//     const endLt = data.end_lt;
//     const seqNo = data.seq_no;
//     const rootHash = ByteArray32.from(data.root_hash, 'hex');
//     const fileHash = ByteArray32.from(data.file_hash, 'hex');

//     return new ShardIdent(
//       endLt,
//       seqNo,
//       rootHash,
//       fileHash,
//     );
//   }

//   public static fromJSON(data: TExtBlkRef) {
//     const endLt = new BN(data.end_lt);
//     const seqNo = data.seq_no;
//     const rootHash = ByteArray32.from(data.root_hash, 'base64');
//     const fileHash = ByteArray32.from(data.file_hash, 'base64');

//     return new ExtBlkRef(
//       endLt,
//       seqNo,
//       rootHash,
//       fileHash,
//     );
//   }

//   protected constructor(
//     private endLt: TBN, // uint64
//     private seqNo: number, // uint32
//     private rootHash: ByteArray32, // bits256
//     private fileHash: ByteArray32, // bits256
//   ) {}

//   public get EndLt() { return this.endLt; }
//   public get SeqNo() { return this.seqNo; }
//   public get RootHash() { return this.rootHash; }
//   public get FileHash() { return this.fileHash; }

// }

/*
  ext_blk_ref$_ end_lt:uint64
    seq_no:uint32 root_hash:bits256 file_hash:bits256
    = ExtBlkRef;
*/
type TExtBlkRef = {
  end_lt: TBN; // uint64 // dec
  seq_no: number; // uint32
  root_hash: string; // bits256 // base64
  file_hash: string; // bits256 // base64
};
export class ExtBlkRef {
  public static from(data: TExtBlkRef) {
    const endLt = data.end_lt;
    const seqNo = data.seq_no;
    const rootHash = ByteArray32.from(data.root_hash, 'hex');
    const fileHash = ByteArray32.from(data.file_hash, 'hex');

    return new ExtBlkRef(endLt, seqNo, rootHash, fileHash);
  }

  public static fromJSON(data: TExtBlkRef) {
    const endLt = new BN(data.end_lt);
    const seqNo = data.seq_no;
    const rootHash = ByteArray32.from(data.root_hash, 'base64');
    const fileHash = ByteArray32.from(data.file_hash, 'base64');

    return new ExtBlkRef(endLt, seqNo, rootHash, fileHash);
  }

  protected constructor(
    private endLt: TBN, // uint64
    private seqNo: number, // uint32
    private rootHash: ByteArray32, // bits256
    private fileHash: ByteArray32, // bits256
  ) {}

  public get EndLt() {
    return this.endLt;
  }
  public get SeqNo() {
    return this.seqNo;
  }
  public get RootHash() {
    return this.rootHash;
  }
  public get FileHash() {
    return this.fileHash;
  }
}

/*
  shard_ident$00 shard_pfx_bits:(#<= 60)
    workchain_id:int32 shard_prefix:uint64 = ShardIdent;

  block_id_ext$_ shard_id:ShardIdent seq_no:uint32
    root_hash:bits256 file_hash:bits256 = BlockIdExt;

    "workchain": -1,
    "shard": "-9223372036854775808",
    "seqno": 4351353,
    "root_hash": "7yuHNSh1c3xENGt1iMt5m2ynwQ5HAVUVAm8DX+i2pcc=",
    "file_hash": "99APoJBFOQqo1MvRz/dQHpl9fGKrbWADrVj3iwEKbYA="

*/
export class CDataType<T> {
  protected constructor(private value: T) {
    //
  }
  public get Value() {
    return this.value;
  }
}

export class CWorkchain extends CDataType<number> {
  public static fromJSON(data: number) {
    return new CWorkchain(data);
  }

  public toJSON() {
    return this.Value;
  }

  public asNumber() {
    return this.Value;
  }
}

type TBlockIdExt = {
  // shard_id: ShardIdent;
  workchain: number;
  shard: string;
  seqno: number; // uint32
  root_hash: string; // bits256 // base64
  file_hash: string; // bits256 // base64
  // } & {
  //   workchain: number;
  //   shard: string;
  //   seqNo: number; // uint32
  //   rootHash: string; // bits256 // hex
  //   fileHash: string; // bits256 // hex
};
export class BlockIdExt {
  // public static from(data: TBlockIdExt) {
  //   // const endLt = data.end_lt;
  //   const seqNo = data.seq_no;
  //   const rootHash = ByteArray32.from(data.root_hash, 'hex');
  //   const fileHash = ByteArray32.from(data.file_hash, 'hex');

  //   return new BlockIdExt(
  //     // endLt,
  //     seqNo,
  //     rootHash,
  //     fileHash,
  //   );
  // }

  public static fromJSON(data: TBlockIdExt) {
    // console.log(data);
    // const endLt = new BN(data.end_lt);
    const workchain = CWorkchain.fromJSON(data.workchain);
    const shard = new BN(data.shard).abs();
    const seqNo = data.seqno || (data as any).seqNo;
    const rootHash = ByteArray32.from(data.root_hash || (data as any).rootHash);
    const fileHash = ByteArray32.from(data.file_hash || (data as any).fileHash);

    return new BlockIdExt(
      workchain,
      shard,
      // endLt,
      seqNo,
      rootHash,
      fileHash,
    );
  }

  protected constructor(
    // private shardId: ShardIdent,
    private workchain: CWorkchain,
    private shard: TBN,

    private seqNo: number, // uint32
    private rootHash: ByteArray32, // bits256
    private fileHash: ByteArray32, // bits256
  ) {}

  // public get ShardId() { return this.shardId; }
  // public get Workchain() { return this.workchain.Value; }
  public get Workchain() {
    return this.workchain;
  }
  public get Shard() {
    return this.shard;
  }
  public get SeqNo() {
    return this.seqNo;
  }
  public get RootHash() {
    return this.rootHash;
  }
  public get FileHash() {
    return this.fileHash;
  }

  /*
  const toSign = new MsgBlock(
    // ByteArray32.from(idValSet.root_hash, 'base64'),
    bieIdValSet.RootHash,
    // ByteArray32.from(idValSet.file_hash, 'base64'),
    bieIdValSet.FileHash,
  );
  */
  private msgToSign: MsgBlock | undefined;
  public get MsgToSign(): MsgBlock {
    if (!this.msgToSign) {
      const { rootHash, fileHash } = this;
      this.msgToSign = new MsgBlock(rootHash, fileHash);
    }
    return this.msgToSign;
  }

  /*
    "workchain": -1,
    "shard": "8000000000000000",
    "seqNo": 4350531,
    "rootHash": {
    "fileHash": {
  */
  public toJSON(format: 'normal' | 'toncenter' = 'normal') {
    if (format == 'toncenter') {
      return {
        workchain: this.workchain.toJSON(),
        shard: '-9223372036854775808', // this.shard.toJSON(),
        seqno: this.seqNo, // .toJSON(),
        root_hash: this.rootHash.toJSON(),
        file_hash: this.fileHash.toJSON(),
      };
    }

    return {
      workchain: this.workchain.toJSON(),
      shard: this.shard.toJSON(),
      seqNo: this.seqNo, // .toJSON(),
      rootHash: this.rootHash.toJSON(),
      fileHash: this.fileHash.toJSON(),
    };
  }

  public toString(format: 'normal' | 'lite-client' = 'normal') {
    if (format == 'lite-client') {
      const w = this.Workchain.asNumber();
      const sh = this.shard.toString(16);
      const sn = this.SeqNo;
      const rh = this.RootHash.toString('hex');
      const fh = this.FileHash.toString('hex');

      return `(${w},${sh},${sn}):${rh}:${fh}`;
    }

    // return super.toString();
    return Object.toString.apply(this);
  }
}

class Signature {
  public static fromData({ node_id, r, s }: TSignature) {
    // const { node_id, r, s } = data;
    return new Signature(
      ByteArray32.from(node_id, 'hex'),
      ByteArray32.from(r, 'hex'),
      ByteArray32.from(s, 'hex'),
    );
  }

  public get NodeId() {
    return this.nodeId;
  }
  public get R() {
    return this.r;
  }
  public get S() {
    return this.s;
  }

  constructor(
    private nodeId: ByteArray32,
    private r: ByteArray32,
    private s: ByteArray32,
  ) {
    //
  }
}

class Message {
  public constructor(private _message: ByteArray) {
    // super();
  }

  public toString(
    encoding?: BufferEncoding,
    start?: number,
    end?: number,
  ): string {
    return this._message.toString(encoding, start, end);
  }

  public verify(validators: ValidatorSet, signatures: TSignature[]): TBN {
    const bnSignedWeight = new TonRocks.utils.BN();
    for (let j = 0; j < signatures.length; j++) {
      const signature = Signature.fromData(signatures[j]);
      /*
      const signature = signatures[j];
      const bufSignature = Buffer.from(signature.r + signature.s, 'hex');
      const baSignature = new Uint8Array(bufSignature);
      */

      // const val = valSet.list[signature.node_id];
      // const nodeId = ByteArray32.from(signature.node_id, 'hex');
      const val = validators.findById(signature.NodeId);
      if (!val) {
        throw new Error(
          'Can`t find public key for node_id: ' +
            signature.NodeId.toString('hex'),
        );
      }

      /*
      const baPubKey = new Uint8Array(val.pubKey);
      const res = nacl.sign.detached.verify(baMsgToSign, baSignature, baPubKey);
      if (!res)
        throw Error('signature check failed');
      */
      val.verify(this, signature);

      bnSignedWeight.iadd(val.Weight);

      // console.log(
      //   val.pubKey.toString('hex'),
      //   val.weight.toString(10, 18),
      //   bnSignedWeight.toString(10, 18),
      // );
      // if (bnSignedWeight.gt(valSet.totalWeight)) {
      //   break;
      // }
    }
    return bnSignedWeight;
  }
}

export class MsgBlock extends Message {
  // 0xc50b6e70
  // private static _magic = Buffer.from([0x70, 0x6e, 0x0b, 0xc5]);
  private static _magic = ByteArray.from('0x706e0bc5');

  public constructor(rootHash: ByteArray32, fileHash: ByteArray32) {
    super(MsgBlock._magic.concat([rootHash, fileHash]));
  }
}

type TValidatorDesc = {
  weight: TBN;
  public_key: { pubkey: Uint8Array };
};

// interface IValidatorItem {
//   weight: TBN;
//   pubKey: Buffer;
// }
// type TValidatorRecord = Record<string, IValidatorItem>;

type TValidatorSet = {
  total: TBN;
  main: TBN;
  total_weight: TBN;
  list: { map: Map<string, TValidatorDesc> };
};

class Validator {
  public static async fromData({
    public_key,
    weight,
  }: TValidatorDesc): Promise<Validator> {
    const pubKey = Buffer.from(public_key.pubkey);
    const bufNodeIdShort = await compute_node_id_short(pubKey);
    // const { node_id, r, s } = data;
    return new Validator(
      ByteArray32.from(bufNodeIdShort),
      ByteArray32.from(pubKey),
      weight,
    );
  }

  protected constructor(
    private nodeId: ByteArray32,
    private pubKey: ByteArray32,
    private weight: TBN,
  ) {
    //
  }

  public get Weight() {
    return this.weight;
  }
  public get PubKey() {
    return this.pubKey;
  }
  public get NodeId() {
    return this.nodeId;
  }

  public verify(msg: Message, sig: Signature) {
    //
  }
}

type TValidatorRecord = Record<string, Validator>;

export class ValidatorSet {
  public static async from(validators: TValidatorSet) {
    const res: Validator[] = [];

    // console.log( validators.list );
    for (const { weight, public_key } of validators.list.map.values()) {
      res.push(await Validator.fromData({ weight, public_key }));
    }

    return new ValidatorSet(res, validators.main, validators.total_weight);
  }

  private map: TValidatorRecord;

  protected constructor(
    validators: Validator[],
    private mainValidators: number,
    private totalWeight: TBN,
  ) {
    this.map = _.reduce(
      validators,
      (m, v) => {
        m[v.NodeId.toString('hex')] = v;
        return m;
      },
      <TValidatorRecord>{},
    );
  }

  protected buildMainValidatorSet(): ValidatorSet {
    const res: Validator[] = [];
    // const topList: TValidatorRecord = {};

    const sorted = _.sortBy(
      //   _.map(val, (v, nodeId) => ({ ...v, nodeId })),
      _.values(this.map),
      [(v) => v.Weight.toString(16, 16)],
    );

    _.each(_.takeRight(sorted, this.mainValidators), (v) => res.push(v));

    // return topList;

    // const listMain = getTop(valSet.list, valSet.main);
    const mainWeight = _.reduce(res, (a, v) => a.add(v.Weight), new BN(0));
    // const totalWeight = _.reduce(valSet.list, (a, { weight }) => a.add(weight), new BN(0));

    return new ValidatorSet(res, this.mainValidators, mainWeight);
  }

  public get TotalWeight() {
    return this.totalWeight;
  }

  private main: ValidatorSet | null = null;
  public get Main(): ValidatorSet {
    if (!this.main) {
      this.main = this.buildMainValidatorSet();
    }
    return this.main;
  }

  public toJSON() {
    return {
      mainValidators: this.mainValidators,
      totalWeight: this.totalWeight.toString(16),
      validators: _.values(this.map),
    };
  }

  public findById(nodeId: ByteArray32): Validator | undefined {
    return this.map[nodeId.toString('hex')];
  }
}

// "lt": "5302299000003",
// "hash": "Tdi1I58XUdrSq4BROzQ7ftD/JnxGyxhFz3THZtZ+D8A="
export type TInternalTransactionId = {
  lt: TBN;
  hash: string;
};

class CStringDataType extends CDataType<string> {
  public asString() {
    return this.Value;
  }
  public toString() {
    return this.Value;
  }
}

class CBase64String extends CStringDataType {
  public static from(data: string) {
    return new CBase64String(data);
  }
}

class CRawAddressString extends CStringDataType {
  public static from(data: string) {
    return new CRawAddressString(data);
  }

  public asAddress() {
    const addr = new TonRocks.types.Address(this.Value);
    return new CAddress(
      CWorkchain.fromJSON(addr.wc),
      ByteArray32.from(Buffer.from(addr.hashPart)),
    );
  }
}

export class CFriendlyAddressString extends CStringDataType {
  public static from(data: string) {
    return new CFriendlyAddressString(data);
  }

  public parse(): {
    workchain: CWorkchain;
    hashPart: ByteArray32;
  } {
    const addr = new TonRocks.types.Address(this.Value);
    return {
      // isTestOnly,
      // isBounceable,
      workchain: CWorkchain.fromJSON(addr.wc),
      hashPart: ByteArray32.from(Buffer.from(addr.hashPart)),
    };
  }

  public asAddress() {
    return CAddress.from(this);
  }
}

export class CAddress {
  public static from(data: CFriendlyAddressString) {
    const { workchain, hashPart } = data.parse();
    return new CAddress(workchain, hashPart);
  }

  public static fromJSON(
    data: string,
    format: 'friendly' | 'raw' = 'friendly',
  ) {
    // const { workchain, hashPart } = data.parse();
    if (format == 'friendly') {
      return CFriendlyAddressString.from(data).asAddress();
    }

    return CRawAddressString.from(data).asAddress();
  }

  public constructor(private workchain: CWorkchain, private hash: ByteArray32) {
    //
  }

  public get Workchain() {
    return this.workchain;
  }
  public get Hash() {
    return this.hash;
  }

  public asRaw() {
    const wc = this.workchain.asNumber();
    const hash = this.hash.toString('hex');
    return CRawAddressString.from(`${wc}:${hash}`);
  }
}

export class InternalTransactionId {
  public static fromJSON(data: TInternalTransactionId) {
    const lt = new BN(data.lt);
    // const hash = ByteArray32.from(data.hash, 'base64');
    const hash = ByteArray32.from(data.hash, 'hex');

    return new InternalTransactionId(lt, hash);
  }

  protected constructor(
    private lt: TBN,
    private hash: ByteArray32, // bits256
  ) {}

  public get Lt() {
    return this.lt;
  }
  public get Hash() {
    return this.hash;
  }

  public toJSON() {
    const lt = this.Lt.toString(/* 10 | 'hex' */);
    const hash = this.Hash.toString('hex');

    return { lt, hash };
  }

  public toString() // format: ('normal' | 'lite-client') = 'normal'
  {
    // if ( format == 'lite-client' ) {
    const { lt, hash } = this.toJSON();

    return `${hash} ${lt}`;
  }
}
