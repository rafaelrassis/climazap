-- CreateEnum
CREATE TYPE "NudgeKind" AS ENUM ('NUDGE', 'SNOOZE');

-- CreateTable
CREATE TABLE "QuoteNudge" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NudgeKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteNudge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteNudge_userId_kind_createdAt_idx" ON "QuoteNudge"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteNudge_quoteId_idx" ON "QuoteNudge"("quoteId");

-- AddForeignKey
ALTER TABLE "QuoteNudge" ADD CONSTRAINT "QuoteNudge_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteNudge" ADD CONSTRAINT "QuoteNudge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
