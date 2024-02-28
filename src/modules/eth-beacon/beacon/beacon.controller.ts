import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  BeaconService,
  getExecutionContainerCell,
  transformBeaconToCell,
} from './beacon.service.js';
import { EthBeaconService } from '../../prisma/services/eth-beacon/eth-beacon.service.js';
import { sleep } from '../../../lib/utils/index.js';
import { Beacon, Execution } from '@prisma/client';
import { Address, Builder, Cell, beginCell } from 'ton-core';
import { Opcodes } from './LightClient.js';
import { Base64 } from '@tonconnect/protocol';
import { ConfigService } from '@nestjs/config';
import { IReceiptJSON, Receipt } from '../../../lib/evm-data/receipt.js';
import { bytes, toNumber } from '../../../lib/evm-data/utils/index.js';
import { rlp } from 'ethereumjs-util';
import {
  initOptimisticBoc,
  verifyOptimisticBoc,
  updateReceiptBoc,
  transformExecutionBranchToCell,
  verifyReceiptBoc,
} from './light-client-contract/prepare-boc.js';
import { TReceiptWithProof } from './nethermind-api.js';

async function prepareReceipt(
  receipt: TReceiptWithProof,
  optimisticHash: string,
  adapterAddress: string,
) {
  const r = Receipt.fromJSON(receipt.receipt as unknown as IReceiptJSON);
  const cell = r.toCell();

  const cells = receipt.receiptProof
    .map(bytes)
    .map((pr) => rlp.decode(pr) as any as Buffer[])
    .map((prb) => {
      // const data:node_leaf = "data:node_leaf"c; ;; b95a0273
      // const data:node_branch = "data:node_branch"c; ;; 40a54ae8
      // const data:empty_branch = "data:empty_branch"c; ;; e28eb9cc
      // TODO: split big data
      let cells: Builder[] = [];
      if (prb.length === 17) {
        cells = [beginCell().storeUint(0x40a54ae8, 32)];
        cells = [
          ...cells,
          ...prb.map((proofPart) =>
            beginCell().storeBuffer(proofPart, proofPart.length),
          ),
        ];
      }
      if (prb.length === 2) {
        let proof_receipt_part = prb[1];
        const proof_receipt_part_builders: Builder[] = [];
        while (proof_receipt_part.length) {
          const part = proof_receipt_part.subarray(0, 32);
          proof_receipt_part_builders.push(
            beginCell().storeBuffer(part, Math.min(part.length, 32)),
          );
          proof_receipt_part = proof_receipt_part.subarray(32);
        }
        cells = [beginCell().storeUint(0xb95a0273, 32)];
        cells = [
          ...cells,
          beginCell().storeBuffer(prb[0], prb[0].length),
          ...proof_receipt_part_builders,
        ];
      }
      if (prb.length === 0) {
        cells = [beginCell().storeUint(0xe28eb9cc, 32)];
      }
      // cells = prb.map((proofPart) =>
      //     beginCell().storeBuffer(proofPart.subarray(0, 32), Math.min(proofPart.length, 32))
      // );

      for (let i = cells.length - 1; i > 0; i--) {
        if (i < cells.length - 1) {
          cells[i] = cells[i].storeRef(cells[i + 1]);
        }
        cells[i].endCell();
      }
      return cells[0].storeRef(cells[1]);
    });

  for (let i = cells.length - 1; i > 0; i--) {
    if (i < cells.length - 1) {
      cells[i] = cells[i].storeRef(cells[i + 1]);
    }
    cells[i].endCell();
  }
  const proofBoc = cells[0].storeRef(cells[1]).endCell();

  const callVerifyReceit = verifyReceiptBoc(
    cell,
    Address.parse(adapterAddress),
    beginCell()
      .storeBuffer(rlp.encode(toNumber(receipt.receipt.transactionIndex)))
      .endCell(),
    proofBoc,
    beginCell()
      .storeBuffer(Buffer.from(optimisticHash.slice(2), 'hex'))
      .endCell(),
  );

  return {
    boc: callVerifyReceit,
  };
}

async function prepareFinality(beacon: Beacon, beaconService: BeaconService) {
  const finalityBoc = initOptimisticBoc(transformBeaconToCell(beacon));
  const isVerified = await beaconService.isBeaconVerified(beacon.selfHash);

  return {
    data: beacon,
    isVerified: isVerified.isValid,
    boc: finalityBoc,
  };
}

async function prepareOptimistics(
  beacons: (Beacon & {
    Child: Beacon;
    Parent: Beacon;
    execution: Execution;
  })[],
  beaconService: BeaconService,
) {
  const isVerified = await Promise.all(
    beacons.map((op) => beaconService.isBeaconVerified(op.selfHash)),
  );
  const bocs = beacons.map((optimistic, index) => {

    return verifyOptimisticBoc(
      transformBeaconToCell(optimistic),
      optimistic?.Child?.selfHash || '0x0',
    );
  });

  return {
    data: beacons,
    bocs,
    isVerified: isVerified.map(v => v.isValid),
  };
}

async function prepareExecution(
  beacon: Beacon & {
    Child: Beacon;
    Parent: Beacon;
    execution: Execution;
  },
) {
  const execution = beacon.execution;
  const executionBoc = updateReceiptBoc(
    getExecutionContainerCell(execution),
    transformExecutionBranchToCell([
      execution.executionBranch1,
      execution.executionBranch2,
      execution.executionBranch3,
      execution.executionBranch4,
    ]),
    beginCell()
      .storeBuffer(Buffer.from(beacon.selfHash.slice(2), 'hex'))
      .endCell(),
  );

  return {
    data: execution,
    boc: executionBoc,
  };
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
    let gotProof: (Beacon & {
      Child: Beacon;
      Parent: Beacon;
      execution: Execution;
    })[] = [];

    while (!gotProof.length) {
      try {
        gotProof = await this.beaconService.getProofUpdates(update);
      } catch (error) {
        await sleep(5000);
      }
    }

    const finalityData = await prepareFinality(gotProof[0], this.beaconService);
    const optimisticsData = await prepareOptimistics(
      gotProof.slice(1),
      this.beaconService,
    );
    const executionData = await prepareExecution(gotProof[gotProof.length - 1]);
    const receiptData = await prepareReceipt(
      receipt,
      gotProof[gotProof.length - 1].selfHash,
      this.configService.getOrThrow<string>('TON_ADAPTER_ADDRESS'),
    );

    console.warn('END WORKING: ASK FOR RECEIPT');

    return {
      finalityData,
      optimisticsData,
      executionData,
      receiptData,
    };
  }
}
