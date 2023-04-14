import { Test, TestingModule } from '@nestjs/testing';
import { ValidatorController } from './validator.controller';

describe('ValidatorController', () => {
  let controller: ValidatorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ValidatorController],
    }).compile();

    controller = module.get<ValidatorController>(ValidatorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
