import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class ProviderService {
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;

  constructor(private configService: ConfigService) {
    this.provider = new ethers.JsonRpcProvider(
      this.configService.get<string>('NETWORK'),
    );

    this.signer = new ethers.Wallet(
      this.configService.get<string>('PRIVATE_KEY'),
      this.provider,
    );

    this.provider.getBalance(this.signer.address).then(d => console.log('BALANCE:', d))
  }
}
