import { Module } from '@nestjs/common';
import { LoggerService } from './services/logger/logger.service.js';

@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
