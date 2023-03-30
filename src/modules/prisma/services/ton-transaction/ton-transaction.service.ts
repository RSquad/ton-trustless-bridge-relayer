import { Injectable } from '@nestjs/common';
import { TonTransaction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TonTransactionService {
  constructor(private prisma: PrismaService) {}

  async tonTransaction(
    postWhereUniqueInput: Prisma.TonTransactionWhereUniqueInput,
  ): Promise<TonTransaction | null> {
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

  async createTonTransaction(
    data: Prisma.TonTransactionCreateInput,
  ): Promise<TonTransaction> {
    return this.prisma.tonTransaction.create({
      data,
    });
  }

  async updateTonTransaction(params: {
    where: Prisma.TonTransactionWhereUniqueInput;
    data: Prisma.TonTransactionUpdateInput;
  }): Promise<TonTransaction> {
    const { data, where } = params;
    return this.prisma.tonTransaction.update({
      data,
      where,
    });
  }

  async deletePost(
    where: Prisma.TonTransactionWhereUniqueInput,
  ): Promise<TonTransaction> {
    return this.prisma.tonTransaction.delete({
      where,
    });
  }
}
