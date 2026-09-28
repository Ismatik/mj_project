-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "lang" TEXT NOT NULL DEFAULT 'ru';

-- AlterTable
ALTER TABLE "TelegramChat" ADD COLUMN     "lang" TEXT;

