import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EthProviderModule } from '../eth-provider/eth-provider.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TonReaderModule } from '../ton-reader/ton-reader.module';
import { BlockSubscriptionService } from './services/block-subscription/block-subscription.service';
import { TonExplorerController } from './controllers/ton-explorer/ton-explorer.controller';
import { ExplorerService } from './services/explorer/explorer.service';

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
