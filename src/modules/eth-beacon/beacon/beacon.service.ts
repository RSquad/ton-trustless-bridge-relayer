import { Injectable } from '@nestjs/common';

import { deneb, ssz } from '@lodestar/types';

import { FinalityWatcher } from './finality-watcher.js';
import { OptimisticWatcher } from './optimistic-watcher.js';
import { NethermindApi } from './nethermind-api.js';
import { BeaconApi } from './beacon-api.js';
import { ContractEmulator } from './contract-emulator.js';
import { DBWrapper } from './db-wrapper.js';
import { computeEpochAtSlot, computeSyncPeriodAtSlot } from './utils.js';

import type {
  TFinalityUpdate,
  TOptimisticUpdate,
  TDenebBlock,
  TLightClientUpdate,
} from './types.js';
import { LightClientContractService } from './light-client-contract/light-client-contract.service.js';
import { Cell, Dictionary, beginCell, toNano } from 'ton-core';
import {
  SSZByteVectorTypeToCell,
  SSZRootToCell,
  SSZUintToCell,
} from './ssz-to-cell.js';
import {
  IBeacon,
  IExecution,
  normalizeBeacon,
  normalizeExecution,
  normalizeExecutionBranch,
} from './normalize-beacon/index.js';
import { EthBeaconService } from '../../prisma/services/eth-beacon/eth-beacon.service.js';
import {
  BYTES_PER_LOGS_BLOOM,
  Bytes20,
  MAX_EXTRA_DATA_BYTES,
  UintBn256,
} from './ssz-beacon-type.js';
import { ByteListType, ByteVectorType, getUint8ByteToBitBooleanArray } from '@chainsafe/ssz';
import { Beacon, Execution } from '@prisma/client';
import { Subject, concatMap, from, of } from 'rxjs';
import { bytes } from '../../../lib/evm-data/utils/index.js';
import { ForkName } from '@lodestar/params';
import { transformExecutionBranchToCell } from './light-client-contract/prepare-boc.js';
import { sleep } from '../../../lib/utils/index.js';

function committeeToCell(
  data: TLightClientUpdate['data']['nextSyncCommittee'],
  skip = false,
) {
  const CommitteeContent = Dictionary.empty(
    Dictionary.Keys.Uint(32),
    Dictionary.Values.Buffer(48),
  );
  data.pubkeys.forEach((item, i) => {
    CommitteeContent.set(i, Buffer.from(item));
  });

  if (skip) {
    return (
      beginCell()
        .storeBuffer(Buffer.from(data.aggregatePubkey))
        // .storeRef(beginCell().storeDict(CommitteeContent).endCell())
        .endCell()
    );
  }

  return beginCell()
    .storeBuffer(Buffer.from(data.aggregatePubkey))
    .storeRef(beginCell().storeDict(CommitteeContent).endCell())
    .endCell();
}

function syncAggregateToCell(
  data: {syncCommitteeBits: string, syncCommitteeSignature: string},
) {
  return beginCell()
    .storeBuffer(bytes(data.syncCommitteeBits))
    .storeRef(
      beginCell().storeBuffer(bytes(data.syncCommitteeSignature)).endCell(),
    )
    .endCell();
}

export const Opcodes = {
  run_ssz: 0x86f1bcc5,
  run_verify_receipt: 0x44b4412c,

  type__bool: 0xf43a7aa,
  type__uint: 0xcc771d29,

  type__byteVector: 0x8f2cdfd8,
  type__bytelist: 0x31ffdd28,
  type__container: 0x81706e6d,
  type__list: 0x1e0a6920,
  type__vector: 0x8bf90db0,
  type__empty: 0x409f47cb,
  type__bitlist: 0x501abea0,
  type__bitVector: 0xa8cd9c9c,
};

export function getSSZContainer(body: Cell, tail?: Cell) {
  const builder = beginCell()
    .storeUint(Opcodes.type__container, 32)
    .storeRef(body);

  if (tail) {
    builder.storeRef(tail);
  }

  return builder.endCell();
}

export function transformBeaconToCell(beacon: IBeacon) {
  const beaconContainerCell = getSSZContainer(
    SSZUintToCell(
      { value: beacon.slot, size: 8, isInf: true },
      SSZUintToCell(
        { value: beacon.proposerIndex, size: 8, isInf: false },
        SSZRootToCell(
          beacon.parentRoot,
          SSZRootToCell(beacon.stateRoot, SSZRootToCell(beacon.bodyRoot)),
        ),
      ),
    ),
  );
  return beaconContainerCell;
}

export function getExecutionContainerCell(data: IExecution, tail?: Cell) {
  const withdrawalsRootCell = SSZRootToCell(data.withdrawalsRoot);
  const transactionsCell = SSZRootToCell(
    data.transactionsRoot,
    withdrawalsRootCell,
  );
  const blockHashCell = SSZRootToCell(data.blockHash, transactionsCell);
  const baseFeePerGasCell = SSZRootToCell(
    '0x' +
      Buffer.from(UintBn256.hashTreeRoot(BigInt(data.baseFeePerGas))).toString(
        'hex',
      ),
    blockHashCell,
  );
  const tmp = new ByteListType(MAX_EXTRA_DATA_BYTES);
  const extraDataCell = SSZRootToCell(
    '0x' + Buffer.from(tmp.hashTreeRoot(bytes(data.extraData))).toString('hex'),
    baseFeePerGasCell,
  );
  const timestampCell = SSZUintToCell(
    { value: +data.timestamp, size: 8, isInf: false },
    extraDataCell,
  );
  const gas_usedCell = SSZUintToCell(
    { value: +data.gasUsed, size: 8, isInf: false },
    timestampCell,
  );
  const gas_limitCell = SSZUintToCell(
    { value: +data.gasLimit, size: 8, isInf: false },
    gas_usedCell,
  );
  const block_numberCell = SSZUintToCell(
    { value: +data.blockNumber, size: 8, isInf: false },
    gas_limitCell,
  );
  const prev_randao = SSZRootToCell(data.prevRandao, block_numberCell);
  const tmp2 = new ByteVectorType(BYTES_PER_LOGS_BLOOM);
  const logs_bloomCell = SSZByteVectorTypeToCell(
    data.logsBloom,
    BYTES_PER_LOGS_BLOOM,
    tmp2.maxChunkCount,
    prev_randao,
  );
  const receipts_root = SSZRootToCell(data.receiptsRoot, logs_bloomCell);
  const state_root = SSZRootToCell(data.stateRoot, receipts_root);
  const fee_recipient = SSZByteVectorTypeToCell(
    data.feeRecipient,
    20,
    Bytes20.maxChunkCount,
    state_root,
  );
  const parent_hash = SSZRootToCell(data.parentHash, fee_recipient);

  return getSSZContainer(parent_hash, tail);
}

@Injectable()
export class BeaconService {
  private svcWatcher: FinalityWatcher;
  private svcOptimisticWatcher: OptimisticWatcher;
  private dbWrapper = new DBWrapper();
  private nethermindApi: NethermindApi;
  private beaconApi: BeaconApi;
  private contract = new ContractEmulator();

  private savePool = new Subject<{
    beacon: IBeacon;
    execution: IExecution;
    exBranch: string[];
    isFinality: boolean;
  }>();
  private savePool$ = this.savePool.pipe(
    concatMap((el) => {
      return from(
        this.beaconService.createBeacon(
          el.beacon,
          el.execution,
          el.exBranch,
          el.isFinality,
        ),
      );
    }),
  );

  constructor(
    private contracsService: LightClientContractService,
    private beaconService: EthBeaconService,
  ) {
    this.nethermindApi = new NethermindApi('http://159.223.222.96:8545');
    this.beaconApi = new BeaconApi('sepolia');

    this.svcWatcher = new FinalityWatcher(this.beaconApi.transport);
    this.svcOptimisticWatcher = new OptimisticWatcher(this.beaconApi.transport);

    this.svcWatcher.on('finality', this.onFinalityUpdate.bind(this));
    this.svcOptimisticWatcher.on(
      'optimistic',
      this.onOptimisticUpdate.bind(this),
    );

    this.savePool$.subscribe();
    setTimeout(() => this.start(), 1000);
  }

  protected async onOptimisticUpdate(update: TOptimisticUpdate) {
    const { slot } = update.data.attestedHeader.beacon;

    const normBeacon = normalizeBeacon(update);

    console.log(
      'OPT',
      slot,
      computeEpochAtSlot(slot),
      computeSyncPeriodAtSlot(slot),
      normBeacon.selfHash,
    );

    this.savePool.next({
      beacon: normBeacon,
      execution: normalizeExecution(update),
      exBranch: normalizeExecutionBranch(update),
      isFinality: false,
    });
    // await this.beaconService.createBeacon(normBeacon, normalizeExecution(update), normalizeExecutionBranch(update));
    // await this.dbWrapper.handleUpdate(update);
  }

  protected async onFinalityUpdate(update: TFinalityUpdate) {
    // update.data.finalizedHeader

    const { slot } = update.data.finalizedHeader.beacon;
    const targetPeriod = computeSyncPeriodAtSlot(slot);
    if (targetPeriod > this._currentPeriod) {
      await this.updateCommitteeFor(slot);
    }

    await this.contract.processFinalityUpdate(update);
    this._currentSlot = slot;
    console.log(
      'FIN',
      slot,
      computeEpochAtSlot(slot),
      computeSyncPeriodAtSlot(slot),
      update.data.attestedHeader.beacon.slot,
      normalizeBeacon(update).selfHash,
    );

    // TODO: add verify
    this.savePool.next({
      beacon: normalizeBeacon(update),
      execution: normalizeExecution(update),
      exBranch: normalizeExecutionBranch(update),
      isFinality: true,
    });
    // await this.beaconService.createBeacon(normalizeBeacon(update), normalizeExecution(update), normalizeExecutionBranch(update), true);
    // console.log(transformBeaconToCell(normalizeBeacon(update)));
    // console.log(normalizeBeacon(update));

    // try {
    //   await this.contracsService.lightClientContract.sendInitOptimisticUpdate(
    //     this.contracsService.tonSender,
    //     {
    //       value: toNano('0.07'),
    //       beacon: transformBeaconToCell(normalizeBeacon(update))
    //     }
    //   )
    // } catch (error) {
    //   console.log(error)
    // }

    // await this.dbWrapper.handleUpdate(update);
  }

  public start() {
    this.run().catch((ex) => console.log(ex));
  }

  // private async indexBackward(fromSlot: number, toSlot: number) {
  //   let update = await this.dbWrapper.findBySlot(toSlot);
  //   while ( update.data.attestedHeader.beacon.slot > fromSlot ) {
  //     const hash = Buffer.from(
  //       update.data.attestedHeader.beacon.parentRoot,
  //     );
  //     update = await this.dbWrapper.findByHash(hash);
  //     if ( !update ) {
  //       update = await this.dbWrapper.handleBlockAsOptimisticUpdate(
  //         await this.beaconApi.transport.fetchBlock(`0x${
  //           hash.toString('hex')
  //         }`),
  //       );
  //       await new Promise((r) => setTimeout(r, 300));
  //     }
  //     console.log('while', update.data.attestedHeader.beacon.slot, fromSlot, toSlot);
  //   }
  // }

  private _currentSlot = 0;
  private _currentPeriod = 0;

  private async updateCommittee(period: number) {
    const updates =
      // : TLightClientUpdate[]
      (await this.beaconApi.transport.getUpdates(period - 1, 1)) as {
        version: ForkName;
        data: deneb.LightClientUpdate;
      }[];
    await this.contract.processCommitteeUpdate(
      updates[0] as TLightClientUpdate,
    );

    const testPeriod = this._currentPeriod;

    this._currentSlot = updates[0].data.finalizedHeader.beacon.slot;
    this._currentPeriod = period;
    console.log('updateCommittee', {
      slot: this._currentSlot,
      period: this._currentPeriod,
    });

    const lastFinalityHash =
      await this.contracsService.lightClientContract.getLastFinalityHash();
    console.log('LAST FINALITY HASH:', lastFinalityHash.hash)

    const testBeacon = normalizeBeacon(updates[0]);
    if (lastFinalityHash.hash === testBeacon.selfHash || true) {

    }
    else if (!testPeriod && lastFinalityHash.hash === '0') {
      console.log('START INIT COMMETTEE');
      await this.contracsService.lightClientContract.sendInitCommittee(
        this.contracsService.tonSender,
        {
          value: toNano('0.414'),
          committee: committeeToCell(updates[0].data.nextSyncCommittee),
        },
      );
      await sleep(15000);
      console.log('COMPLETE INIT COMMETTEE');
    } else {

      console.log('START UPDATE COMMITEE');
      const normBeacon = normalizeBeacon(updates[0]);
      await this.contracsService.lightClientContract.sendAddOptimisticUpdate(
        this.contracsService.tonSender,
        {
          value: toNano('0.07'),
          beacon: transformBeaconToCell(normBeacon),
        },
      );
      await sleep(15000);

      await this.contracsService.lightClientContract.sendUpdateReceipt(
        this.contracsService.tonSender,
        {
          value: toNano('0.17'),
          execution: getExecutionContainerCell(normalizeExecution(updates[0])),
          execution_branch: transformExecutionBranchToCell(
            normalizeExecutionBranch(updates[0]),
          ),
          beacon_hash: beginCell()
            .storeBuffer(Buffer.from(normBeacon.selfHash.slice(2), 'hex'))
            .endCell(),
        },
      );
      await sleep(15000);
      ///////////////////////////////////////////////////////
      await this.contracsService.lightClientContract.sendNextCommittee(
        this.contracsService.tonSender,
        {
          value: toNano('0.417'),
          committee: committeeToCell(updates[0].data.nextSyncCommittee),
          beacon_hash: beginCell()
            .storeBuffer(Buffer.from(normBeacon.selfHash.slice(2), 'hex'))
            .endCell(),
        },
      );
      await sleep(15000);

      for (let i = 0; i < 16; i++) {
        try {
          await this.contracsService.lightClientContract.sendCalcNextCommitteeHash(
            this.contracsService.tonSender,
            {
              value: toNano('0.702'),
              beacon_hash: beginCell()
                .storeBuffer(Buffer.from(normBeacon.selfHash.slice(2), 'hex'))
                .endCell(),
            },
          );
          await sleep(20000);
        } catch (error) {
          console.log(error);
        }

      };

      let committee_branch_cell!: Cell;
        for (let i = 0; i < updates[0].data.nextSyncCommitteeBranch.length; i++) {
            const branch_item = updates[0].data.nextSyncCommitteeBranch[i];
            if (!committee_branch_cell) {
                committee_branch_cell = beginCell().storeBuffer(Buffer.from(branch_item)).endCell();
            } else {
                committee_branch_cell = beginCell()
                    .storeBuffer(Buffer.from(branch_item))
                    .storeRef(committee_branch_cell)
                    .endCell();
            }
        }

      await this.contracsService.lightClientContract.sendVerifyNextCommittee(
        this.contracsService.tonSender,
        {
          value: toNano('0.091'),
          committee: committeeToCell(
            updates[0].data.nextSyncCommittee,
            true,
          ),
          committee_branch: committee_branch_cell,
          beacon_hash: beginCell()
            .storeBuffer(Buffer.from(normBeacon.selfHash.slice(2), 'hex'))
            .endCell(),
        },
      );
      await sleep(15000);
      ////////////////////////////////////////////////////
      let fixedCommitteeBits = '';

        (updates[0].data.syncAggregate.syncCommitteeBits).uint8Array.forEach((el) => {
            const a = getUint8ByteToBitBooleanArray(el);
            fixedCommitteeBits += parseInt(a.map((el) => (el ? 1 : 0)).join(''), 2).toString(16);
        });

      for (let i = 0; i < 4; i++) {
        await this.contracsService.lightClientContract.sendAggregatePubkey(
          this.contracsService.tonSender,
          {
            value: toNano('0.670'),
            aggregate: syncAggregateToCell({
              syncCommitteeSignature: '0x' + Buffer.from(updates[0].data.syncAggregate.syncCommitteeSignature).toString('hex'),
              syncCommitteeBits: '0x' + fixedCommitteeBits,
            }),
            beacon_hash: beginCell()
              .storeBuffer(Buffer.from(normBeacon.selfHash.slice(2), 'hex'))
              .endCell(),
          },
        );
        await sleep(15000);
      }

      await this.contracsService.lightClientContract.sendFinalityUpdate(
        this.contracsService.tonSender,
        {
          value: toNano('0.125'),
          aggregate: syncAggregateToCell({
            syncCommitteeSignature: '0x' + Buffer.from(updates[0].data.syncAggregate.syncCommitteeSignature).toString('hex'),
            syncCommitteeBits: '0x' + fixedCommitteeBits,
        }),
          beacon_hash: beginCell()
            .storeBuffer(Buffer.from(normBeacon.selfHash.slice(2), 'hex'))
            .endCell(),
        },
      );
      await sleep(15000);
      console.log('COMPLETE UPDATE COMMETTEE');
    }


  }

  private async updateCommitteeFor(slot: number) {
    const targetPeriod = computeSyncPeriodAtSlot(slot);

    if (!this._currentPeriod) {
      console.log('NO CURRENT PERIOD');
      await this.updateCommittee(targetPeriod);
      return;
    }
    for (let i = this._currentPeriod; i < targetPeriod; i++) {
      console.log('UPDATE COMMITTEE:', i);
      await this.updateCommittee(i + 1);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  private async run() {
    // const blockHash = await this.contract.getLastCommitteeHash();
    // const block = await this.beaconApi.transport.fetchBlock(`0x${
    //   blockHash.toString('hex')
    // }`) as TDenebBlock;
    // await this.dbWrapper.handleBlockAsOptimisticUpdate(block);
    // await this.updateCommitteeFor(block.data.message.slot);

    this.svcWatcher.start();
    this.svcOptimisticWatcher.start();

    // scan finality updates and uptimistic updates;
    // console log finality updates with committee;
    // optional: store optimistics with special receipts and their proof paths to nearest finality update
  }

  async isBeaconVerified(hash: string) {
    return await this.contracsService.lightClientContract.getBeaconValidationStatus(
      hash,
    );
  }

  async getReceiptWithProofByHash(txHash: string) {
    const data = await this.nethermindApi.getTransactionReceiptWithProof(
      txHash,
      true,
    );
    return data;
  }

  async getUpdateByReceipt(txHash: string) {
    const {
      receipt,
      // receiptProof,
    } = await this.nethermindApi.getTransactionReceiptWithProof(txHash);
    const { blockNumber } = receipt;
    console.log({ blockNumber });

    const { parentBeaconBlockRoot } = await this.nethermindApi.getBlockByNumber(
      blockNumber,
    );
    console.log({ parentBeaconBlockRoot });

    const block = await this.beaconApi.transport.fetchBlock(
      parentBeaconBlockRoot,
    );
    const body = block.data.message.body as any;
    console.log(block.data.message.slot);
    console.log(body.executionPayload.blockNumber);

    // const hash = Buffer.from(
    //   parentBeaconBlockRoot.substring(2),
    //   'hex',
    // );
    const update = await this.beaconService.findNext(parentBeaconBlockRoot);

    if (!update) {
      throw new Error('Not in index');
    }

    return update;
  }

  async getProofUpdates<
    T extends Beacon & {
      Child: Beacon;
      Parent: Beacon;
      execution: Execution;
    },
  >(update: T) {
    // returns array of updates for send them to the contract
    const res: T[] = [];

    res.unshift(update);

    let upd = update;

    while (!upd.isFinality) {
      upd = (await this.beaconService.findNext(upd.selfHash)) as T;

      if (!upd) {
        console.log('proof path length:', res.length);
        throw new Error('Not finalized yet');
      }
      res.unshift(upd);
    }

    return res;
  }
}
