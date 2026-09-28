-- CreateEnum
CREATE TYPE "StockMoveKind" AS ENUM ('RECEIPT', 'SERVICE', 'WASTE', 'COUNT');

-- CreateEnum
CREATE TYPE "BridalStatus" AS ENUM ('NEW', 'CONFIRMED', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "DressBooking" ADD COLUMN     "bridalPackageId" TEXT;

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Расходники',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "packSize" INTEGER NOT NULL DEFAULT 1,
    "packPrice" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceConsumption" (
    "serviceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "ServiceConsumption_pkey" PRIMARY KEY ("serviceId","itemId")
);

-- CreateTable
CREATE TABLE "StockMove" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "kind" "StockMoveKind" NOT NULL,
    "saleId" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridalPackage" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "BridalStatus" NOT NULL DEFAULT 'NEW',
    "guestId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'ru',
    "weddingDate" DATE NOT NULL,
    "services" JSONB NOT NULL,
    "dressId" TEXT,
    "dressDays" INTEGER NOT NULL DEFAULT 0,
    "dressPrice" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "trialAppointmentId" TEXT,
    "note" TEXT,
    "source" "BookingSource" NOT NULL DEFAULT 'WEBSITE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BridalPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMove_itemId_createdAt_idx" ON "StockMove"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMove_createdAt_idx" ON "StockMove"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BridalPackage_number_key" ON "BridalPackage"("number");

-- AddForeignKey
ALTER TABLE "DressBooking" ADD CONSTRAINT "DressBooking_bridalPackageId_fkey" FOREIGN KEY ("bridalPackageId") REFERENCES "BridalPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceConsumption" ADD CONSTRAINT "ServiceConsumption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceConsumption" ADD CONSTRAINT "ServiceConsumption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridalPackage" ADD CONSTRAINT "BridalPackage_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridalPackage" ADD CONSTRAINT "BridalPackage_dressId_fkey" FOREIGN KEY ("dressId") REFERENCES "Dress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

