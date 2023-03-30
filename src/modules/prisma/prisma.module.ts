import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma/prisma.service';
import { TonBlockService } from './services/ton-block/ton-block.service';
import { TonTransactionService } from './services/ton-transaction/ton-transaction.service';

@Module({
  providers: [PrismaService, TonBlockService, TonTransactionService],
  exports: [PrismaService, TonBlockService, TonTransactionService],
})
export class PrismaModule {}
