import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ethers } from 'ethers';
import { Account } from '../../entities/account.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ProviderService {
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;

  constructor(private configService: ConfigService) {
    this.provider = new ethers.JsonRpcProvider(
      configService.get<string>('NETWORK'),
    );

    this.signer = new ethers.Wallet(
      configService.get<string>('PRIVATE_KEY'),
      this.provider,
    );

    // this.init();
  }

  // async init() {
  //   const addr = await this.signer.getAddress();
  //   const userEx = await this.accountRepository.findOne({
  //     where: {
  //       address: addr,
  //     },
  //   });
  //   if (!userEx) {
  //     const newUser = this.accountRepository.create({ address: addr });
  //     newUser.initialBalance = ethers.formatEther(
  //       await this.provider.getBalance(addr),
  //     );
  //     newUser.balance = newUser.initialBalance;

  //     await this.accountRepository.insert(newUser);
  //   }

  //   setInterval(async () => {
  //     const user = await this.accountRepository.findOne({
  //       where: {
  //         address: addr,
  //       },
  //     });

  //     this.accountRepository.update(
  //       { id: user.id },
  //       { balance: ethers.formatEther(await this.provider.getBalance(addr)) },
  //     );
  //   }, 10000);
  // }

  // async getAccount() {
  //   const addr = await this.signer.getAddress();
  //   const userEx = await this.accountRepository.findOne({
  //     where: {
  //       address: addr,
  //     },
  //   });

  //   return userEx;
  // }
}
