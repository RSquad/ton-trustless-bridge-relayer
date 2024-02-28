import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Address, OpenedContract, Sender, TonClient, WalletContractV4 } from "ton";
import { LightClient } from "../LightClient.js";

@Injectable()
export class LightClientContractService {
  tonClient: TonClient;
  lightClientContract: OpenedContract<LightClient>;
  tonSender: Sender;
  tonSmcWalletV4: OpenedContract<WalletContractV4>;

  constructor(private configService: ConfigService) {
    this.tonClient = new TonClient({
      endpoint: this.configService.getOrThrow("TON_CLIENT_ENDPOINT"),
      apiKey: this.configService.getOrThrow("TONCENTER_API_KEY"),
    });
    this.lightClientContract = this.tonClient.open(
      LightClient.createFromAddress(
        Address.parse(
          this.configService.getOrThrow("TON_LIGHT_CLIENT_ADDRESS"),
        ),
      ),
    );
    this.tonSmcWalletV4 = this.tonClient.open(
      WalletContractV4.create({
        workchain: Address.parse(
          this.configService.getOrThrow("RELAYER_WALLET_V4_ADDR"),
        ).workChain,
        publicKey: Buffer.from(
          this.configService.getOrThrow("RELAYER_WALLET_V4_PUBLIC") as string,
          "hex",
        ),
      }),
    );
    console.log('PANIC:', Buffer.from(
      this.configService.getOrThrow("RELAYER_WALLET_V4_SECRET") as string,
      "hex",
    ).toString('hex'));
    console.log('PANIC:', this.configService.getOrThrow("RELAYER_WALLET_V4_ADDR"));
    console.log('PANIC:', Buffer.from(
      this.configService.getOrThrow("RELAYER_WALLET_V4_PUBLIC") as string,
      "hex",
    ).toString('hex'));
    this.tonSender = this.tonSmcWalletV4.sender(
      Buffer.from(
        this.configService.getOrThrow("RELAYER_WALLET_V4_SECRET") as string,
        "hex",
      ),
    );
  }
}
