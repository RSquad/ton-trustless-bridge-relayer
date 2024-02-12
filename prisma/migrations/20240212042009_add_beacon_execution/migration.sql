-- CreateTable
CREATE TABLE "Execution" (
    "id" SERIAL NOT NULL,
    "parentHash" TEXT NOT NULL,
    "feeRecipient" TEXT NOT NULL,
    "stateRoot" TEXT NOT NULL,
    "receiptsRoot" TEXT NOT NULL,
    "logsBloom" TEXT NOT NULL,
    "prevRandao" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "gasLimit" INTEGER NOT NULL,
    "gasUsed" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "extraData" TEXT NOT NULL,
    "baseFeePerGas" TEXT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "transactionsRoot" TEXT NOT NULL,
    "withdrawalsRoot" TEXT NOT NULL,
    "beaconId" INTEGER,
    "executionBranch1" TEXT NOT NULL,
    "executionBranch2" TEXT NOT NULL,
    "executionBranch3" TEXT NOT NULL,
    "executionBranch4" TEXT NOT NULL,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Execution_beaconId_key" ON "Execution"("beaconId");

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_beaconId_fkey" FOREIGN KEY ("beaconId") REFERENCES "Beacon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
