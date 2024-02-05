import axios from 'axios';


export type TReceipt = {
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  blockNumber: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  effectiveGasPrice: string;
  from: string;
  to: string;
  contractAddress: string | null;
  logs: string[];
  logsBloom: string;
  status: string;
  type: string;
};

export type TReceiptWithProof = {
  receipt: TReceipt;
  receiptProof: string[];
};

export type TBlock = {
  author: string;
  difficulty: string;
  extraData: string;
  gasLimit: string;
  gasUsed: string;
  hash: string;
  logsBloom: string;
  miner: string;
  mixHash: string;
  nonce: string;
  number: string;
  parentHash: string;
  receiptsRoot: string;
  sha3Uncles: string;
  size: string;
  stateRoot: string;
  totalDifficulty: string;
  timestamp: string;
  baseFeePerGas: string;
  transactions: string[];
  transactionsRoot: string;
  uncles: unknown[];
  withdrawals: unknown[];
  withdrawalsRoot: string;
  blobGasUsed: string;
  excessBlobGas: string;
  parentBeaconBlockRoot: string;
};


export class NethermindApi {
  public constructor(
    private apiRoot: string,
  ) {
    //
  }

  public async getTransactionReceiptWithProof(
    txHash: string,
    includeHeader: boolean = false,
  )
    : Promise<TReceiptWithProof>
  {
    return this.call<TReceiptWithProof>(
      'proof_getTransactionReceipt',
      [ txHash, includeHeader ],
    );
  }

  public async getBlockByNumber(
    blockNumber: string,
    returnFullTransactionObjects: boolean = false,
  )
    : Promise<TBlock>
  {
    return this.call<TBlock>(
      'eth_getBlockByNumber',
      [ blockNumber, returnFullTransactionObjects ],
    );
  }

  private async call<T>(method: string, params: any[]) : Promise<T> {
    const res = await axios.post<{ ok: boolean, result: T }>(
      this.apiRoot, {
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }, {
        headers: {
          accept: 'application/json',
        },
      },
    );

    return res.data.result;
  }
}
