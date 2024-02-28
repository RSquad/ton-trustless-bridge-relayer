import {BitArray, BitListType, BitVectorType, ByteListType, ByteVectorType, ContainerType, ListCompositeType, UintBigintType, UintNumberType, VectorCompositeType} from '@chainsafe/ssz';
import { bytes } from '../../../lib/evm-data/utils/index.js';


export const MAX_PROPOSER_SLASHINGS = 16;
export const MAX_ATTESTER_SLASHINGS = 2;
export const MAX_ATTESTATIONS = 128;
export const MAX_VALIDATORS_PER_COMMITTEE = 2048;
export const DEPOSIT_CONTRACT_TREE_DEPTH = 2 ** 5; // 32
export const MAX_DEPOSITS = 16;
export const MAX_VOLUNTARY_EXITS = 16;
export const SYNC_COMMITTEE_SIZE = 512;
export const BYTES_PER_LOGS_BLOOM = 256;
export const MAX_EXTRA_DATA_BYTES = 32;
export const MAX_BYTES_PER_TRANSACTION = 1073741824;
export const MAX_TRANSACTIONS_PER_PAYLOAD = 1048576;

export const Bytes96 = new ByteVectorType(96);
export const UintNumInf64 = new UintNumberType(8, {clipInfinity: true});
export const UintNum64 = new UintNumberType(8);
export const Bytes32 = new ByteVectorType(32);
export const Bytes20 = new ByteVectorType(20);
export const UintBn256 = new UintBigintType(32);
export const Uint256 = UintBn256;

export const BLSSignature = Bytes96;
export const Slot = UintNumInf64;
export const ValidatorIndex = UintNum64;
export const Root = new ByteVectorType(32);
export const CommitteeIndex = UintNum64;
export const Epoch = UintNumInf64;

export const CommitteeBits = new BitListType(MAX_VALIDATORS_PER_COMMITTEE);

// export const ExecutionPayload = new ContainerType(
//   {
//     // ...executionPayloadFields,
//     // transactions: Transactions,
//   }
// );

export function stringToBitArray(value: string) {
  return new BitArray(Uint8Array.from(bytes(value)), Uint8Array.from(bytes(value)).length * 8)
}

export const Checkpoint = new ContainerType(
  {
    epoch: Epoch,
    root: Root,
  },
  {typeName: "Checkpoint", jsonCase: "eth2"}
);

export const AttestationData = new ContainerType(
  {
    slot: Slot,
    index: CommitteeIndex,
    beacon_block_root: Root,
    source: Checkpoint,
    target: Checkpoint,
  },
  {typeName: "AttestationData", jsonCase: "eth2"}
);

export const Attestation = new ContainerType(
  {
    aggregation_bits: CommitteeBits,
    data: AttestationData,
    signature: BLSSignature,
  },
  {typeName: "Attestation", jsonCase: "eth2"}
);

export const IndexedAttestation = new ContainerType(
  {
    // attestingIndices: CommitteeIndices,
    // data: AttestationData,
    signature: BLSSignature,
  },
  {typeName: "IndexedAttestation", jsonCase: "eth2"}
);

export const AttesterSlashing = new ContainerType(
  {
    attestation1: IndexedAttestation,
    attestation2: IndexedAttestation,
  },
  {typeName: "AttesterSlashing", jsonCase: "eth2"}
);

export const BeaconBlockHeader = new ContainerType(
  {
    slot: Slot,
    proposerIndex: ValidatorIndex,
    parentRoot: Root,
    stateRoot: Root,
    bodyRoot: Root,
  },
  {typeName: "BeaconBlockHeader", jsonCase: "eth2"}
);

export const SignedBeaconBlockHeader = new ContainerType(
  {
    message: BeaconBlockHeader,
    signature: BLSSignature,
  },
  {typeName: "SignedBeaconBlockHeader", jsonCase: "eth2"}
);

export const ProposerSlashing = new ContainerType(
  {
    signedHeader1: SignedBeaconBlockHeader,
    signedHeader2: SignedBeaconBlockHeader,
  },
  {typeName: "ProposerSlashing", jsonCase: "eth2"}
);

export const Eth1Data = new ContainerType(
  {
    deposit_root: Root,
    deposit_count: UintNum64,
    block_hash: Bytes32,
  },
  {typeName: "Eth1Data", jsonCase: "eth2"}
);

export const Deposit = new ContainerType(
  {
    proof: new VectorCompositeType(Bytes32, DEPOSIT_CONTRACT_TREE_DEPTH + 1),
    // data: DepositData,
  },
  {typeName: "Deposit", jsonCase: "eth2"}
);

export const SignedVoluntaryExit = new ContainerType(
  {
    // message: VoluntaryExit,
    signature: BLSSignature,
  },
  {typeName: "SignedVoluntaryExit", jsonCase: "eth2"}
);

export const SyncCommitteeBits = new BitVectorType(SYNC_COMMITTEE_SIZE);

export const SyncAggregate = new ContainerType(
  {
    sync_committee_bits: SyncCommitteeBits,
    sync_committee_signature: BLSSignature,
  },
  {typeName: "SyncCommitteeBits", jsonCase: "eth2"}
);

export const Transaction = new ByteListType(MAX_BYTES_PER_TRANSACTION);

export const Transactions = new ListCompositeType(Transaction, MAX_TRANSACTIONS_PER_PAYLOAD);

export const ExecutionPayload = new ContainerType(
  {
    parent_hash: Root,
    fee_recipient: Bytes20,
    state_root: Bytes32,
    receipts_root: Bytes32,
    logs_bloom: new ByteVectorType(BYTES_PER_LOGS_BLOOM),
    prev_randao: Bytes32,
    block_number: UintNum64,
    gas_limit: UintNum64,
    gas_used: UintNum64,
    timestamp: UintNum64,
    // TODO: if there is perf issue, consider making ByteListType
    extra_data: new ByteListType(MAX_EXTRA_DATA_BYTES),
    base_fee_per_gas: Uint256,
    // Extra payload fields
    block_Hash: Root,
    transactions: Transactions,
    // transactions: Root
  },
  {typeName: "ExecutionPayload", jsonCase: "eth2"}
);

export const BeaconBlockBody = new ContainerType(
  {
    randao_reveal: BLSSignature,
    eth1_data: Eth1Data,
    graffiti: Bytes32,
    proposer_slashings: new ListCompositeType(ProposerSlashing, MAX_PROPOSER_SLASHINGS),
    attester_slashings: new ListCompositeType(AttesterSlashing, MAX_ATTESTER_SLASHINGS),
    attestations: new ListCompositeType(Attestation, MAX_ATTESTATIONS),
    deposits: new ListCompositeType(Deposit, MAX_DEPOSITS),
    voluntary_exits: new ListCompositeType(SignedVoluntaryExit, MAX_VOLUNTARY_EXITS),
    sync_aggregate: SyncAggregate,
    execution_payload: ExecutionPayload,
  },
);

export const BeaconBlock = new ContainerType(
  {
    slot: Slot,
    proposer_index: ValidatorIndex,
    // Reclare expandedType() with altair block and altair state
    parent_root: Root,
    state_root: Root,
    body: BeaconBlockBody,
  },
  {typeName: "BeaconBlock", jsonCase: "eth2"}
);

export const SignedBeaconBlock = new ContainerType(
  {
    message: BeaconBlock,
    signature: BLSSignature,
  },
  {typeName: "SignedBeaconBlock", jsonCase: "eth2"}
);

export const Domain = Bytes32;

export const SigningData = new ContainerType(
  {
    objectRoot: Root,
    domain: Domain,
  },
  {typeName: "SigningData", jsonCase: "eth2"}
);
