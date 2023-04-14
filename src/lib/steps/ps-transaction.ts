/* eslint-disable @typescript-eslint/ban-ts-comment */
import _ from 'lodash';

// @ts-ignore
import TonRocks from '../ton-rocks-js';

import { BocProvider } from '../boc-provider';
import {
  BlockIdExt,
  CAddress,
  ExtBlkRef,
  InternalTransactionId,
} from '../ton-types';
import { buildPath, buildProof } from '../block-utils';

import { AProofStep } from './a-proof-step';

import type { IStateUpdate, TProofState, TProofStateType } from './base-types';

export class PSTransaction extends AProofStep {
  public static TypeName: TProofStateType = 'tx-proof' as const;
  public get TypeName() {
    return PSTransaction.TypeName;
  }

  static fromJSON(p: TProofState) {
    if (p.type != PSTransaction.TypeName) {
      throw new Error('Incorrect type');
    }

    const { txBoc, addr, txId } = p as any;
    const addrTxAccount = CAddress.fromJSON(addr, 'raw');
    return new PSTransaction(
      p.boc,
      addrTxAccount,
      InternalTransactionId.fromJSON(txId),
      txBoc,
    );
  }

  public static async fromBlock(
    boc: string,
    txId: InternalTransactionId,
    addrTxAccount: CAddress,
  ) {
    const rootTxBoc = await BocProvider.Instance.getBlockByFileHash(boc);

    const p = buildPath(txId.Hash.toString('hex'), rootTxBoc.refs[3].refs[2]);
    if (!p) {
      throw new Error('ups!');
    }
    p.unshift(rootTxBoc.refs[3]);
    p.unshift(rootTxBoc);

    const cellTxBoc = p[p.length - 1];
    const txBoc = await cellTxBoc.toBoc(false);
    const hexTxBoc = Buffer.from(txBoc).toString('hex');

    const proof = await buildProof(p);
    await proof.finalizeTree();
    const bocProof = await proof.toBoc(false);

    const hexBoc = Buffer.from(bocProof).toString('hex');

    return new PSTransaction(hexBoc, addrTxAccount, txId, hexTxBoc);
  }

  protected constructor(
    boc: string | string[],
    public addr: CAddress,
    public txId: InternalTransactionId,
    public txBoc: string,
  ) {
    super(boc);
  }

  public async check(state: IStateUpdate = {}): Promise<IStateUpdate> {
    const cellsProofRoot = await TonRocks.types.Cell.fromBoc(this.boc);
    const hexBlockId = Buffer.from(cellsProofRoot[0].getHash()).toString('hex');

    // const blkRef = state.blkRefs?.find(
    //   (ref: ExtBlkRef | any) =>
    //     hexBlockId ==
    //     (ref instanceof ExtBlkRef
    //       ? ref.RootHash.toString('hex')
    //       : Buffer.from(ref.root_hash).toString('hex')),
    // );
    // if (!blkRef) {
    //   throw new Error('Unknown blkRef');
    // }

    const parsedBlock = TonRocks.bc.BlockParser.parseBlock(cellsProofRoot[0]);
    const cellTx = parsedBlock.extra.account_blocks.map
      .get(this.addr.Hash.toString('hex'))
      .value.transactions.map.get(this.txId.Lt.toString('hex')).value.cell;

    const hexTxId = Buffer.from(cellTx.getHash()).toString('hex');
    if (hexTxId != this.txId.Hash.toString('hex')) {
      throw new Error('Wrong tx hash');
    }

    const cellsTxRoot = await TonRocks.types.Cell.fromBoc(this.txBoc);
    const hexTxRootId = Buffer.from(cellsTxRoot[0].getHash()).toString('hex');
    if (hexTxId != hexTxRootId) {
      throw new Error('Wrong tx root hash');
    }

    return {};
  }

  public toJSON(): TProofState {
    const { txBoc } = this;
    const txId = this.txId.toJSON();
    const addr = this.addr.asRaw().asString();
    return {
      ...super.toJSON(),
      addr,
      txId,
      txBoc,
    } as TProofState;
  }
}
