import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { TonExplorerModule } from './modules/ton-explorer/ton-explorer.module.js';
import { TonReaderModule } from './modules/ton-reader/ton-reader.module.js';
import { EthProviderModule } from './modules/eth-provider/eth-provider.module.js';
import { TonValidatorModule } from './modules/ton-validator/ton-validator.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';

import { HealthModule } from './modules/health/health.module.js';
import { LoggerModule } from './modules/logger/logger.module.js';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EthBeaconModule } from './modules/eth-beacon/eth-beacon.module.js';

@Module({
  imports: [
    ConfigModule.forRoot(),
    EventEmitterModule.forRoot(),
    TonExplorerModule,
    TonReaderModule,
    EthProviderModule,
    TonValidatorModule,
    PrismaModule,
    HealthModule,
    LoggerModule,
    EthBeaconModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
