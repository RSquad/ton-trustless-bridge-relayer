import {EventEmitter} from "events";

import type { LightClientRestTransport } from '@lodestar/light-client/transport';


export class OptimisticWatcher extends EventEmitter {
  public constructor(
    protected transport: LightClientRestTransport,
  ) {
    super();
  }

  public start() {
    this.run().catch(ex => console.log(ex));
  }

  private _currentSlot = 0;
  private async run() {
    while ( true ) {
      const update = await this.transport.getOptimisticUpdate();
      const { slot } = update.data.attestedHeader.beacon;

      if ( this._currentSlot !== slot ) {
        this._currentSlot = slot;
        this.emit('optimistic', update);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
