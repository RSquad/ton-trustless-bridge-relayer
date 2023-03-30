import { Injectable } from '@nestjs/common';
import { TonBlockService } from 'src/modules/prisma/services/ton-block/ton-block.service';
import { TonTransactionService } from 'src/modules/prisma/services/ton-transaction/ton-transaction.service';

@Injectable()
export class ExplorerService {
  constructor(
    private tonBlockService: TonBlockService,
    private tonTransactionService: TonTransactionService,
  ) {}

  findLast5Transactions() {
    // TODO: include
    return this.tonTransactionService.tonTransactions({
      orderBy: { id: 'desc' },
      take: 5,
    });
  }

  findAllBlocks() {
    return this.tonBlockService.tonBlocks({
      where: {
        workchain: -1,
      },
      orderBy: { id: 'desc' },
      take: 20,
    });
  }

  findAllKeyBlocks() {
    return this.tonBlockService.tonBlocks({
      where: {
        workchain: -1,
        isKeyBlock: true,
      },
    });
  }

  findAllValidatedBlocks() {
    return this.tonBlockService.tonBlocks({
      where: {
        checked: true,
      },
      orderBy: { id: 'desc' },
      take: 20,
    });
  }

  findTransactionByHash(hash: string) {
    return this.tonTransactionService.tonTransactions({
      where: {
        hash: Buffer.from(hash, 'hex').toString('base64'),
      },
      orderBy: { id: 'desc' },
      take: 5,
    });
  }
}
