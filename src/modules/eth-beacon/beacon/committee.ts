import blst from "@chainsafe/blst";
import type { altair } from '@lodestar/types';


function getBit(
  n: number,
  bytearray: Uint8Array,
): Boolean {
  const idxByte = Math.floor(n / 8);
  const idxBit = 1 << (n % 8);
  return !!(idxBit & bytearray[idxByte]);
}

const verifySignature = (
  message: Uint8Array,
  syncAggregate: altair.SyncAggregate,
  syncCommittee: altair.SyncCommittee,
) => {
  const participantPubkeys: blst.PublicKey[] = [];
  const {
    bitLen,
    uint8Array,
  } = syncAggregate.syncCommitteeBits;

  for(let i = 0; i < bitLen; i++) {
    if ( getBit(i, uint8Array) ) {
      participantPubkeys.push(
        blst.PublicKey.fromBytes(
          syncCommittee.pubkeys[i],
        ),
      );
    }
  }

  const aggPubkey = blst.aggregatePubkeys(participantPubkeys);
  const sig = blst.Signature.fromBytes(
    syncAggregate.syncCommitteeSignature,
  );

  return blst.verify(message, aggPubkey, sig);
};

export class Committee {
  constructor(
    private syncCommittee: altair.SyncCommittee,
  ) {
    //
  }

  public verifySignature(
    message: Uint8Array,
    syncAggregate: altair.SyncAggregate,
  ) {
    return verifySignature(message, syncAggregate, this.syncCommittee);
  }
}
