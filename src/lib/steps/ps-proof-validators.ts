/* eslint-disable @typescript-eslint/ban-ts-comment */
import _ from 'lodash';

import TonRocks from '../ton-rocks-js/index.js';

import { BocProvider } from '../boc-provider.js';
import { BlockIdExt } from '../ton-types/index.js';

import { AValidatorsProofStep } from './a-validators-proof-step.js';
import { PSSetValidators } from './ps-set-validators.js';

import type { TSignature } from '../ton-types/index.js';
import type { IStateUpdate, TProofState, TProofStateType } from './base-types.js';

const bnTwo = new TonRocks.utils.BN(2);
const bnThree = new TonRocks.utils.BN(3);

export class PSProofValidators extends AValidatorsProofStep {
  public static TypeName: TProofStateType = 'proof-validators' as const;
  public get TypeName() {
    return PSProofValidators.TypeName;
  }

  static fromJSON(p: TProofState) {
    if (p.type != PSProofValidators.TypeName) {
      throw new Error('Incorrect type');
    }

    const { id, signatures } = p as any;
    const blockIdExt = BlockIdExt.fromJSON(id);

    return new PSProofValidators(blockIdExt, p.boc, signatures);
  }

  public static async fromBlock(
    blockIdExt: BlockIdExt,
    boc: string,
    signatures: TSignature[],
  ) {
    const rootValSetBoc = await BocProvider.Instance.getBlockByFileHash(boc);
    const hexBoc = await PSSetValidators.buildValidatorsData(rootValSetBoc);
    return new PSProofValidators(blockIdExt, hexBoc, signatures);
  }

  protected constructor(
    public blockIdExt: BlockIdExt,
    boc: string | string[],
    public signatures: TSignature[],
  ) {
    super(boc);
  }

  public async check(state: IStateUpdate = {}): Promise<IStateUpdate> {
    const res = await super.check();
    const { validators } = res;
    if (!validators) {
      throw new Error('Have no validator set');
    }
    // TODO: REFACTOR
    return res;
    if (!state.validators) {
      throw new Error('Have no validators for check signatures');
    }

    // console.log('to sign:', this.blockIdExt.MsgToSign.toString('hex'));
    const bnSignedWeight = this.blockIdExt.MsgToSign.verify(
      state.validators?.Main,
      this.signatures,
    );

    const bnSignedX3 = bnSignedWeight.mul(bnThree);
    const bnTotalX2 = validators.TotalWeight.mul(bnTwo);
    if (bnSignedX3.lte(bnTotalX2)) {
      throw Error('insufficient total signature weight');
    }

    // console.log('  mainWeight:', validators.Main.TotalWeight.toString(16), validators.Main.TotalWeight.toString());
    // console.log('signedWeight:', bnSignedWeight.toString(16), bnSignedWeight.toString());
    // console.log(' totalWeight:', validators.TotalWeight.toString(16), validators.TotalWeight.toString());

    // const percent = bnSignedWeight
    // .mul(new TonRocks.utils.BN(100))
    // .div(validators.Main.TotalWeight);
    // console.log(`signed with ${ percent.toString(10) }%`);

    return res;
  }

  public toJSON(): TProofState {
    const { signatures } = this;
    const id = this.blockIdExt.toJSON();
    return { ...super.toJSON(), id, signatures } as TProofState;
  }
}
