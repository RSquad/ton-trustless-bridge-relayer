import type { IStateUpdate, TProofState, TProofStateType } from './base-types.js';

export abstract class AProofStep {
  public abstract get TypeName(): TProofStateType;
  public abstract check(state: IStateUpdate): Promise<IStateUpdate>;

  protected constructor(public boc: string | string[]) {
    //
  }

  public toJSON(): TProofState {
    const { boc } = this;
    const type = this.TypeName;
    return { type, boc };
  }
}
