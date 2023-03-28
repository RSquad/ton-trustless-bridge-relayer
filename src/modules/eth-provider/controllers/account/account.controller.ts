import { Controller, Get } from '@nestjs/common';
import { ProviderService } from '../../services/provider/provider.service';

@Controller('account')
export class AccountController {
  constructor(private provider: ProviderService) {}

  @Get()
  getAccountBalance() {
    return this.provider.getAccount();
  }
}
