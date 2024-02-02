import {EventEmitter} from "events";

import type { LightClientRestTransport } from '@lodestar/light-client/transport';


export class FinalityWatcher
  extends EventEmitter
  // extends (EventEmitter as { new (): RestEvents })
  // extends (EventEmitter as { new (): StrictEventEmitter<EventEmitter, LightClientRestEvents> })
  // implements LightClientTranspor
{
  public constructor(
    protected transport: LightClientRestTransport, // LightClientTransport,
  ) {
    super();
  }

  public start() {
    this.run().catch(ex => console.log(ex));
  }

  private _currentSlot = 0;
  private async run() {
    while ( true ) {
      const update = await this.transport.getFinalityUpdate();
      const { slot } = update.data.attestedHeader.beacon;

      if ( this._currentSlot !== slot ) {
        this._currentSlot = slot;
        this.emit('finality', update);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
