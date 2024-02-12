import { allForks, deneb, ssz } from "@lodestar/types";

import { blockToLightClientHeader } from './utils.js';

import type {
  TFinalityUpdate,
  TAllForksBlock,
  TOptimisticUpdate,
} from './types.js';


export class DBWrapper {
  async handleBlockAsOptimisticUpdate(block: TAllForksBlock): Promise<TOptimisticUpdate> {
    const data = {
      attestedHeader: blockToLightClientHeader(
        block.version,
        block.data.message as allForks.AllForksLightClient["BeaconBlock"],
      ),
    } as deneb.LightClientOptimisticUpdate;

    const update: TOptimisticUpdate = {
      data,
      version: block.version,
    };
    await this.handleUpdate(update);

    return update
  }

  private idxByHash: Record<string, TFinalityUpdate | TOptimisticUpdate> = {};
  private idxSlot: Record<number, TFinalityUpdate | TOptimisticUpdate> = {};
  private idxSlotFinalized: Record<number, TFinalityUpdate> = {};
  private idxNextByPrev: Record<string, TFinalityUpdate | TOptimisticUpdate> = {};
  async handleUpdate(update: TFinalityUpdate | TOptimisticUpdate) {
    const strRoot = Buffer.from(
      ssz.phase0.BeaconBlockHeader.hashTreeRoot(
        update.data.attestedHeader.beacon,
      ),
    ).toString('hex');

    const strParentRoot = Buffer.from(
      update.data.attestedHeader.beacon.parentRoot,
    ).toString('hex');

    this.idxByHash[strRoot] = update;
    this.idxNextByPrev[strParentRoot] = update;
    this.idxSlot[update.data.attestedHeader.beacon.slot] = update;
    if ( (update as TFinalityUpdate).data.finalizedHeader ) {
      this.idxSlotFinalized[
        (update as TFinalityUpdate).data.finalizedHeader.beacon.slot
      ] = update as TFinalityUpdate;
    }
  }

  async findBySlot(slot: number): Promise<TFinalityUpdate | TOptimisticUpdate> {
    return this.idxSlot[slot];
  }

  async findByHash(hash: Buffer): Promise<TFinalityUpdate | TOptimisticUpdate> {
    const strRoot = hash.toString('hex');
    const upd = this.idxByHash[strRoot];
    return upd;
  }

  async findNext(hash: Buffer): Promise<TFinalityUpdate | TOptimisticUpdate> {
    const strRoot = hash.toString('hex');
    const upd = this.idxNextByPrev[strRoot];
    return upd;
  }
}
