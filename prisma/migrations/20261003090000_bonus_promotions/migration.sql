-- CreateEnum
CREATE TYPE "BonusKind" AS ENUM ('EARN', 'SPEND', 'BIRTHDAY', 'WELCOME', 'MANUAL');

-- CreateEnum
CREATE TYPE "PromotionKind" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "fullPrice" INTEGER,
ADD COLUMN     "promotionId" TEXT;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "bonusBalance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "bonusAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bonusEarned" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promotionId" TEXT;

-- CreateTable
CREATE TABLE "BonusTx" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "kind" "BonusKind" NOT NULL,
    "saleId" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonusTx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleTg" TEXT,
    "titleEn" TEXT,
    "description" TEXT,
    "descriptionTg" TEXT,
    "descriptionEn" TEXT,
    "kind" "PromotionKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "serviceIds" TEXT[],
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "showOnSite" BOOLEAN NOT NULL DEFAULT true,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BonusTx_guestId_createdAt_idx" ON "BonusTx"("guestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusTx" ADD CONSTRAINT "BonusTx_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusTx" ADD CONSTRAINT "BonusTx_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

