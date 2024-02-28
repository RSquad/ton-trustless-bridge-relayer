import _ from 'lodash';

import { AProofStep } from './a-proof-step.js';
import { PSSetValidators } from './ps-set-validators.js';
import { PSProofValidators } from './ps-proof-validators.js';
import { PSShardState } from './ps-shard-state.js';
import { PSShardBlock } from './ps-shard-block.js';
import { PSNewStateHash } from './ps-new-state-hash.js';
import { PSTransaction } from './ps-transaction.js';

import type { TProofState } from './base-types.js';

export class ProvenState {
  private steps: AProofStep[] = [];
  private proofState: any = {};

  public static createStepFromJSON(data: TProofState): AProofStep {
    if (data.type == 'set-validators') {
      return PSSetValidators.fromJSON(data);
    } else if (data.type == 'proof-validators') {
      return PSProofValidators.fromJSON(data);
    } else if (data.type == 'shard-state') {
      return PSShardState.fromJSON(data);
    } else if (data.type == 'shard-block') {
      return PSShardBlock.fromJSON(data);
    } else if (data.type == 'state-hash') {
      return PSNewStateHash.fromJSON(data);
    } else if (data.type == 'tx-proof') {
      return PSTransaction.fromJSON(data);
    }

    throw new Error('Unknown step type');
  }

  public static async fromJSON(data: TProofState[]) {
    const steps = data.map((p) => ProvenState.createStepFromJSON(p));
    const self = new ProvenState();

    for (const st of steps) {
      await self.add(st);
    }

    return self;
  }

  public async add(step: AProofStep) {
    const stateUpdate = await step.check(this.proofState);

    if (stateUpdate.validators) {
      this.proofState.validators = stateUpdate.validators;
      // console.log(this.proofState.validators);
    }
    if (stateUpdate.stateHash) {
      this.proofState.stateHash = stateUpdate.stateHash;
    }
    if (stateUpdate.blkRefs) {
      if (!this.proofState.blkRefs) {
        this.proofState.blkRefs = [];
      }
      this.proofState.blkRefs.push(...stateUpdate.blkRefs);
    }

    this.steps.push(step);
  }

  public toJSON(): TProofState[] {
    return this.steps.map((st) => st.toJSON());
  }
}
