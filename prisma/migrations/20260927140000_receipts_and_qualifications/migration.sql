-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "number" SERIAL NOT NULL;

-- CreateTable
CREATE TABLE "_ServiceStaff" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ServiceStaff_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ServiceStaff_B_index" ON "_ServiceStaff"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_number_key" ON "Sale"("number");

-- AddForeignKey
ALTER TABLE "_ServiceStaff" ADD CONSTRAINT "_ServiceStaff_A_fkey" FOREIGN KEY ("A") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServiceStaff" ADD CONSTRAINT "_ServiceStaff_B_fkey" FOREIGN KEY ("B") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

