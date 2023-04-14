import { Injectable } from '@nestjs/common';
import { Prisma, TonTransaction } from '@prisma/client';
import { BaseTonTransactionInfo } from 'src/lib/types';
import { LoggerService } from 'src/modules/logger/services/logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TonTransactionService {
  constructor(private prisma: PrismaService, private logger: LoggerService) {}

  async createTonTransaction(tx: BaseTonTransactionInfo, blockId: number) {
    const exists = await this.prisma.tonTransaction.findFirst({
      where: {
        ...tx,
      },
    });

    if (exists) {
      const updatedBlock = await this.prisma.tonTransaction.update({
        where: { id: exists.id },
        data: {
          ...tx,
          checked: false,
          inprogress: false,
        },
      });

      this.logger.dbLog('[txDb] tx updated:', tx.hash);
      return updatedBlock;
    }

    const createdBlock = await this.prisma.tonTransaction.create({
      data: { ...tx, mcParent: { connect: { id: blockId } } },
    });
    this.logger.dbLog('[txDb] tx created:', tx.hash);
    return createdBlock;
  }

  updateTonTransactionStatus({
    txId,
    checked,
    inprogress,
  }: {
    txId: number;
    checked?: boolean;
    inprogress?: boolean;
  }) {
    return this.prisma.tonTransaction.update({
      where: {
        id: txId,
      },
      data: {
        ...{ checked, inprogress },
      },
    });
  }

  async tonTransaction(
    postWhereUniqueInput: Prisma.TonTransactionWhereUniqueInput,
  ) {
    return this.prisma.tonTransaction.findUnique({
      where: postWhereUniqueInput,
      include: {
        mcParent: {
          include: {
            mcParent: true,
          },
        },
      },
    });
  }

  async tonTransactions(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.TonTransactionWhereUniqueInput;
    where?: Prisma.TonTransactionWhereInput;
    orderBy?: Prisma.TonTransactionOrderByWithRelationInput;
  }) {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.tonTransaction.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        mcParent: {
          include: {
            mcParent: true,
          },
        },
      },
    });
  }
}
