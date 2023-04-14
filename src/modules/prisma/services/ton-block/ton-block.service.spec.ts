import { Test, TestingModule } from '@nestjs/testing';
import { TonBlockService } from './ton-block.service';

describe('TonBlockService', () => {
  let service: TonBlockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TonBlockService],
    }).compile();

    service = module.get<TonBlockService>(TonBlockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
