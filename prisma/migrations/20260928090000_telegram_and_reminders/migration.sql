-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "remindedDayAt" TIMESTAMP(3),
ADD COLUMN     "remindedHoursAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TelegramChat" (
    "id" TEXT NOT NULL,
    "guestId" TEXT,
    "firstName" TEXT,
    "username" TEXT,
    "state" JSONB NOT NULL DEFAULT '{}',
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramChat_guestId_idx" ON "TelegramChat"("guestId");

-- AddForeignKey
ALTER TABLE "TelegramChat" ADD CONSTRAINT "TelegramChat_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

