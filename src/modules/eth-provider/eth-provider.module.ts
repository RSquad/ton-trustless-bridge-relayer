import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProviderService } from './services/provider/provider.service';
import { AccountController } from './controllers/account/account.controller';

@Module({
  imports: [ConfigModule],
  providers: [ProviderService],
  exports: [ProviderService],
  controllers: [AccountController],
})
export class EthProviderModule {}
