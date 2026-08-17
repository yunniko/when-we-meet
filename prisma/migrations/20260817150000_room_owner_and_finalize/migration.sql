-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "ownerToken" TEXT NOT NULL,
ADD COLUMN     "selectedDate" DATE,
ADD COLUMN     "selectedHour" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Room_ownerToken_key" ON "Room"("ownerToken");
