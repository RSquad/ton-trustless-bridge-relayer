import { Injectable } from '@nestjs/common';

import { createChainForkConfig } from '@lodestar/config';
import {
  genesisData,
  networksChainConfig,
} from '@lodestar/config/networks';
import { LightClientRestTransport } from '@lodestar/light-client/transport';
import { getClient } from "@lodestar/api";

import { FinalityWatcher } from './finality-watcher.js';
import { OptimisticWatcher } from './optimistic-watcher.js';
import { Committee } from './committee.js';

import {
  allForks,
  ssz,
  Epoch,
  Slot,
  SyncPeriod,
} from "@lodestar/types";
import {
  EPOCHS_PER_SYNC_COMMITTEE_PERIOD,
  SLOTS_PER_EPOCH,
  // FINALIZED_ROOT_GINDEX,
  // BLOCK_BODY_EXECUTION_PAYLOAD_GINDEX,
  ForkName,
  // ForkSeq,
  // ForkExecution,
} from "@lodestar/params";

import type { ChainConfig } from '@lodestar/config';
import type { GenesisData } from '@lodestar/light-client';


type TFinalityUpdate = {
  version: ForkName;
  data: allForks.LightClientFinalityUpdate
};

type TOptimisticUpdate = {
  version: ForkName;
  data: allForks.LightClientOptimisticUpdate
};

type TLightClientUpdate = {
  version: ForkName;
  data: allForks.LightClientUpdate;
};

type NetworkName = "mainnet" | "sepolia";

interface IConf {
  chainConfig: ChainConfig,
  genesisData: GenesisData,
  BEACON_API: string;
}

function fromHexString(hex: string): Uint8Array {
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
  // return Math.round((slot + 0.5) / SLOTS_PER_EPOCH);
}

export function computeSyncPeriodAtSlot(slot: Slot): SyncPeriod {
  return computeSyncPeriodAtEpoch(computeEpochAtSlot(slot));
}

export function computeSyncPeriodAtEpoch(epoch: Epoch): SyncPeriod {
  return Math.floor(epoch / EPOCHS_PER_SYNC_COMMITTEE_PERIOD);
}

const configs: Record<NetworkName, IConf> = {
  sepolia: {
    chainConfig: networksChainConfig.sepolia,
    genesisData: genesisData.sepolia,
    BEACON_API: 'https://lodestar-sepolia.chainsafe.io/',
  },
  mainnet: {
    chainConfig: networksChainConfig.mainnet,
    genesisData: genesisData.mainnet,
    BEACON_API: 'http://testing.mainnet.beacon-api.nimbus.team/',
  },
};


const confName: NetworkName = 'sepolia';
const conf = configs[confName];

/*
1. мониторить finality (с подписями) и кидать их в контракт
2. уметь находить по receipt'у (или что вернет транзакция которую вызвал пользователь)
   optimistic/finality с этим receipt'ом (по сути найти через js нужный блок
   который содержит данные транзакции)
3. уметь идти от данного optimistic'а до finality (вперед),
   чтобы составить цепочку проверок
*/

@Injectable()
export class BeaconService {
  private _transport: LightClientRestTransport;
  private svcWatcher: FinalityWatcher;
  private svcOptimisticWatcher: OptimisticWatcher;

  constructor() {
    const {BEACON_API: baseUrl} = conf;
    const config = createChainForkConfig(conf.chainConfig);
    const api = getClient({ baseUrl }, { config });
    this._transport = new LightClientRestTransport(api);
    console.log('transport created');

    this.svcWatcher = new FinalityWatcher(this._transport);
    this.svcOptimisticWatcher = new OptimisticWatcher(this._transport);

    this.svcWatcher.on('finality', this.onFinalityUpdate.bind(this));
    this.svcOptimisticWatcher.on('optimistic', this.onOptimisticUpdate.bind(this));

    setTimeout(() => this.start(), 1000);
  }


  protected onOptimisticUpdate (update: TOptimisticUpdate) {
    const { slot } = update.data.attestedHeader.beacon;

    console.log('OPT', slot);
  };

  protected async onFinalityUpdate (update: TFinalityUpdate) {
    // onOptimisticUpdate(extractOptimistic(update));
    const { slot, parentRoot } = update.data.finalizedHeader.beacon;

    const DOMAIN_SYNC_COMMITTEE = Uint8Array.from([7, 0, 0, 0]);
    const CAPELLA_FORK_VERSION = fromHexString("0x90000072"); // sepolia
    // curl -X 'GET' 'http://${ hostWithPort }/eth/v1/beacon/genesis' \
    //   -H 'accept: application/json'
    const jsonGenesis = { data: {
      genesis_time: 1655733600,
      genesis_validators_root:
        '0xd8ea171f3c94aea21ebc42a1ed61052acf3f9209c00e4efbaaddac09ed9b8078',
      genesis_fork_version: '0x90000069',
    }};

    const genesis = ssz.phase0.Genesis.fromJson(jsonGenesis.data);

    // computeDomain
    const forkDataRoot = ssz.phase0.ForkData.hashTreeRoot({
      currentVersion: CAPELLA_FORK_VERSION,
      genesisValidatorsRoot: genesis.genesisValidatorsRoot,
    });
    const domain = new Uint8Array(32);
    domain.set(DOMAIN_SYNC_COMMITTEE, 0);
    domain.set(forkDataRoot.slice(0, 28), 4);

    const objectRoot = ssz.phase0.BeaconBlockHeader.hashTreeRoot(
      update.data.attestedHeader.beacon,
    );
    const signingRoot = ssz.phase0.SigningData.hashTreeRoot({
      objectRoot,
      domain,
    });

    const syncAggregate = update.data.syncAggregate;

    const comitee = await this.findSyncCommitteeFor(slot);
    const resVerification = comitee.verifySignature(
      signingRoot,
      syncAggregate,
    );

    if ( resVerification ) {
      console.log('FIN', slot);
    } else {
      console.log('ERR', slot);
    }

  };

  public async findSyncCommitteeFor(slot: number): Promise<Committee> {
    const epoch = computeEpochAtSlot(slot);
    const period = computeSyncPeriodAtEpoch(epoch);
    const updates: TLightClientUpdate[] = await this.transport.getUpdates(period - 1, 1);

    return new Committee(updates[0].data.nextSyncCommittee);
  }

  public get transport(): LightClientRestTransport {
    return this._transport;
  }

  public start() {
    this.svcWatcher.start();
    this.svcOptimisticWatcher.start();
    // this.run().catch(ex => console.log(ex));
  }

  private _currentSlot = 0;
  private async run() {
    // scan finality updates and uptimistic updates;
    // console log finality updates with committee;
    // optional: store optimistics with special receipts and their proof paths to nearest finality update
    while ( true ) {
      const update = await this.transport.getOptimisticUpdate();
      const { slot } = update.data.attestedHeader.beacon;

      if ( this._currentSlot !== slot ) {
        this._currentSlot = slot;
        // this.emit('optimistic', update);
        // console.log('OptimisticUpdate on slot', slot, update.data);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  async getUpdateByReceipt(receipt: any) {}

  async getProofUpdates(update: any) {
    // returns array of updates for send them to the contract
    const res = [];
  }
}
