import { Body, Controller, Post } from '@nestjs/common';
import { TonTransaction } from '@prisma/client';
import { ValidatorService } from '../../services/validator/validator.service';

@Controller('validator')
export class ValidatorController {
  constructor(private validatorService: ValidatorService) {}

  @Post('checkmcblock')
  validateMcBlockByValidator(@Body() data: { id: number }) {
    return this.validatorService.validateMcBlockByValidator(data.id);
  }

  @Post('checktx')
  validateTransaction(@Body() data: TonTransaction) {
    return this.validatorService.validateTransaction(data);
  }

  @Post('checkshard')
  validateShardBlock(@Body() data: { id: number }) {
    return this.validatorService.validateShardBlock(data.id);
  }
}
