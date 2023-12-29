import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EthProviderModule } from '../eth-provider/eth-provider.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TonReaderModule } from '../ton-reader/ton-reader.module.js';
import { BlockSubscriptionService } from './services/block-subscription/block-subscription.service.js';
import { TonExplorerController } from './controllers/ton-explorer/ton-explorer.controller.js';
import { ExplorerService } from './services/explorer/explorer.service.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    TonReaderModule,
    EthProviderModule,
    PrismaModule,
  ],
  providers: [BlockSubscriptionService, ExplorerService],
  controllers: [TonExplorerController],
})
export class TonExplorerModule {}
