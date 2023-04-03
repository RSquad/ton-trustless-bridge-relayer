import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseTonBlockInfo } from 'src/lib/types';
import { LoggerService } from 'src/modules/logger/services/logger/logger.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TonBlockService {
  constructor(private prisma: PrismaService, private logger: LoggerService) {}

  async createTonBlock<T extends BaseTonBlockInfo>(
    block: T,
    isKeyBlock = false,
    parentId?: number,
  ) {
    const dtoBlock: BaseTonBlockInfo = {
      fileHash: block.fileHash,
      rootHash: block.rootHash,
      seqno: block.seqno,
      shard: block.shard,
      workchain: block.workchain,
    };
    // check if block is already in db
    console.log({
      workchain: dtoBlock.workchain,
      seqno: dtoBlock.seqno,
      shard: dtoBlock.shard,
    });
    const exists = await this.prisma.tonBlock.findFirst({
      where: {
        workchain: dtoBlock.workchain,
        seqno: dtoBlock.seqno,
        shard: dtoBlock.shard,
      },
    });

    if (exists) {
      const updatedBlock = await this.prisma.tonBlock.update({
        where: { id: exists.id },
        data: {
          ...dtoBlock,
          checked: false,
          isKeyBlock: isKeyBlock,
          inprogress: false,
        },
      });

      this.logger.dbLog(
        `[BlockDb] ${
          dtoBlock.workchain === -1 ? 'mc' : 'shard'
        } block updated:`,
        updatedBlock.seqno,
      );
      return updatedBlock;
    }

    const connect = !!parentId
      ? {
          mcParent: {
            connect: {
              id: parentId,
            },
          },
        }
      : undefined;
    const createdBlock = await this.prisma.tonBlock.create({
      data: {
        ...dtoBlock,
        isKeyBlock: isKeyBlock,
        ...connect,
      },
    });
    this.logger.dbLog(
      `[BlockDb] ${dtoBlock.workchain === -1 ? 'mc' : 'shard'} block created:`,
      createdBlock.seqno,
    );
    return createdBlock;
  }

  updateTonBlockStatus({
    blockId,
    checked,
    inprogress,
  }: {
    blockId: number;
    checked?: boolean;
    inprogress?: boolean;
  }) {
    return this.prisma.tonBlock.update({
      where: {
        id: blockId,
      },
      data: {
        ...{ checked, inprogress },
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
}
