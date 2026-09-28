-- CreateEnum
CREATE TYPE "GuestPhotoKind" AS ENUM ('BEFORE', 'AFTER', 'OTHER');

-- CreateEnum
CREATE TYPE "WaitlistKind" AS ENUM ('WAITLIST', 'WALK_IN');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'BOOKED', 'SERVED', 'LEFT', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "allergies" TEXT;

-- CreateTable
CREATE TABLE "ColourFormula" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "staffId" TEXT,
    "appointmentId" TEXT,
    "title" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColourFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestPhoto" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "kind" "GuestPhotoKind" NOT NULL DEFAULT 'OTHER',
    "file" TEXT NOT NULL,
    "caption" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "kind" "WaitlistKind" NOT NULL DEFAULT 'WAITLIST',
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "guestId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'ru',
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT,
    "date" DATE NOT NULL,
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "note" TEXT,
    "source" "BookingSource" NOT NULL DEFAULT 'CMS',
    "token" TEXT NOT NULL,
    "offerId" TEXT,
    "offerExpiresAt" TIMESTAMP(3),
    "offers" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ColourFormula_guestId_createdAt_idx" ON "ColourFormula"("guestId", "createdAt");

-- CreateIndex
CREATE INDEX "GuestPhoto_guestId_createdAt_idx" ON "GuestPhoto"("guestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_token_key" ON "WaitlistEntry"("token");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_offerId_key" ON "WaitlistEntry"("offerId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_date_idx" ON "WaitlistEntry"("status", "date");

-- AddForeignKey
ALTER TABLE "ColourFormula" ADD CONSTRAINT "ColourFormula_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColourFormula" ADD CONSTRAINT "ColourFormula_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColourFormula" ADD CONSTRAINT "ColourFormula_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPhoto" ADD CONSTRAINT "GuestPhoto_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPhoto" ADD CONSTRAINT "GuestPhoto_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

