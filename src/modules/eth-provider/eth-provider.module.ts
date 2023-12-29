import { Module } from '@nestjs/common';
import { ProviderService } from './services/provider/provider.service.js';
import { ContractService } from './services/contract/contract.service.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [ProviderService, ContractService],
  exports: [ProviderService, ContractService],
})
export class EthProviderModule {}
