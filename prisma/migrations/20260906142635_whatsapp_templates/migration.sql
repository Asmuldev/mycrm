-- AlterTable
ALTER TABLE "CompanyProfile" ADD COLUMN     "waCountryCode" TEXT NOT NULL DEFAULT '62',
ADD COLUMN     "waInvoiceTemplate" TEXT,
ADD COLUMN     "waQuoteTemplate" TEXT,
ADD COLUMN     "waReminderTemplate" TEXT;
