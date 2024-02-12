import { Test, TestingModule } from '@nestjs/testing';
import { LightClientContractService } from './light-client-contract.service';

describe('LightClientContractService', () => {
  let service: LightClientContractService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LightClientContractService],
    }).compile();

    service = module.get<LightClientContractService>(LightClientContractService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
