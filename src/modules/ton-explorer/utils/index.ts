/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { loadBlock, readBlockRootCell } from 'src/lib/utils/boc';
import { getBlock } from 'src/lib/utils/lite-api';
import { TonClient, TonClient4 } from 'ton';
// @ts-ignore
import TonRocks from '../../../lib/ton-rocks-js';

export async function initExample() {
  const tonClient4 = new TonClient4({
    endpoint: 'https://testnet-v4.tonhubapi.com',
  });
  const tonClient = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
  });

  const lastBlock = await getBlock((await tonClient4.getLastBlock()).last);
  const lastBlockRootCell = readBlockRootCell(
    lastBlock.data,
    lastBlock.id.root_hash,
  );
  const lastBlockData = loadBlock(lastBlockRootCell);

  const lastKeyBlockV4 = await tonClient4.getBlock(
    lastBlockData.info.prev_key_block_seqno,
  );
  const lastKeyBlock = await getBlock(
    lastKeyBlockV4.shards.find(
      (blockRes) => blockRes.seqno === lastBlockData.info.prev_key_block_seqno,
    )!,
  );
  const lastKeyBlockRootCell = readBlockRootCell(
    lastKeyBlock.data,
    lastKeyBlock.id.root_hash,
  );
  const lastKeyBlockData = loadBlock(lastKeyBlockRootCell);

  const preKeyBlockV4 = await tonClient4.getBlock(
    lastKeyBlockData.info.prev_key_block_seqno,
  );
  const prevKeyBlock = await getBlock(
    preKeyBlockV4.shards.find(
      (blockRes) =>
        blockRes.seqno === lastKeyBlockData.info.prev_key_block_seqno,
    )!,
  );

  return {
    tonClient,
    tonClient4,
    initKeyBlockSeqno: lastKeyBlockData.info.prev_key_block_seqno,
    newKeyBlockSeqno: lastBlockData.info.prev_key_block_seqno,
    initialKeyBlockInfo: prevKeyBlock,
    newKeyBlockInfo: lastKeyBlock,
    shardBlocks: [] as string[],
  };
}

export async function getInitialBlock({
  tonClient4,
  initKeyBlockSeqno,
  newKeyBlockSeqno,
}: Awaited<ReturnType<typeof initExample>>) {
  const initialKeyBlockWithShards = await tonClient4.getBlock(initKeyBlockSeqno);

  const initialKeyBlockInformation = initialKeyBlockWithShards.shards.find(
    (blockRes) => blockRes.seqno === initKeyBlockSeqno,
  );

  if (!initialKeyBlockInformation) {
    throw Error('Block not found');
  }

  const initialKeyBlockWithBase64 = await getBlock(initialKeyBlockInformation);

  const lastBlockRootCell = readBlockRootCell(
    initialKeyBlockWithBase64.data,
    initialKeyBlockWithBase64.id.root_hash,
  );
  const lastBlockData = loadBlock(lastBlockRootCell);
  return { ...initialKeyBlockWithBase64, info: lastBlockData.info };
}

export async function parseShardBlockRocks(
  seqno: number,
  mcSeqno: number,
  tonClient4: TonClient4,
) {
  const blockWithShards = await tonClient4.getBlock(mcSeqno);
  const mcBlock = blockWithShards.shards.find(
    (blockRes) => blockRes.seqno === seqno && blockRes.workchain !== -1,
    // (blockRes) => blockRes.seqno === seqno,
  );

  if (!mcBlock) {
    throw Error('Block not found');
  }

  const mcBlockWithBase64 = await getBlock(mcBlock);

  const mcBlockCell = await TonRocks.types.Cell.fromBoc(
    Buffer.from(mcBlockWithBase64.data, 'base64').toString('hex'),
  );

  const mcBlockData = TonRocks.bc.BlockParser.parseBlock(mcBlockCell[0]);
  return {
    toc: mcBlockCell[0],
    boc: mcBlockData,
    ...mcBlockWithBase64,
  };
}

export async function parseMcBlockRocks(seqno: number, tonClient4: TonClient4) {
  const blockWithShards = await tonClient4.getBlock(seqno);
  const mcBlock = blockWithShards.shards.find(
    (blockRes) => blockRes.seqno === seqno && blockRes.workchain === -1,
    // (blockRes) => blockRes.seqno === seqno,
  );

  if (!mcBlock) {
    throw Error('Block not found');
  }

  const mcBlockWithBase64 = await getBlock(mcBlock);

  const mcBlockCell = await TonRocks.types.Cell.fromBoc(
    Buffer.from(mcBlockWithBase64.data, 'base64').toString('hex'),
  );

  const mcBlockData = TonRocks.bc.BlockParser.parseBlock(mcBlockCell[0]);
  return {
    toc: mcBlockCell[0],
    boc: mcBlockData,
    ...mcBlockWithBase64,
  };
}
