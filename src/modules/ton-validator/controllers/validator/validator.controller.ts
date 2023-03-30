import { Body, Controller, Post } from '@nestjs/common';
import { TonTransaction } from '@prisma/client';
// import { TonTransaction } from 'src/modules/ton-explorer/entities/transaction.entity';
import { ValidatorService } from '../../services/validator/validator.service';

@Controller('validator')
export class ValidatorController {
  constructor(private validatorService: ValidatorService) {}

  @Post('checkmcblock')
  validateMcBlockByValidator(@Body() data: { seqno: number }) {
    return this.validatorService.validateMcBlockByValidator(data.seqno);
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
