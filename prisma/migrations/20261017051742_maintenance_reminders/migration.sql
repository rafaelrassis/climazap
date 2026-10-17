-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "reminderNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "reminderService" TEXT,
ADD COLUMN     "reminderText" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "reminderMonths" INTEGER,
ADD COLUMN     "reminderText" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultReminderMonths" INTEGER DEFAULT 6;
