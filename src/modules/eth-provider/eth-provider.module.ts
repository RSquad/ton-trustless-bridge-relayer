import { Module } from '@nestjs/common';
import { ProviderService } from './services/provider/provider.service';
import { ContractService } from './services/contract/contract.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [ProviderService, ContractService],
  exports: [ProviderService, ContractService],
})
export class EthProviderModule {}
