import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TonApiService } from './services/ton-api/ton-api.service.js';

@Module({
  imports: [ConfigModule],
  providers: [TonApiService],
  exports: [TonApiService],
})
export class TonReaderModule {}
