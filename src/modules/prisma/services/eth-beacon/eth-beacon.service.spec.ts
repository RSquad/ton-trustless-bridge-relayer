import { Test, TestingModule } from '@nestjs/testing';
import { EthBeaconService } from './eth-beacon.service';

describe('EthBeaconService', () => {
  let service: EthBeaconService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EthBeaconService],
    }).compile();

    service = module.get<EthBeaconService>(EthBeaconService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
