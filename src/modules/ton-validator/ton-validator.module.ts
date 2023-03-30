import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EthProviderModule } from '../eth-provider/eth-provider.module';
import { ValidatorService } from './services/validator/validator.service';
import { ValidatorController } from './controllers/validator/validator.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [EthProviderModule, ConfigModule, PrismaModule],
  providers: [ValidatorService],
  controllers: [ValidatorController],
})
export class TonValidatorModule {}
