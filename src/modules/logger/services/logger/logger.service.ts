import { Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService {
  config = {
    apiCallLog: false,
    dbLog: false,
    validatorBlockLog: true,
  };

  apiLog(...args: any[]) {
    if (!this.config.apiCallLog) {
      return;
    }
    console.log(...args);
  }

  dbLog(...args: any[]) {
    if (!this.config.dbLog) {
      return;
    }
    console.log(...args);
  }

  validatorLog(...args: any[]) {
    if (!this.config.validatorBlockLog) {
      return;
    }
    console.log(...args);
  }
}
