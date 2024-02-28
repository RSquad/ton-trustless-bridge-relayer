/*
  Warnings:

  - A unique constraint covering the columns `[ParentBeaconId]` on the table `Beacon` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Beacon_ParentBeaconId_key" ON "Beacon"("ParentBeaconId");

-- AddForeignKey
ALTER TABLE "Beacon" ADD CONSTRAINT "Beacon_ParentBeaconId_fkey" FOREIGN KEY ("ParentBeaconId") REFERENCES "Beacon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
