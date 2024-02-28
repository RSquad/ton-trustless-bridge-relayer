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


export class BeaconApi {
  public transport: LightClientRestTransport;

  constructor(networkName: NetworkName) {
    const conf = configs[networkName];

    const {BEACON_API: baseUrl} = conf;
    const config = createChainForkConfig(conf.chainConfig);
    const api = getClient({ baseUrl }, { config });
    this.transport = new LightClientRestTransport(api);
  }
}
