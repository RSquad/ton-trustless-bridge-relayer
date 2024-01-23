import { Injectable } from '@nestjs/common';

import { createChainForkConfig } from '@lodestar/config';
import {
  genesisData,
  networksChainConfig,
} from '@lodestar/config/networks';
import { LightClientRestTransport } from '@lodestar/light-client/transport';
import { getClient } from "@lodestar/api";

import type { ChainConfig } from '@lodestar/config';
import type { GenesisData } from '@lodestar/light-client';


type NetworkName = "mainnet" | "sepolia";

interface IConf {
  chainConfig: ChainConfig,
  genesisData: GenesisData,
  BEACON_API: string;
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


@Injectable()
export class BeaconService {
  private _transport: LightClientRestTransport;

  constructor() {
    const {BEACON_API: baseUrl} = conf;
    const config = createChainForkConfig(conf.chainConfig);
    const api = getClient({ baseUrl }, { config });
    this._transport = new LightClientRestTransport(api);
    console.log('transport created');
    setTimeout(() => this.start(), 1000);
  }

  public get transport(): LightClientRestTransport {
    return this._transport;
  }

  public start() {
    this.run().catch(ex => console.log(ex));
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
