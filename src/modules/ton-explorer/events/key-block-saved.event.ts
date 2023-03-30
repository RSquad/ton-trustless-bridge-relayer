import { TonBlock } from '@prisma/client';

export class KeyBlockSaved {
  data: TonBlock;

  constructor(_data: TonBlock) {
    this.data = _data;
  }
}
