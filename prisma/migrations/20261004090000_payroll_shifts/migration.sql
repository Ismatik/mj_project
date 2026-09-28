-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "salary" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StaffAdjustment" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayout" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "note" TEXT,
    "paidBy" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "payoutId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashShift" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "openingCash" INTEGER NOT NULL,
    "cashSales" INTEGER NOT NULL,
    "cardSales" INTEGER NOT NULL,
    "qrSales" INTEGER NOT NULL,
    "cashIn" INTEGER NOT NULL,
    "cashOut" INTEGER NOT NULL,
    "expectedCash" INTEGER NOT NULL,
    "countedCash" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "handedOver" INTEGER NOT NULL,
    "leftCash" INTEGER NOT NULL,
    "receipts" INTEGER NOT NULL,
    "revenue" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "note" TEXT,
    "closedBy" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAdjustment_staffId_month_idx" ON "StaffAdjustment"("staffId", "month");

-- CreateIndex
CREATE INDEX "StaffPayout_staffId_month_idx" ON "StaffPayout"("staffId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_payoutId_key" ON "CashMovement"("payoutId");

-- CreateIndex
CREATE INDEX "CashMovement_day_idx" ON "CashMovement"("day");

-- CreateIndex
CREATE UNIQUE INDEX "CashShift_day_key" ON "CashShift"("day");

-- AddForeignKey
ALTER TABLE "StaffAdjustment" ADD CONSTRAINT "StaffAdjustment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayout" ADD CONSTRAINT "StaffPayout_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "StaffPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

