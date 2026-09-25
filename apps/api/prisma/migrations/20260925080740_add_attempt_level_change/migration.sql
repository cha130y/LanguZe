/*
  Warnings:

  - Added the required column `level_after` to the `attempts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "attempts" ADD COLUMN     "level_after" "mastery_level" NOT NULL,
ADD COLUMN     "level_before" "mastery_level";
