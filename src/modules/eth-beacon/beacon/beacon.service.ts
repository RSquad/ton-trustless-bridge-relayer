import { Injectable } from '@nestjs/common';

import { ssz } from "@lodestar/types";

import { FinalityWatcher } from './finality-watcher.js';
import { OptimisticWatcher } from './optimistic-watcher.js';
import { NethermindApi } from './nethermind-api.js';
import { BeaconApi } from './beacon-api.js';
import { ContractEmulator } from './contract-emulator.js';
import { DBWrapper } from './db-wrapper.js';
import {
  computeEpochAtSlot,
  computeSyncPeriodAtSlot,
} from './utils.js';

import type {
  TFinalityUpdate,
  TOptimisticUpdate,
  TDenebBlock,
} from './types.js';


@Injectable()
export class BeaconService {
  private svcWatcher: FinalityWatcher;
  private svcOptimisticWatcher: OptimisticWatcher;
  private dbWrapper = new DBWrapper();
  private nethermindApi: NethermindApi;
  private beaconApi: BeaconApi;
  private contract = new ContractEmulator();

  constructor() {
    this.nethermindApi = new NethermindApi('http://159.223.222.96:8545');
    this.beaconApi = new BeaconApi('sepolia');

    this.svcWatcher = new FinalityWatcher(this.beaconApi.transport);
    this.svcOptimisticWatcher = new OptimisticWatcher(this.beaconApi.transport);

    this.svcWatcher.on('finality', this.onFinalityUpdate.bind(this));
    this.svcOptimisticWatcher.on('optimistic', this.onOptimisticUpdate.bind(this));

    // setTimeout(() => this.start(), 1000);
  }

  protected async onOptimisticUpdate (update: TOptimisticUpdate) {
    const { slot } = update.data.attestedHeader.beacon;

    console.log('OPT', slot, computeEpochAtSlot(slot), computeSyncPeriodAtSlot(slot));

    await this.dbWrapper.handleUpdate(update);
  };

  protected async onFinalityUpdate (update: TFinalityUpdate) {
    const { slot } = update.data.finalizedHeader.beacon;
    const targetPeriod = computeSyncPeriodAtSlot(slot);
    if ( targetPeriod > this._currentPeriod ) {
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
    );

    await this.dbWrapper.handleUpdate(update);
  };

  public start() {
    this.run().catch(ex => console.log(ex));

    this.svcOptimisticWatcher.once('optimistic', (update: TOptimisticUpdate) => {
      // 4248062
      const fromSlot = 4248000; // 4173400;
      const toSlot = 4248100; // update.data.attestedHeader.beacon.slot;

      setTimeout(async () => {
        await this.dbWrapper.handleBlockAsOptimisticUpdate(
        await this.beaconApi.transport.fetchBlock(
          `${ toSlot }`,
        ));
        await new Promise((r) => setTimeout(r, 300));

        await this.indexBackward(fromSlot, toSlot);

        // testing
        await new Promise((r) => setTimeout(r, 10000));
        const txHash = '0xffbb40166a93097ad35d26d7c59d26c3c1e0f181a9b116bf275b05b5c69457db';
        console.log('start testing getUpdateByReceipt for', txHash);
        const update = await this.getUpdateByReceipt(txHash);
        console.log('update');
        console.log(update);
      }, 1000);
    });
  }

  private async indexBackward(fromSlot: number, toSlot: number) {
    let update = await this.dbWrapper.findBySlot(toSlot);
    while ( update.data.attestedHeader.beacon.slot > fromSlot ) {
      const hash = Buffer.from(
        update.data.attestedHeader.beacon.parentRoot,
      );
      update = await this.dbWrapper.findByHash(hash);
      if ( !update ) {
        update = await this.dbWrapper.handleBlockAsOptimisticUpdate(
          await this.beaconApi.transport.fetchBlock(`0x${
            hash.toString('hex')
          }`),
        );
        await new Promise((r) => setTimeout(r, 300));
      }
      console.log('while', update.data.attestedHeader.beacon.slot, fromSlot, toSlot);
    }
  }

  private _currentSlot = 0;
  private _currentPeriod = 0;

  private async updateCommittee(period: number) {
    const updates
      // : TLightClientUpdate[]
      = await this.beaconApi.transport.getUpdates(period - 1, 1);
    await this.contract.processCommitteeUpdate(updates[0]);

    this._currentSlot = updates[0].data.finalizedHeader.beacon.slot;
    this._currentPeriod = period;
    console.log('updateCommittee', {
      slot: this._currentSlot,
      period: this._currentPeriod,
    });
  }

  private async updateCommitteeFor(slot: number) {
    const targetPeriod = computeSyncPeriodAtSlot(slot);

    if ( !this._currentPeriod ) {
      await this.updateCommittee(targetPeriod);
      return;
    }

    for ( let i = this._currentPeriod; i < targetPeriod; i++ ) {
      await this.updateCommittee(i + 1);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  private async run() {
    const blockHash = await this.contract.getLastCommitteeHash();
    const block = await this.beaconApi.transport.fetchBlock(`0x${
      blockHash.toString('hex')
    }`) as TDenebBlock;
    await this.dbWrapper.handleBlockAsOptimisticUpdate(block);
    await this.updateCommitteeFor(block.data.message.slot);

    this.svcWatcher.start();
    this.svcOptimisticWatcher.start();

    // scan finality updates and uptimistic updates;
    // console log finality updates with committee;
    // optional: store optimistics with special receipts and their proof paths to nearest finality update
  }

  /*
    1. мониторить finality (с подписями) и кидать их в контракт
    2. уметь находить по receipt'у (или что вернет транзакция которую вызвал пользователь)
      optimistic/finality с этим receipt'ом (по сути найти через js нужный блок
      который содержит данные транзакции)
    3. уметь идти от данного optimistic'а до finality (вперед),
      чтобы составить цепочку проверок
  */

  async getUpdateByReceipt(txHash: string) {
    const {
      receipt,
      // receiptProof,
    } = await this.nethermindApi.getTransactionReceiptWithProof(txHash);
    const { blockNumber } = receipt;
    console.log({ blockNumber });

    const {
      parentBeaconBlockRoot,
    } = await this.nethermindApi.getBlockByNumber(blockNumber);
    console.log({ parentBeaconBlockRoot });

    const block = await this.beaconApi.transport.fetchBlock(parentBeaconBlockRoot);
    const body = block.data.message.body as any;
    console.log(block.data.message.slot);
    console.log(body.executionPayload.blockNumber);

    const hash = Buffer.from(
      parentBeaconBlockRoot.substring(2),
      'hex',
    );
    const update = await this.dbWrapper.findNext(hash);

    if ( !update ) {
      throw new Error('Not in index');
    }

    return update;
  }

  async getProofUpdates(update: any) {
    // returns array of updates for send them to the contract
    const res = [];

    let upd = update;
    while ( !upd.data.finalizedHeader ) {
      upd = this.dbWrapper.findNext(Buffer.from(
        ssz.phase0.BeaconBlockHeader.hashTreeRoot(
          upd.data.attestedHeader.beacon,
        ),
      ));
      if ( !upd ) {
        throw new Error('Not finalized yet');
      }
      res.push(upd);
    }

    return res;
  }
}
