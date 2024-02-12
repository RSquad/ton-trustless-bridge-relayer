import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  BeaconService,
  getExecutionContainerCell,
  transformBeaconToCell,
} from './beacon.service.js';
import { EthBeaconService } from '../../prisma/services/eth-beacon/eth-beacon.service.js';
import { sleep } from '../../../lib/utils/index.js';
import { Beacon } from '@prisma/client';
import { Address, Builder, Cell, beginCell } from 'ton-core';
import { Opcodes } from './LightClient.js';
import { Base64 } from '@tonconnect/protocol';
import { ConfigService } from '@nestjs/config';
// import { toNumber } from 'ethers/utils';
// import {rlp} from 'ethereumjs-util';
// import { IReceiptJSON, Receipt } from 'src/lib/evm-data/receipt.js';
import { bytes } from '../../../lib/evm-data/utils/index.js';

function initOptimisticBoc(beacon: Cell) {
  return Base64.encode(
    beginCell()
      .storeUint(Opcodes.init_beacon, 32)
      .storeUint(0, 64)
      .storeRef(beacon)
      .endCell()
      .toBoc(),
  );
}

function verifyOptimisticBoc(beacon: Cell) {
  return Base64.encode(
    beginCell()
      .storeUint(Opcodes.verify_optimistic, 32)
      .storeUint(0, 64)
      .storeRef(beacon)
      .endCell()
      .toBoc(),
  );
}

function updateReceiptBoc(
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

function transformExecutionBranchToCell(branch: string[]) {
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

function verifyReceiptBoc(
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

@Controller('beacon')
export class BeaconController {
  constructor(
    private beaconService: BeaconService,
    private beaconDbService: EthBeaconService,
    private configService: ConfigService,
  ) {}

  @Get('getethvalidation/:hash')
  async validateMcBlockByValidator(@Param('hash') hash: string) {
    // const txHash = '0xffbb40166a93097ad35d26d7c59d26c3c1e0f181a9b116bf275b05b5c69457db';
    const receipt = await this.beaconService.getReceiptWithProofByHash(hash);
    // const beacon = await this.beaconDbService.findBySelfHash(hash);
    const update = await this.beaconService.getUpdateByReceipt(hash);
    let gotProof: Beacon[] = [];

    while (!gotProof.length) {
      try {
        gotProof = await this.beaconService.getProofUpdates(update);
      } catch (error) {
        await sleep(5000);
      }
    }

    // TODO: check finality by committee

    const finalityBoc = initOptimisticBoc(transformBeaconToCell(gotProof[0]));
    const optimisticBocs = gotProof.slice(1).map((optimistic) => {
      return verifyOptimisticBoc(transformBeaconToCell(optimistic));
    });

    const currentOptimistic = gotProof[gotProof.length - 1];
    const optimisticExecution = await this.beaconDbService.findExecution(
      currentOptimistic.id,
    );

    const executionBoc = updateReceiptBoc(
      getExecutionContainerCell(optimisticExecution),
      transformExecutionBranchToCell([
        optimisticExecution.executionBranch1,
        optimisticExecution.executionBranch2,
        optimisticExecution.executionBranch3,
        optimisticExecution.executionBranch4,
      ]),
      beginCell()
        .storeBuffer(Buffer.from(currentOptimistic.selfHash))
        .endCell(),
    );

    // const r = Receipt.fromJSON(receipt.receipt as unknown as IReceiptJSON);
    // const cell = r.toCell();

    // const cells = receipt.receiptProof
    //         .map(bytes)
    //         .map((pr) => rlp.decode(pr) as any as Buffer[])
    //         .map((prb) => {
    //             // const data:node_leaf = "data:node_leaf"c; ;; b95a0273
    //             // const data:node_branch = "data:node_branch"c; ;; 40a54ae8
    //             // const data:empty_branch = "data:empty_branch"c; ;; e28eb9cc
    //             // TODO: split big data
    //             let cells: Builder[] = [];
    //             if (prb.length === 17) {
    //                 cells = [beginCell().storeUint(0x40a54ae8, 32)];
    //                 cells = [...cells, ...prb.map((proofPart) => beginCell().storeBuffer(proofPart, proofPart.length))];
    //             }
    //             if (prb.length === 2) {
    //                 let proof_receipt_part = prb[1];
    //                 const proof_receipt_part_builders: Builder[] = [];
    //                 while (proof_receipt_part.length) {
    //                     const part = proof_receipt_part.subarray(0, 32);
    //                     proof_receipt_part_builders.push(beginCell().storeBuffer(part, Math.min(part.length, 32)));
    //                     proof_receipt_part = proof_receipt_part.subarray(32);
    //                 }
    //                 cells = [beginCell().storeUint(0xb95a0273, 32)];
    //                 cells = [...cells, beginCell().storeBuffer(prb[0], prb[0].length), ...proof_receipt_part_builders];
    //             }
    //             if (prb.length === 0) {
    //                 cells = [beginCell().storeUint(0xe28eb9cc, 32)];
    //             }
    //             // cells = prb.map((proofPart) =>
    //             //     beginCell().storeBuffer(proofPart.subarray(0, 32), Math.min(proofPart.length, 32))
    //             // );

    //             for (let i = cells.length - 1; i > 0; i--) {
    //                 if (i < cells.length - 1) {
    //                     cells[i] = cells[i].storeRef(cells[i + 1]);
    //                 }
    //                 cells[i].endCell();
    //             }
    //             return cells[0].storeRef(cells[1]);
    //         });

    //     for (let i = cells.length - 1; i > 0; i--) {
    //         if (i < cells.length - 1) {
    //             cells[i] = cells[i].storeRef(cells[i + 1]);
    //         }
    //         cells[i].endCell();
    //     }
    //     const proofBoc = cells[0].storeRef(cells[1]).endCell();

    // const callVerifyReceit = verifyReceiptBoc(
    //   cell,
    //   Address.parseRaw(
    //     this.configService.getOrThrow<string>('TON_ADAPTER_ADDRESS'),
    //   ),
    //   beginCell()
    //     .storeBuffer(rlp.encode(toNumber(receipt.receipt.transactionIndex)))
    //     .endCell(),
    //     proofBoc,
    //   beginCell()
    //     .storeBuffer(Buffer.from(currentOptimistic.selfHash))
    //     .endCell(),
    // );



    console.warn('END WORKING: ASK FOR RECEIPT');
    // console.log(update)
    return {
      finalityBoc,
      optimisticBocs,
      executionBoc,
      // receiptProofBoc: callVerifyReceit,
      // beacon,
      receipt,
      update,
      proof: gotProof,
    };
  }
}
