import { Module } from '@nestjs/common';
import { LoggerModule } from '../logger/logger.module.js';
import { PrismaService } from './services/prisma/prisma.service.js';
import { TonBlockService } from './services/ton-block/ton-block.service.js';
import { TonTransactionService } from './services/ton-transaction/ton-transaction.service.js';
import { EthBeaconService } from './services/eth-beacon/eth-beacon.service.js';

@Module({
  imports: [LoggerModule],
  providers: [PrismaService, TonBlockService, TonTransactionService, EthBeaconService],
  exports: [TonBlockService, TonTransactionService, EthBeaconService],
})
export class PrismaModule {}
