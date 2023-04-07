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

  countAllBlocks() {
    return this.tonBlockService.tonBlockCount({
      orderBy: { id: 'desc' },
    });
  }

  findAllBlocks(skip = 0) {
    return this.tonBlockService.tonBlocks({
      // where: {
      //   workchain: -1,
      // },
      orderBy: { id: 'desc' },
      take: 10,
      skip,
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

  countValidatedBlocks() {
    return this.tonBlockService.tonBlockCount({
      where: {
        checked: true,
        // workchain: -1,
      },
      orderBy: { id: 'desc' },
    });
  }

  findAllValidatedBlocks(skip = 0) {
    return this.tonBlockService.tonBlocks({
      where: {
        checked: true,
        // workchain: -1,
      },
      orderBy: { id: 'desc' },
      take: 10,
      skip,
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
