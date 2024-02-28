/* eslint-disable @typescript-eslint/ban-ts-comment */
import path from 'path';
import fs from 'fs';

import TonRocks from './ton-rocks-js/index.js';

import { ByteArray32 } from './ton-types/index.js';
import _ from 'lodash';

const __dirname = path.resolve(path.dirname(''));

export class FileProvider {
  public constructor(private strPath: string) {}

  protected async readFile(strFileName: string): Promise<Buffer> {
    const buf = fs.readFileSync(path.resolve(this.strPath, strFileName));

    return buf;
  }

  public async load() {}
  public async loadString(...args: string[]): Promise<string> {
    // return this.readFile(path.resolve(...args));
    const str = fs.readFileSync(path.resolve(this.strPath, ...args), {
      encoding: 'utf-8',
    });

    return str;
  }
}

export class BocProvider extends FileProvider {
  private static instance: BocProvider | null = null;
  public static get Instance(): BocProvider {
    if (!BocProvider.instance) {
      BocProvider.instance = new BocProvider();
    }
    return BocProvider.instance;
  }

  protected constructor() {
    super(path.resolve(__dirname, '../data/testnet/blocks'));
  }

  public async getBlockByFileHash(boc: string | ByteArray32) {
    const s = _.isString(boc) ? boc : boc.toString('base64');
    const cellsBoc = await TonRocks.types.Cell.fromBoc(
      Buffer.from(s as string, 'base64').toString('hex'),
    );
    return cellsBoc[0];
  }
}
