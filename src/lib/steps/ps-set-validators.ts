/* eslint-disable @typescript-eslint/ban-ts-comment */
import _ from 'lodash';

// @ts-ignore
import TonRocks from '../ton-rocks-js';

import { BocProvider } from '../boc-provider';
import { ByteArray32 } from '../ton-types';
import {
  buildPathToConfig,
  buildProof,
  buildProofExcept,
  makeBocLeaf,
  printPath,
  printTreeVolume,
} from '../block-utils';

import { AValidatorsProofStep } from './a-validators-proof-step';

import type { ISubTree } from '../block-utils';
import type { TProofState, TProofStateType } from './base-types';

export class PSSetValidators extends AValidatorsProofStep {
  public static TypeName: TProofStateType = 'set-validators' as const;
  public get TypeName() {
    return PSSetValidators.TypeName;
  }

  static fromJSON(p: TProofState) {
    if (p.type != PSSetValidators.TypeName) {
      throw new Error('Incorrect type');
    }
    return new PSSetValidators(p.boc);
  }

  public static async buildValidatorsData(
    root: TonRocks.types.Cell,
  ): Promise<string[]> {
    const proofParts: string[] = [];

    const p = buildPathToConfig(root);
    if (!p) {
      throw new Error('Path not found');
    }

    // console.log('path ====');
    // console.log(p);
    printPath(p);

    const proof = await buildProof(p, true);
    proof.refs[0] = await buildProof([root.refs[0]]);
    await proof.finalizeTree();
    // console.log('before config refs:');
    // console.log(proof.refs[3].refs[3].refs);

    const parts: ISubTree[] = [];
    // TODO: make better
    printTreeVolume(
      proof.refs[3].refs[3].refs[proof.refs[3].refs[3].refs.length - 1],
      parts,
    );
    // console.log('parts:');
    // console.log(parts);

    const partsIndex = parts.reduce((m, p) => {
      const i = Buffer.from(p.root.getHash()).toString('hex');
      m[i] = p;
      return m;
    }, <Record<string, TonRocks.types.Cell>>{});
    const keysPartsIndex = _.keys(partsIndex);
    for (let i = 0; i < parts.length; i++) {
      const leafBoc = await makeBocLeaf(parts[i].root, i, keysPartsIndex);
      // console.log();
      proofParts.push(leafBoc.toString('hex'));
    }

    // console.log('proofParts len:', proofParts.length);

    const proofPruned = await buildProofExcept(proof, keysPartsIndex);
    await proofPruned.finalizeTree();

    // console.log("CELLS SHOULDN'T be pruned", keysPartsIndex);
    // console.log(
    //   'proof before prune',
    //   proof.refs.map((c) => Buffer.from(c.hashes[0]).toString('hex')),
    //   Buffer.from(proof.hashes[0]).toString('hex'),
    // );
    // console.log(
    //   'Prunned block root cell hash (extra):',
    //   proofPruned.refs.map((c) => Buffer.from(c.getHash()).toString('hex')),
    //   // proofPruned.refs[3],
    //   Buffer.from(proofPruned.hashes[0]).toString('hex'),
    // );
    const bocProofPruned = await proofPruned.toBoc(false);

    const hexBoc = Buffer.from(bocProofPruned).toString('hex');
    proofParts.unshift(hexBoc);

    return proofParts;
  }

  public static async fromBlock(boc: string) {
    const rootValSetBoc = await BocProvider.Instance.getBlockByFileHash(boc);
    const proofParts = await PSSetValidators.buildValidatorsData(rootValSetBoc);
    return new PSSetValidators(proofParts);
  }
}
