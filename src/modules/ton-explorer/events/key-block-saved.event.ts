import { TonBlock } from '../entities/block.entity';

export class KeyBlockSaved {
  data: TonBlock;

  constructor(_data: TonBlock) {
    this.data = _data;
  }
}
