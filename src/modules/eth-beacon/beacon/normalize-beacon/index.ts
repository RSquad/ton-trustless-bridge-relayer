import { TOptimisticUpdate } from "../types.js";
import { allForks, deneb, ssz } from "@lodestar/types";

export interface IBeacon {
  slot: number;
  proposerIndex: number;
  parentRoot: string;
  stateRoot: string;
  bodyRoot: string;
  selfHash: string;
}

export interface IExecution {
  parentHash: string;
  feeRecipient: string;
  stateRoot: string;
  receiptsRoot: string;
  logsBloom: string;
  prevRandao: string;
  blockNumber: number;
  gasLimit: number;
  gasUsed: number;
  timestamp: number;
  extraData: string;
  baseFeePerGas: string;
  blockHash: string;
  transactionsRoot: string;
  withdrawalsRoot: string;
}

export function normalizeBeacon(update: TOptimisticUpdate): IBeacon {
  const beacon = update.data.attestedHeader.beacon;

  const strRoot = Buffer.from(
    ssz.phase0.BeaconBlockHeader.hashTreeRoot(
      update.data.attestedHeader.beacon,
    ),
  ).toString('hex');

  return {
    slot: beacon.slot,
    proposerIndex: beacon.proposerIndex,
    parentRoot: '0x' + Buffer.from(beacon.parentRoot).toString('hex'),
    stateRoot: '0x' + Buffer.from(beacon.stateRoot).toString('hex'),
    bodyRoot: '0x' + Buffer.from(beacon.bodyRoot).toString('hex'),
    selfHash: '0x' + strRoot,
  }
}

export function normalizeExecution(update: TOptimisticUpdate): IExecution {
  const execution = update.data.attestedHeader.execution;

  return {
    parentHash: '0x' + Buffer.from(execution.parentHash).toString('hex'),
    feeRecipient: '0x' + Buffer.from(execution.feeRecipient).toString('hex'),
    stateRoot: '0x' + Buffer.from(execution.stateRoot).toString('hex'),
    receiptsRoot: '0x' + Buffer.from(execution.receiptsRoot).toString('hex'),
    logsBloom: '0x' + Buffer.from(execution.logsBloom).toString('hex'),
    prevRandao: '0x' + Buffer.from(execution.prevRandao).toString('hex'),
    blockNumber: execution.blockNumber,
    gasLimit: execution.gasLimit,
    gasUsed: execution.gasUsed,
    timestamp: execution.timestamp,
    extraData: '0x' + Buffer.from(execution.extraData).toString('hex'),
    baseFeePerGas: execution.baseFeePerGas.toString(),
    blockHash: '0x' + Buffer.from(execution.blockHash).toString('hex'),
    transactionsRoot: '0x' + Buffer.from(execution.transactionsRoot).toString('hex'),
    withdrawalsRoot: '0x' + Buffer.from(execution.withdrawalsRoot).toString('hex'),
  }
}

export function normalizeExecutionBranch(update: TOptimisticUpdate) {
  const executionBranch = update.data.attestedHeader.executionBranch.map(branch => '0x' + Buffer.from(branch).toString('hex'));
  return executionBranch;
}
