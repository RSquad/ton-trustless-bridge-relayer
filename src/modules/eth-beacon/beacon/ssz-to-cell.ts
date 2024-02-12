import {Cell, beginCell} from 'ton-core';
import {BLSSignature, Root} from './ssz-beacon-type.js';
import { splitIntoRootChunks } from '@chainsafe/ssz/lib/util/merkleize.js';

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
  type__bitVector: 0xa8cd9c9c
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


export function SSZUintToCell({value, size, isInf = false}: {value: number; size: number; isInf?: boolean}, tail?: Cell) {
  let builder = beginCell()
      .storeUint(Opcodes.type__uint, 32)
      .storeBit(isInf)
      .storeUint(size, 16)
      .storeUint(value, size * 8);

  if (tail) {
      builder = builder.storeRef(tail);
  }

  return builder.endCell();
}

export function SSZBitVectorToCell(value: string, bitLimit: number, tail?: Cell) {
  const bitString = value.startsWith('0x') ? value.replace('0x', '') : value;
    const uint8Arr = Uint8Array.from(Buffer.from(bitString, 'hex'));

    const chunks = splitIntoRootChunks(uint8Arr)
        .reverse()
        .map((chunk: any) => beginCell().storeBuffer(Buffer.from(chunk)))
        .reduce((acc, memo, index) => {
            if (index === 0) {
                return memo.endCell();
            }

            return memo.storeRef(acc).endCell();
        }, undefined as any as Cell);

  let builder = beginCell()
  .storeUint(Opcodes.type__bitVector, 32)
  .storeUint(bitLimit, 128)
  // .storeUint(stringToBitArray(value).bitLen, 256)
  .storeRef(chunks)


  if(tail) {
    builder = builder.storeRef(tail);
  }

  return builder.endCell();
}

export function BLSSignatureToCell(value: string, tail?: Cell) {
  return SSZByteVectorTypeToCell(value, 96, BLSSignature.maxChunkCount, tail);
}

export function SSZRootToCell(value: string, tail?: Cell) {
  console.log('Root.maxChunkCount', Root.maxChunkCount);
  return SSZByteVectorTypeToCell(value, 32, Root.maxChunkCount, tail);
}

export function SSZByteVectorTypeToCell(value: string, size: number, maxChunks: number, tail?: Cell) {
  const signatureString = value.startsWith('0x') ? value.replace('0x', '') : value;
  const uint8Arr = Uint8Array.from(Buffer.from(signatureString, 'hex'));

  const chunks = splitIntoRootChunks(uint8Arr)
      .reverse()
      .map((chunk: any) => beginCell().storeBuffer(Buffer.from(chunk)))
      .reduce((acc, memo, index) => {
          if (index === 0) {
              return memo.endCell();
          }

          return memo.storeRef(acc).endCell();
      }, undefined as any as Cell);

      // console.log('value', value);
      // console.log('uint8arr', uint8Arr);
      // console.log('chunks:',chunks);

  let builder = beginCell()
      .storeUint(Opcodes.type__byteVector, 32)
      .storeUint(maxChunks, 32)
      .storeUint(size, 64)
      .storeRef(chunks);

  if (tail) {
      builder = builder.storeRef(tail);
  }

  return builder.endCell();
}

export function SSZVectorToCell(body: Cell, chunkLength: number, tail?: Cell) {
  let builder = beginCell()
  .storeUint(Opcodes.type__vector, 32)
  .storeUint(chunkLength, 64)
  .storeBit(false)
  .storeRef(
      body
  )

  if (tail) {
    builder = builder.storeRef(tail);
}

return builder.endCell();
}
