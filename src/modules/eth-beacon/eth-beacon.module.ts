import { Module } from '@nestjs/common';
import { BeaconService } from './beacon/beacon.service.js';

@Module({
  providers: [
    BeaconService,
  ]
})
export class EthBeaconModule {}
