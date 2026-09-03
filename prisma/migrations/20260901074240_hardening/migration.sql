-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
ADD COLUMN     "withholdingSlipDate" TIMESTAMP(3),
ADD COLUMN     "withholdingSlipNumber" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DocumentCounter" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCounter_kind_year_key" ON "DocumentCounter"("kind", "year");

-- CreateIndex
CREATE INDEX "Client_deletedAt_idx" ON "Client"("deletedAt");

-- CreateIndex
CREATE INDEX "Deal_deletedAt_idx" ON "Deal"("deletedAt");

-- CreateIndex
CREATE INDEX "Invoice_deletedAt_idx" ON "Invoice"("deletedAt");

-- CreateIndex
CREATE INDEX "Quote_deletedAt_idx" ON "Quote"("deletedAt");
