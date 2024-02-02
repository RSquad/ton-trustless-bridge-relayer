import { ByteArray32, ValidatorSet } from '../ton-types/index.js';

export type TProofStateType =
  | 'set-validators'
  | 'proof-validators'
  | 'state-hash'
  | 'tx-proof'
  | 'shard-block'
  | 'shard-state';

export type TProofState = {
  type: TProofStateType;
  boc: string | string[];
};

export interface IStateUpdate {
  validators?: ValidatorSet;
  stateHash?: ByteArray32;
  blkRefs?: any[];
  // addValidatorSet
}
