/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import TonRocks from '../ton-rocks-js';

import { ValidatorSet } from '../ton-types';

import { AProofStep } from './a-proof-step';

import type { IStateUpdate } from './base-types';

function walkTree(cell: TonRocks.types.Cell, parts: TonRocks.types.Cell[]) {
  console.log('start walk:', Buffer.from(cell.getHash()).toString('hex'));
  if (parts.length === 0 || cell.refs.length === 0) {
    return cell;
  }

  cell.refs = cell.refs.map((ref) => {
    console.log('some ref:', Buffer.from(ref.getHash()).toString('hex'));
    const hash = Buffer.from(ref.getHash()).toString('hex');
    const index = parts.findIndex(
      (part) => Buffer.from(part.getHash()).toString('hex') === hash,
    );

    if (index === -1) {
      console.log('part not found');
      return walkTree(ref, parts);
    }

    const newRef = parts[index];
    // parts = [...parts.slice(0, index), ...parts.slice(index + 1)];
    console.log('part found', index);
    return walkTree(newRef, parts);
  });

  return cell;
}

export abstract class AValidatorsProofStep extends AProofStep {
  public async check(state: IStateUpdate = {}): Promise<IStateUpdate> {
    const rootBoc = typeof this.boc === 'string' ? this.boc : this.boc[0];

    const cells = await TonRocks.types.Cell.fromBoc(rootBoc);
    let cellsRoot = cells[0];

    console.log(
      '=== root_hash:',
      Buffer.from(cellsRoot.getHash()).toString('hex'),
      '===',
    );
    // console.log(
    //   '(from boc) Prunned block root cell hash (extra):',
    //   proofPruned.refs.map((c) => Buffer.from(c.hashes[0]).toString('hex')),
    //   // proofPruned.refs[3],
    //   Buffer.from(proofPruned.hashes[0]).toString('hex'),
    // );
    // TODO: append more parts (this.boc[i > 0])
    if (typeof this.boc !== 'string' && this.boc.length > 1) {
      const parts = await Promise.all(
        this.boc
          .slice(1)
          .map(
            (boc) =>
              TonRocks.types.Cell.fromBoc(boc).then(
                (cells) => cells[0],
              ) as Promise<TonRocks.types.Cell>,
          ),
      );

      cellsRoot = walkTree(cellsRoot, parts);
    }

    const parsedBlock = TonRocks.bc.BlockParser.parseBlock(cellsRoot);

    // for(const { weight, public_key } of map.values()) {
    //   const pubKey = Buffer.from(public_key.pubkey);
    //   const bufNodeIdShort = await compute_node_id_short(pubKey);
    //   res[bufNodeIdShort.toString('hex')] = { weight, pubKey };
    // }

    // for(const { public_key } of curValidators.cur_validators.list.map.values()) {
    //   const pubKey = Buffer.from(public_key.pubkey);
    //   console.log(pubKey.toString('hex'));
    // }
    // console.log(parsedBlock);
    // console.log(cellsRoot);
    // console.log(this.boc[0]);

    const { cur_validators } =
      parsedBlock.extra.custom.config.config.map.get('22');
    if (!cur_validators) {
      throw new Error('Can`t read current validators');
    }
    const validators = await ValidatorSet.from(cur_validators);

    return { validators };
  }
}
