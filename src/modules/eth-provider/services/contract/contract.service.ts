import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { Bridge, Validator } from 'src/contracts/typechain';
import { ProviderService } from '../provider/provider.service';
import ValidatorAbi from '../../../../contracts/contracts/Validator.sol/Validator.json';
import BridgeAbi from '../../../../contracts/contracts/Bridge.sol/Bridge.json';

@Injectable()
export class ContractService {
  validatorContract: Validator = new ethers.Contract(
    this.configService.get<string>('VALIDATOR_ADDR'),
    ValidatorAbi.abi,
    this.providerService.signer,
  ) as any;

  bridgeContract: Bridge = new ethers.Contract(
    this.configService.get<string>('BRIDGE_ADDR'),
    BridgeAbi.abi,
    this.providerService.signer,
  ) as any;

  baseAdapterAddr = this.configService.get<string>('BASEADAPTER_ADDR');

  constructor(
    private providerService: ProviderService,
    private configService: ConfigService,
  ) {}
}
