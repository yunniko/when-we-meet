-- CreateEnum
CREATE TYPE "JoinRule" AS ENUM ('ANYONE', 'LISTED_ONLY');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "joinRule" "JoinRule" NOT NULL DEFAULT 'ANYONE',
ADD COLUMN     "ownershipVacant" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "joinedAt" TIMESTAMP(3);

-- Backfill: every participant that exists before G-004 was created by a
-- browser joining the room, so none of them is an unclaimed invited name.
UPDATE "Participant" SET "joinedAt" = "createdAt" WHERE "joinedAt" IS NULL;
