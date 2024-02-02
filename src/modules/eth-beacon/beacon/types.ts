import { allForks } from "@lodestar/types";
import { ForkName } from "@lodestar/params";

import type { deneb } from '@lodestar/types';


export type TFinalityUpdate = {
  version: ForkName;
  data: allForks.LightClientFinalityUpdate
};

export type TOptimisticUpdate = {
  version: ForkName;
  data: allForks.LightClientOptimisticUpdate
};

export type TLightClientUpdate = {
  version: ForkName;
  data: allForks.LightClientUpdate;
};

export type TAllForksBlock = {
  version: ForkName;
  data: allForks.SignedBeaconBlock;
};

export type TDenebBlock = {
  version: ForkName;
  data: deneb.SignedBeaconBlock;
};

