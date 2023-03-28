import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EthProviderModule } from '../eth-provider/eth-provider.module';
import { TonBlock } from '../ton-explorer/entities/block.entity';
import { TonTransaction } from '../ton-explorer/entities/transaction.entity';
import { ValidatorService } from './services/validator/validator.service';
import { ValidatorController } from './controllers/validator/validator.controller';

@Module({
  imports: [
    EthProviderModule,
    ConfigModule,
    TypeOrmModule.forFeature([TonBlock, TonTransaction]),
  ],
  providers: [ValidatorService],
  controllers: [ValidatorController],
})
export class TonValidatorModule {}
