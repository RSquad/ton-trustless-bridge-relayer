-- CreateTable
CREATE TABLE "TonBlock" (
    "id" SERIAL NOT NULL,
    "workchain" INTEGER NOT NULL,
    "seqno" INTEGER NOT NULL,
    "shard" TEXT NOT NULL,
    "rootHash" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "inprogress" BOOLEAN NOT NULL DEFAULT false,
    "isKeyBlock" BOOLEAN NOT NULL DEFAULT false,
    "mcParentId" INTEGER,

    CONSTRAINT "TonBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TonTransaction" (
    "id" SERIAL NOT NULL,
    "account" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "lt" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "inprogress" BOOLEAN NOT NULL DEFAULT false,
    "mcParentId" INTEGER,

    CONSTRAINT "TonTransaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TonBlock" ADD CONSTRAINT "TonBlock_mcParentId_fkey" FOREIGN KEY ("mcParentId") REFERENCES "TonBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TonTransaction" ADD CONSTRAINT "TonTransaction_mcParentId_fkey" FOREIGN KEY ("mcParentId") REFERENCES "TonBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
