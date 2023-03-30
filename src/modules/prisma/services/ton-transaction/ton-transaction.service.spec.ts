import { Test, TestingModule } from '@nestjs/testing';
import { TonTransactionService } from './ton-transaction.service';

describe('TonTransactionService', () => {
  let service: TonTransactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TonTransactionService],
    }).compile();

    service = module.get<TonTransactionService>(TonTransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
