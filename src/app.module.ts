import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { TonExplorerModule } from './modules/ton-explorer/ton-explorer.module';
import { TonReaderModule } from './modules/ton-reader/ton-reader.module';
import { EthProviderModule } from './modules/eth-provider/eth-provider.module';
import { TonValidatorModule } from './modules/ton-validator/ton-validator.module';
import { BridgeModule } from './modules/bridge/bridge.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from './modules/logger/logger.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    ConfigModule.forRoot(),
    EventEmitterModule.forRoot(),
    TonExplorerModule,
    TonReaderModule,
    EthProviderModule,
    TonValidatorModule,
    BridgeModule,
    PrismaModule,
    DashboardModule,
    HealthModule,
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
