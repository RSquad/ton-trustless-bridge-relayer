import { Module } from '@nestjs/common';
import { LoggerModule } from '../logger/logger.module.js';
import { PrismaService } from './services/prisma/prisma.service.js';
import { TonBlockService } from './services/ton-block/ton-block.service.js';
import { TonTransactionService } from './services/ton-transaction/ton-transaction.service.js';

@Module({
  imports: [LoggerModule],
  providers: [PrismaService, TonBlockService, TonTransactionService],
  exports: [TonBlockService, TonTransactionService],
})
export class PrismaModule {}
