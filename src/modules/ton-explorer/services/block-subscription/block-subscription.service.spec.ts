import { Test, TestingModule } from '@nestjs/testing';
import { BlockSubscriptionService } from './block-subscription.service';

describe('BlockSubscriptionService', () => {
  let service: BlockSubscriptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockSubscriptionService],
    }).compile();

    service = module.get<BlockSubscriptionService>(BlockSubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
