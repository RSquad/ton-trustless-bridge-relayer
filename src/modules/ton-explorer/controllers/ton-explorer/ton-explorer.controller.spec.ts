import { Test, TestingModule } from '@nestjs/testing';
import { TonExplorerController } from './ton-explorer.controller';

describe('TonExplorerController', () => {
  let controller: TonExplorerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TonExplorerController],
    }).compile();

    controller = module.get<TonExplorerController>(TonExplorerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
