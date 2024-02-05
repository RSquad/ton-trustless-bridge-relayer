import { Tree } from "@chainsafe/persistent-merkle-tree";
import { executionPayloadToPayloadHeader } from '@lodestar/state-transition';
import { ssz, allForks } from "@lodestar/types";
import {
  BLOCK_BODY_EXECUTION_PAYLOAD_GINDEX,
  EPOCHS_PER_SYNC_COMMITTEE_PERIOD,
  ForkName,
  ForkSeq,
  ForkExecution,
  SLOTS_PER_EPOCH,
} from "@lodestar/params";

import type { phase0 } from '@lodestar/types';
import type {
  Epoch,
  Slot,
  SyncPeriod,
} from "@lodestar/types";


type TBeaconBlockBody = allForks.AllForksExecutionSSZTypes["BeaconBlockBody"];

function getBlockBodyExecutionHeaderProof(
  fork: ForkExecution,
  body: allForks.AllForksExecution["BeaconBlockBody"],
): Uint8Array[] {
  const bodyView = (
    ssz[fork].BeaconBlockBody as TBeaconBlockBody
  ).toView(body);
  return new Tree(bodyView.node).getSingleProof(
    BigInt(BLOCK_BODY_EXECUTION_PAYLOAD_GINDEX),
  );
}

export function blockToLightClientHeader(
  fork: ForkName,
  block: allForks.AllForksLightClient["BeaconBlock"]
): allForks.LightClientHeader {
  const blockSlot = block.slot;
  const beacon: phase0.BeaconBlockHeader = {
    slot: blockSlot,
    proposerIndex: block.proposerIndex,
    parentRoot: block.parentRoot,
    stateRoot: block.stateRoot,
    bodyRoot: (
      ssz[fork].BeaconBlockBody as allForks.AllForksLightClientSSZTypes["BeaconBlockBody"]
    ).hashTreeRoot(
      block.body,
    ),
  };
  if (ForkSeq[fork] >= ForkSeq.capella) {
    const blockBody = block.body as allForks.AllForksExecution["BeaconBlockBody"];
    const execution = executionPayloadToPayloadHeader(ForkSeq[fork], blockBody.executionPayload);
    return {
      beacon,
      execution,
      executionBranch: getBlockBodyExecutionHeaderProof(fork as ForkExecution, blockBody),
    } as allForks.LightClientHeader;
  } else {
    return {beacon};
  }
}

export function fromHexString(hex: string): Uint8Array {
  if (typeof hex !== "string") {
    throw new Error(`hex argument type ${typeof hex} must be of type string`);
  }

  if (hex.startsWith("0x")) {
    hex = hex.slice(2);
  }

  if (hex.length % 2 !== 0) {
    throw new Error(`hex string length ${hex.length} must be multiple of 2`);
  }

  const byteLen = hex.length / 2;
  const bytes = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) {
    const byte = parseInt(hex.slice(i * 2, (i + 1) * 2), 16);
    bytes[i] = byte;
  }
  return bytes;
}

export function computeEpochAtSlot(slot: Slot): Epoch {
  return Math.floor(slot / SLOTS_PER_EPOCH);
}

export function computeSyncPeriodAtSlot(slot: Slot): SyncPeriod {
  return computeSyncPeriodAtEpoch(computeEpochAtSlot(slot));
}

export function computeSyncPeriodAtEpoch(epoch: Epoch): SyncPeriod {
  return Math.floor(epoch / EPOCHS_PER_SYNC_COMMITTEE_PERIOD);
}
