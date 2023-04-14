/* eslint-disable @typescript-eslint/ban-ts-comment */
import _ from 'lodash';

// @ts-ignore
import TonRocks from '../ton-rocks-js';

import { BlockIdExt, ByteArray32 } from '../ton-types';
import { buildProof } from '../block-utils';
import { BocProvider } from '../boc-provider';

import { AProofStep } from './a-proof-step';

import type { TSignature } from '../ton-types';
import type { IStateUpdate, TProofState, TProofStateType } from './base-types';

export class PSNewStateHash extends AProofStep {
  public static TypeName: TProofStateType = 'state-hash' as const;
  public get TypeName() {
    return PSNewStateHash.TypeName;
  }

  static fromJSON(p: TProofState): PSNewStateHash {
    if (p.type != PSNewStateHash.TypeName) {
      throw new Error('Incorrect type');
    }
    const { id, signatures } = p as any;
    const blockIdExt = BlockIdExt.fromJSON(id);
    return new PSNewStateHash(blockIdExt, p.boc, signatures);
  }

  public static async fromBlock(blockId: BlockIdExt, signatures: TSignature[]) {
    const rootMasterBoc = await BocProvider.Instance.getBlockByFileHash(
      blockId.FileHash,
    );

    const p = [rootMasterBoc, rootMasterBoc.refs[2]];
    const pr = await buildProof(p, false, false);
    await pr.finalizeTree();

    const bocProof = await pr.toBoc(true);
    const hexBoc = Buffer.from(bocProof).toString('hex');

    return new PSNewStateHash(blockId, hexBoc, signatures);
  }

  protected constructor(
    public blockIdExt: BlockIdExt,
    boc: string | string[],
    public signatures: TSignature[],
  ) {
    super(boc);
  }

  public async check(state: IStateUpdate = {}): Promise<IStateUpdate> {
    const c = await TonRocks.types.Cell.fromBoc(this.boc);
    const b = TonRocks.bc.BlockParser.parseBlock(c[0]);
    const stateHash = ByteArray32.from(Buffer.from(b.state_update.new_hash));
    return { stateHash };
  }

  public toJSON(): TProofState {
    const { signatures } = this;
    const id = this.blockIdExt.toJSON();
    return { ...super.toJSON(), id, signatures } as TProofState;
  }
}
