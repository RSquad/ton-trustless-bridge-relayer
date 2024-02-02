/* eslint-disable @typescript-eslint/ban-ts-comment */
import _ from 'lodash';

import TonRocks from '../ton-rocks-js/index.js';
import { ExtBlkRef } from '../ton-types/index.js';

import { AProofStep } from './a-proof-step.js';

import type { IStateUpdate, TProofState, TProofStateType } from './base-types.js';

export class PSShardBlock extends AProofStep {
  public static TypeName: TProofStateType = 'shard-block' as const;
  public get TypeName() {
    return PSShardBlock.TypeName;
  }

  static fromJSON(p: TProofState) {
    if (p.type != PSShardBlock.TypeName) {
      throw new Error('Incorrect type');
    }

    return new PSShardBlock(p.boc);
  }

  public static async fromProof(proof: string) {
    return new PSShardBlock(Buffer.from(proof, 'base64').toString('hex'));
  }

  public async check(state: IStateUpdate = {}): Promise<IStateUpdate> {
    const cellsProofRoot = await TonRocks.types.Cell.fromBoc(this.boc);

    const hexBlockId = Buffer.from(
      cellsProofRoot[0].refs[0].getHash(),
    ).toString('hex');

    const blkRef = state.blkRefs?.find((ref) => {
      const hexRootHash = Buffer.from(ref.root_hash).toString('hex');
      const res = hexBlockId == hexRootHash;
      return res;
    });
    if (!blkRef) {
      throw new Error('Unknown blkRef');
    }

    const b = TonRocks.bc.BlockParser.parseBlock(cellsProofRoot[0].refs[0]);
    return {
      blkRefs: [
        ExtBlkRef.fromJSON(b.extra.custom.shard_hashes.map.get('0').leaf),
      ],
    };
  }
}
