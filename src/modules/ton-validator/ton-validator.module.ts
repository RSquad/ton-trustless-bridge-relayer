import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EthProviderModule } from '../eth-provider/eth-provider.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ValidatorService } from './services/validator/validator.service.js';
import { ValidatorController } from './controllers/validator/validator.controller.js';
import { TonReaderModule } from '../ton-reader/ton-reader.module.js';

@Module({
  imports: [
    EthProviderModule,
    LoggerModule,
    PrismaModule,
    ConfigModule,
    TonReaderModule,
  ],
  providers: [ValidatorService],
  controllers: [ValidatorController],
})
export class TonValidatorModule {}
