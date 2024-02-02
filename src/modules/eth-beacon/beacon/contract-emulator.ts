import { ssz } from "@lodestar/types";
import { Committee } from './committee.js';
import { fromHexString } from './utils.js';

import type { altair, phase0 } from '@lodestar/types';
import type { TFinalityUpdate, TLightClientUpdate } from './types.js';


const DOMAIN_SYNC_COMMITTEE = Uint8Array.from([7, 0, 0, 0]);
// const CAPELLA_FORK_VERSION = fromHexString("0x90000072"); // sepolia
const DENEB_FORK_VERSION = fromHexString("0x90000073"); // sepolia
// DENEB_FORK_EPOCH: 132608,

// curl -X 'GET' 'http://${ hostWithPort }/eth/v1/beacon/genesis' \
//   -H 'accept: application/json'
const jsonGenesis = { data: {
  genesis_time: 1655733600,
  genesis_validators_root:
    '0xd8ea171f3c94aea21ebc42a1ed61052acf3f9209c00e4efbaaddac09ed9b8078',
  genesis_fork_version: '0x90000069',
}};

const genesis = ssz.phase0.Genesis.fromJson(jsonGenesis.data);


export class ContractEmulator {
  private committee: Committee | null = null;
  private lastCommitteeHash: Buffer = Buffer.from(
    'b3fb275622503695a503807ebdb4316b0e19221b28aea86ec25bf576e377b736',
    'hex',
  );

  async getLastCommitteeHash() {
    return this.lastCommitteeHash;
  }

  async getCommittee(): Promise<Committee> {
    return this.committee;
  }

  async processCommitteeUpdate(update: TLightClientUpdate) {
    if ( this.committee ) {
      this.checkHederSign(
        update.data.attestedHeader.beacon,
        update.data.syncAggregate,
      );
    }

    this.committee = new Committee(update.data.nextSyncCommittee);
    this.lastCommitteeHash = Buffer.from(
      ssz.phase0.BeaconBlockHeader.hashTreeRoot(
        update.data.finalizedHeader.beacon,
      ),
    );
    console.log('lastCommitteeHash:', this.lastCommitteeHash.toString('hex'));
  }

  async processFinalityUpdate(update: TFinalityUpdate) {
    if ( !this.checkHederSign(
      update.data.attestedHeader.beacon,
      update.data.syncAggregate,
    )) {
      throw new Error(
        'Invalid signature for finalized slot ' +
        update.data.attestedHeader.beacon.slot,
      );
    }
  }

  protected checkHederSign(
    header: phase0.BeaconBlockHeader,
    syncAggregate: altair.SyncAggregate,
  ) {
    const forkDataRoot = ssz.phase0.ForkData.hashTreeRoot({
      // currentVersion: CAPELLA_FORK_VERSION,
      currentVersion: DENEB_FORK_VERSION,
      genesisValidatorsRoot: genesis.genesisValidatorsRoot,
    });
    const domain = new Uint8Array(32);
    domain.set(DOMAIN_SYNC_COMMITTEE, 0);
    domain.set(forkDataRoot.slice(0, 28), 4);

    const objectRoot = ssz.phase0.BeaconBlockHeader.hashTreeRoot(
      header,
    );
    const signingRoot = ssz.phase0.SigningData.hashTreeRoot({
      objectRoot,
      domain,
    });
    const res = this.committee.verifySignature(
      signingRoot,
      syncAggregate,
    );

    return res;
  }
}
