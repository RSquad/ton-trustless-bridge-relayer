/* eslint-disable @typescript-eslint/ban-ts-comment */
import _ from 'lodash';

import TonRocks from '../ton-rocks-js/index.js';

import { buildProof } from '../block-utils.js';

import { AProofStep } from './a-proof-step.js';

import type { IStateUpdate, TProofState, TProofStateType } from './base-types.js';
import { BlockIdExt } from '../ton-types/index.js';

const collectLeafs = (
  root: TonRocks.types.Cell,
): Array<TonRocks.types.Cell[]> => {
  if (root.isExotic || 0 == root.refs.length) {
    return [[root]];
  }

  let res: Array<TonRocks.types.Cell[]> = [];
  root.refs.forEach((ref: TonRocks.types.Cell) => {
    if (!ref.isExotic) {
      res = res.concat(collectLeafs(ref));
    }
  });
  res.forEach((a) => a.unshift(root));

  return res;
};

export class PSShardState extends AProofStep {
  public static TypeName: TProofStateType = 'shard-state' as const;
  public get TypeName() {
    return PSShardState.TypeName;
  }
  static fromJSON(p: TProofState) {
    if (p.type != PSShardState.TypeName) {
      throw new Error('Incorrect type');
    }

    const { id } = p as any;
    const blockIdExt = BlockIdExt.fromJSON(id);
    return new PSShardState(blockIdExt, p.boc);
  }

  public static async fromProof(blockId: BlockIdExt, proof: string) {
    const state_proof = (
      await TonRocks.types.Cell.fromBoc(Buffer.from(proof, 'base64'))
    )[0];

    const leafs = _.sortBy(collectLeafs(state_proof.refs[0]), [
      (p) => -p.length,
    ]);

    // ahmn_leaf#_ {X:Type} {Y:Type} extra:Y value:X = HashmapAugNode 0 X Y;
    // _ (HashmapAugE 32 KeyExtBlkRef KeyMaxLt) = OldMcBlocksInfo;
    // const { loadKeyExtBlkRef, loadKeyMaxLt } = TonRocks.bc.BlockParser;
    // const leaf = leafs[1][leafs[1].length - 1];
    // const t = { cs: 2, ref: 0 };
    // const dataKeyMaxLt = loadKeyMaxLt(leaf, t);
    // const dataKeyExtBlkRef = loadKeyExtBlkRef(leaf, t);

    const proofState = await buildProof(leafs[1], false, false);
    await proofState.finalizeTree();

    const bocProofState = await proofState.toBoc(true);
    const hexBoc = Buffer.from(bocProofState).toString('hex');

    return new PSShardState(blockId, hexBoc);
  }

  protected constructor(public blockIdExt: BlockIdExt, boc: string | string[]) {
    super(boc);
  }

  public async check(state: IStateUpdate = {}): Promise<IStateUpdate> {
    const b = TonRocks.bc.BlockParser.parseShardState(
      (await TonRocks.types.Cell.fromBoc(this.boc))[0],
    );

    const blkRef = b.custom.prev_blocks.map.get(
      this.blockIdExt.SeqNo.toString(16),
    ).value.blk_ref;

    return { blkRefs: [blkRef] };
  }

  public toJSON(): TProofState {
    const id = this.blockIdExt.toJSON();
    return {
      ...super.toJSON(),
      id,
    } as TProofState;
  }
}
