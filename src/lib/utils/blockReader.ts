// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import TonRocks from '../ton-rocks-js';
import { LiteApiBlockResponse, ParsedBlock } from '../types';

export async function parseBlock(
  block: LiteApiBlockResponse,
): Promise<ParsedBlock> {
  const [rootCell] = await TonRocks.types.Cell.fromBoc(
    Buffer.from(block.data, 'base64').toString('hex'),
  );

  // Additional check for rootHash
  const rootHash = Buffer.from(rootCell.hashes[0]).toString('hex');
  if (rootHash !== block.id.root_hash) {
    throw Error('got wrong block or here was a wrong root_hash format');
  }

  const parsedBlock = TonRocks.bc.BlockParser.parseBlock(rootCell);
  return parsedBlock;
}
