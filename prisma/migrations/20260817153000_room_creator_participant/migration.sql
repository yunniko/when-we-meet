-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "creatorParticipantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Room_creatorParticipantId_key" ON "Room"("creatorParticipantId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_creatorParticipantId_fkey" FOREIGN KEY ("creatorParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
