import path from 'path';

import _ from 'lodash';
import axios from 'axios';

import { FileProvider } from './boc-provider';

const nodeCrypto = require('crypto');
const sha256 = (bytes: Uint8Array): Promise<ArrayBuffer> =>
  nodeCrypto.createHash('sha256').update(bytes).digest();

import {
  // CDataType,
  // CWorkchain,
  BlockIdExt,
  // ByteArray32,
  // ExtBlkRef,
  // MsgBlock,
  // ValidatorSet,
} from './ton-types';

// import OpenAPIClientAxios, { Document } from 'openapi-client-axios';
// import Scheme from './toncenter.v2.openapi.json';

// const api = new OpenAPIClientAxios({
//   // definition: 'https://example.com/api/openapi.json'
//   // definition: './toncenter.v2.openapi.json'
//   definition: Scheme as Document,
// });
// // api.init();

// // async function createPet() {
// //   const client = await api.getClient();
// //   const res = await client.createPet(null, { name: 'Garfield' });
// //   console.log('Pet created', res.data);
// // }

// import { Client as TONCenterClient } from './client.d.ts';

// // const client = await api.init<PetStoreClient>();
// // const client = await api.getClient<PetStoreClient>();
// const client = await api.init<TONCenterClient>();

class TONBaseProvider {
  constructor() {}
}

class TONHTTPProvider extends TONBaseProvider {
  constructor(
    private urlApi: string,
  ) {
    super();
  }

  // protected query
  // private async doCall<T>(method: string, body: any, codec: t.Type<T>) {
  protected async doCall<T>(
    method: string,
    body: any,
    codec: (obj: any) => T = (obj: any) => obj,
  ) {
    const headers: Record<string, any> = {
      // 'Content-Type': 'application/json',
      // 'accept: application/json'
      accept: 'application/json',
      // 'X-Ton-Client-Version': version,
    };
    // if (this.parameters.apiKey) {
    //   headers['X-API-Key'] = this.parameters.apiKey
    // }
    const res = await axios.get<{ ok: boolean, result: T }>(
      'https://toncenter.com/api/v2/getShardBlockProof?workchain=0&shard=-9223372036854775808&seqno=29860933',
      { headers },
    );
    // const res = await axios.post<{ ok: boolean, result: T }>(this.urlApi, JSON.stringify({
    //   id: '1',
    //   jsonrpc: '2.0',
    //   method: method,
    //   params: body
    // }), {
    //   headers,
    //   // timeout: this.parameters.timeout,
    // })
    if (res.status !== 200 || !res.data.ok) {
      throw Error('Received error: ' + JSON.stringify(res.data));
    }
    // const decoded = codec.decode(res.data.result);
    const decoded = codec(res.data.result);

    // if (isRight(decoded)) {
    //   return decoded.right;
    // } else {
    //   // throw Error('Malformed response: ' + reporter.report(decoded).join(', '));
    //   throw Error('Malformed response');
    // }
    return decoded;
  }

}

export
class TONCenterProvider extends TONHTTPProvider {
  constructor(urlApi: string) {
    super(urlApi);
  }

  /*
    Get merkle proof of shardchain block.

    workchain  * integer (query) Block workchain id
    shard      * integer (query) Block shard id
    seqno      * integer (query) Block seqno
    from_seqno   integer (query) Seqno of masterchain block starting
      from which proof is required.
      If not specified latest masterchain block is used.
  */
  // const blockProof = provider.getShardBlockProof({
  //   workchain: 0,
  //   shard: '-9223372036854775808',
  //   seqno: 29860933,
  //   from_seqno: 24399808,
  // });
  // private
  async getShardBlockProof(...args: any[]) {
    return this.doCall<any>('', null, undefined);
  }

  /*
    Get up-to-date masterchain state.

    seqno * integer (query)
  */
  private getMasterchainBlockSignatures(seqno: number) {}
}

const mvk = (m: string[], v: any, k: string) => {
  m.push(`${ k }=${ v }`);
  return m;
};

export
class TONProvider {
  private fileProvider = new FileProvider(
    path.resolve(__dirname, '../data/testnet/tonapi.cache'),
  );
  constructor() {
    //
  }

  public async lookupBlock(params: {
    workchain: number;
    lt: string;
  }) {
    const { workchain, lt } = params;
    const shard = '-9223372036854775808';
    const strParams = _.reduce(
      { workchain, shard, lt },
      mvk,
      <string[]>[],
    ).join('&');

    const hashParams = await sha256(Uint8Array.from(Buffer.from(strParams, 'utf-8')));
    const res = await this.fileProvider.loadString(
      'lookupBlock',
      `${ Buffer.from(hashParams).toString('hex') }.json`,
    );

    return JSON.parse(res).result;
  }

  public async getBlockHeader(params: {
    workchain: number; // -1
    // "shard": "-9223372036854775808",
    seqno: number; // 4350531,
  }) {
    const { workchain, seqno } = params;
    const shard = '-9223372036854775808';
    const strParams = _.reduce(
      { workchain, shard, seqno },
      mvk,
      <string[]>[],
    ).join('&');

    const hashParams = await sha256(Uint8Array.from(Buffer.from(strParams, 'utf-8')));
    const res = await this.fileProvider.loadString(
      'getBlockHeader',
      `${ Buffer.from(hashParams).toString('hex') }.json`,
    );

    return JSON.parse(res).result;
  }

  public async getMasterchainBlockSignatures(seqnoFrom: BlockIdExt | number) {
    const from_seqno = (seqnoFrom instanceof BlockIdExt) ? seqnoFrom.SeqNo : seqnoFrom;
    const params = _.reduce(
      { from_seqno },
      mvk,
      <string[]>[],
    ).join('&');

    const hashParams = await sha256(Uint8Array.from(Buffer.from(params, 'utf-8')));
    const res = await this.fileProvider.loadString(
      'getMasterchainBlockSignatures',
      `${ Buffer.from(hashParams).toString('hex') }.json`,
    );

    return JSON.parse(res).result;
  }

  public async getShardBlockProof(
    shardBlock: BlockIdExt,
    seqnoFrom: BlockIdExt | number,
  ) {
    const from_seqno = (seqnoFrom instanceof BlockIdExt) ? seqnoFrom.SeqNo : seqnoFrom;
    const {
      workchain,
      shard,
      seqno,
    } = shardBlock.toJSON('toncenter');
    const params = _.reduce(
      { workchain, shard, seqno, from_seqno },
      mvk,
      <string[]>[],
    ).join('&');

    // const params = 'workchain=0&shard=-9223372036854775808&seqno=5190572&from_seqno=4351354';
    const hashParams = await sha256(Uint8Array.from(Buffer.from(params, 'utf-8')));
    // console.log(Buffer.from(hashParams).toString('hex'));

    // const params2 = 'workchain=0&shard=-9223372036854775808&seqno=5190572&from_seqno=4351354';
    // const hashParams2 = await sha256(Uint8Array.from(Buffer.from(params2, 'utf-8')));
    // console.log(Buffer.from(hashParams2).toString('hex'));

    // console.log({ workchain, shard, seqno, from_seqno });
    // console.log(params);
    // console.log(params2);
    // const res = await this.fileProvider.load('getShardBlockProof', hashParams);
    const res = await this.fileProvider.loadString(
      'getShardBlockProof',
      `${ Buffer.from(hashParams).toString('hex') }.json`,
    );

    return JSON.parse(res).result;
  }
  /*
  */
}
