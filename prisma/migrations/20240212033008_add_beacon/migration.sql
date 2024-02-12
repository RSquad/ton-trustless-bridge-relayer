-- CreateTable
CREATE TABLE "Beacon" (
    "id" SERIAL NOT NULL,
    "slot" INTEGER NOT NULL,
    "proposerIndex" INTEGER NOT NULL,
    "parentRoot" TEXT NOT NULL,
    "stateRoot" TEXT NOT NULL,
    "bodyRoot" TEXT NOT NULL,
    "ParentBeaconId" INTEGER,

    CONSTRAINT "Beacon_pkey" PRIMARY KEY ("id")
);
