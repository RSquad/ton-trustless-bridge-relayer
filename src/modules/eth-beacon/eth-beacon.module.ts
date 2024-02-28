import { Module } from '@nestjs/common';
import { BeaconService } from './beacon/beacon.service.js';
import { BeaconController } from './beacon/beacon.controller.js';
import { LightClientContractService } from './beacon/light-client-contract/light-client-contract.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, HttpModule, ConfigModule],
  providers: [
    BeaconService,
    LightClientContractService
  ],
  exports: [BeaconService],
  controllers: [BeaconController]
})
export class EthBeaconModule {}
