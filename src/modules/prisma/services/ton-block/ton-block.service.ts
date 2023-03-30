import { Injectable } from '@nestjs/common';
import { TonBlock, TonTransaction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TonBlockService {
  constructor(private prisma: PrismaService) {}

  async tonBlock(postWhereUniqueInput: Prisma.TonBlockWhereUniqueInput) {
    return this.prisma.tonBlock.findUnique({
      where: postWhereUniqueInput,
      include: {
        shards: {
          include: {
            transactions: true,
          },
        },
        mcParent: true,
        transactions: true,
      },
    });
  }

  async tonBlocks(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.TonBlockWhereUniqueInput;
    where?: Prisma.TonBlockWhereInput;
    orderBy?: Prisma.TonBlockOrderByWithRelationInput;
  }) {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.tonBlock.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: {
        shards: {
          include: {
            transactions: true,
          },
        },
        mcParent: true,
        transactions: true,
      },
    });
  }

  async createTonBlock(data: Prisma.TonBlockCreateInput): Promise<TonBlock> {
    return this.prisma.tonBlock.create({
      data,
    });
  }

  async updateTonBlock(params: {
    where: Prisma.TonBlockWhereUniqueInput;
    data: Prisma.TonBlockUpdateInput;
  }): Promise<TonBlock> {
    const { data, where } = params;
    return this.prisma.tonBlock.update({
      data,
      where,
    });
  }

  async deletePost(where: Prisma.TonBlockWhereUniqueInput): Promise<TonBlock> {
    return this.prisma.tonBlock.delete({
      where,
    });
  }
}
