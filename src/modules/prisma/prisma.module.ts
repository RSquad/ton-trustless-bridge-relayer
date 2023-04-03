import { Module } from '@nestjs/common';
import { LoggerModule } from '../logger/logger.module';
import { PrismaService } from './services/prisma/prisma.service';
import { TonBlockService } from './services/ton-block/ton-block.service';
import { TonTransactionService } from './services/ton-transaction/ton-transaction.service';

@Module({
  imports: [LoggerModule],
  providers: [PrismaService, TonBlockService, TonTransactionService],
  exports: [TonBlockService, TonTransactionService],
})
export class PrismaModule {}
