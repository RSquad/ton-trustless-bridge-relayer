/*
  Warnings:

  - Added the required column `selfHash` to the `Beacon` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Beacon" ADD COLUMN     "selfHash" TEXT NOT NULL;
