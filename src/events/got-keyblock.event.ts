import { TonBlock } from '@prisma/client';
import {
  BaseTonBlockInfo,
  LiteApiBlockResponse,
  ParsedBlock,
} from 'src/lib/types/index.js';

export class GotKeyblock {
  block: BaseTonBlockInfo;
  boc: LiteApiBlockResponse;
  toc: ParsedBlock;
  prismaBlock: TonBlock;

  constructor(
    _block: BaseTonBlockInfo,
    _boc: LiteApiBlockResponse,
    _toc: ParsedBlock,
    _prismaBlock: TonBlock,
  ) {
    this.block = _block;
    this.boc = _boc;
    this.toc = _toc;
    this.prismaBlock = _prismaBlock;
  }
}
