import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { ProviderService } from './services/provider/provider.service';
import { AccountController } from './controllers/account/account.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Account])],
  providers: [ProviderService],
  exports: [ProviderService],
  controllers: [AccountController],
})
export class EthProviderModule {}
