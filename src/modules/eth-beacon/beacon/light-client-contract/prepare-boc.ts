import { Base64 } from "@tonconnect/protocol";
import { bytes } from "../../../../lib/evm-data/utils/index.js";
import { Cell, beginCell, Address } from "ton-core";
import { Opcodes } from "../LightClient.js";

export function initOptimisticBoc(beacon: Cell) {
  return Base64.encode(
    beginCell()
      .storeUint(Opcodes.init_beacon, 32)
      .storeUint(0, 64)
      .storeRef(beacon)
      .endCell()
      .toBoc(),
  );
}

export function verifyOptimisticBoc(beacon: Cell, nextHash: string) {
  return Base64.encode(
    beginCell()
      .storeUint(Opcodes.verify_optimistic, 32)
      .storeUint(0, 64)
      .storeBuffer(Buffer.from(nextHash.slice(2), 'hex'))
      .storeRef(beacon)
      .endCell()
      .toBoc(),
  );
}

export function updateReceiptBoc(
  execution: Cell,
  execution_branch: Cell,
  beacon_hash: Cell,
) {
  return Base64.encode(
    beginCell()
      .storeUint(Opcodes.add_execution, 32)
      .storeUint(0, 64)
      .storeRef(execution)
      .storeRef(execution_branch)
      .storeRef(beacon_hash)
      .endCell()
      .toBoc(),
  );
}

export function transformExecutionBranchToCell(branch: string[]) {
  let execution_branch_cell!: Cell;
  for (let i = 0; i < branch.length; i++) {
    const branch_item = branch[i];
    if (!execution_branch_cell) {
      execution_branch_cell = beginCell()
        .storeBuffer(bytes(branch_item))
        .endCell();
    } else {
      execution_branch_cell = beginCell()
        .storeBuffer(bytes(branch_item))
        .storeRef(execution_branch_cell)
        .endCell();
    }
  }
  return execution_branch_cell;
}

export function verifyReceiptBoc(
  receipt: Cell,
  adapterAddr: Address,
  path: Cell,
  receiptProof: Cell,
  beacon_hash: Cell,
) {
  return Base64.encode(
    beginCell()
      .storeUint(Opcodes.verifyProof, 32)
      .storeUint(0, 64)
      .storeRef(receipt)
      .storeRef(
        beginCell().storeAddress(adapterAddr).storeRef(beacon_hash).endCell(),
      )
      .storeRef(path)
      .storeRef(receiptProof)
      .endCell()
      .toBoc(),
  );
}
