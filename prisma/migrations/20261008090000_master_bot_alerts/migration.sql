-- A master links her own Telegram chat with "/master CODE" and receives her bookings there.
ALTER TABLE "Staff" ADD COLUMN "botCode" TEXT;
CREATE UNIQUE INDEX "Staff_botCode_key" ON "Staff"("botCode");

ALTER TABLE "TelegramChat" ADD COLUMN "staffId" TEXT;
CREATE INDEX "TelegramChat_staffId_idx" ON "TelegramChat"("staffId");
ALTER TABLE "TelegramChat" ADD CONSTRAINT "TelegramChat_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
