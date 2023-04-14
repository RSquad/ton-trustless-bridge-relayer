import { Test, TestingModule } from '@nestjs/testing';
import { TonApiService } from './ton-api.service';

describe('TonApiService', () => {
  let service: TonApiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TonApiService],
    }).compile();

    service = module.get<TonApiService>(TonApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
