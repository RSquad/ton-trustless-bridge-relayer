import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EthProviderModule } from '../eth-provider/eth-provider.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ValidatorService } from './services/validator/validator.service';
import { ValidatorController } from './controllers/validator/validator.controller';
import { TonReaderModule } from '../ton-reader/ton-reader.module';

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
