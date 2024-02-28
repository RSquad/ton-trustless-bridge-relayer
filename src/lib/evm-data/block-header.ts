import {rlp} from 'ethereumjs-util';


type TBlockHeader = Buffer[];

export class BlockHeader {
  public static fromHex(strHex: string) {
    return new BlockHeader(rlp.decode(Buffer.from(strHex.replace('0x', ''), 'hex')) as any as Buffer[]);
  }

  /** the transaction-Object (if given) */
  transactions: any[] = []

  get parentHash() {return this.raw[0]}
  get uncleHash() {return this.raw[1]}
  get coinbase() {return this.raw[2]}
  get stateRoot() {return this.raw[3]}
  get transactionsTrie() {return this.raw[4]}
  get receiptTrie() {return this.raw[5]}
  get bloom() {return this.raw[6]}
  get difficulty() {return this.raw[7]}
  get number() {return this.raw[8]}
  get gasLimit() {return this.raw[9]}
  get gasUsed() {return this.raw[10]}
  get timestamp() {return this.raw[11]}
  get extra() {return this.raw[12]}
  get sealedFields() {return this.raw.slice(13)}

  protected constructor(
    // the raw Buffer fields of the BlockHeader
    private raw: TBlockHeader,
  ) {
    //
  }
}
