-- Preserve old quotation rows while making new quotations complete snapshots.
BEGIN;
ALTER TABLE "Quotation"
  ADD COLUMN "diagnosedIssue" TEXT NOT NULL DEFAULT 'Legacy quotation: diagnosed issue was not captured',
  ADD COLUMN "proposedRepair" TEXT NOT NULL DEFAULT 'Legacy quotation: proposed repair was not captured',
  ADD COLUMN "additionalCharges" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN "estimatedCompletionHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "warrantyTerms" TEXT NOT NULL DEFAULT 'Warranty terms were not captured on this legacy quotation';

CREATE TYPE "QuotationChangeRequestStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "QuotationEvidence" (
  "quotationId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuotationEvidence_pkey" PRIMARY KEY ("quotationId", "evidenceId")
);
CREATE INDEX "QuotationEvidence_evidenceId_idx" ON "QuotationEvidence"("evidenceId");
ALTER TABLE "QuotationEvidence" ADD CONSTRAINT "QuotationEvidence_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationEvidence" ADD CONSTRAINT "QuotationEvidence_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "QuotationChangeRequest" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,
  "replacementQuotationId" TEXT,
  "customerSignatureName" TEXT NOT NULL,
  "requestText" TEXT NOT NULL,
  "status" "QuotationChangeRequestStatus" NOT NULL DEFAULT 'OPEN',
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "QuotationChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuotationChangeRequest_caseId_idempotencyKey_key" ON "QuotationChangeRequest"("caseId", "idempotencyKey");
CREATE INDEX "QuotationChangeRequest_caseId_status_createdAt_idx" ON "QuotationChangeRequest"("caseId", "status", "createdAt");
CREATE INDEX "QuotationChangeRequest_quotationId_createdAt_idx" ON "QuotationChangeRequest"("quotationId", "createdAt");
ALTER TABLE "QuotationChangeRequest" ADD CONSTRAINT "QuotationChangeRequest_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationChangeRequest" ADD CONSTRAINT "QuotationChangeRequest_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuotationChangeRequest" ADD CONSTRAINT "QuotationChangeRequest_replacementQuotationId_fkey"
  FOREIGN KEY ("replacementQuotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Notifications can target a signed-in profile or a repair customer's email.
ALTER TABLE "Notification" ADD COLUMN "recipientEmail" TEXT;
ALTER TABLE "Notification" ALTER COLUMN "profileId" DROP NOT NULL;
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_profileId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipient_check"
  CHECK ("profileId" IS NOT NULL OR "recipientEmail" IS NOT NULL);
COMMIT;
