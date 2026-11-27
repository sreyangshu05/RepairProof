-- Existing cases use the legacy lifecycle. Map their persisted status values
-- before replacing the PostgreSQL enum so existing repair records are retained.
BEGIN;
CREATE TYPE "CaseStatus_new" AS ENUM (
  'DRAFT', 'SUBMITTED', 'UNDER_DIAGNOSIS', 'DIAGNOSIS_COMPLETED',
  'QUOTATION_PENDING', 'AWAITING_CUSTOMER_APPROVAL', 'APPROVED', 'REJECTED',
  'IN_REPAIR', 'AWAITING_VERIFICATION', 'COMPLETED', 'DISPUTED', 'CANCELLED'
);
ALTER TABLE "RepairCase" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RepairCase" ALTER COLUMN "status" TYPE "CaseStatus_new" USING (
  CASE "status"::text
    WHEN 'REGISTERED' THEN 'SUBMITTED'
    WHEN 'DIAGNOSING' THEN 'UNDER_DIAGNOSIS'
    WHEN 'QUOTED' THEN 'QUOTATION_PENDING'
    WHEN 'AWAITING_APPROVAL' THEN 'AWAITING_CUSTOMER_APPROVAL'
    WHEN 'VERIFYING' THEN 'AWAITING_VERIFICATION'
    WHEN 'CERTIFIED' THEN 'AWAITING_VERIFICATION'
    ELSE "status"::text
  END
)::"CaseStatus_new";
ALTER TYPE "CaseStatus" RENAME TO "CaseStatus_legacy";
ALTER TYPE "CaseStatus_new" RENAME TO "CaseStatus";
DROP TYPE "CaseStatus_legacy";
ALTER TABLE "RepairCase" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

ALTER TABLE "Approval"
  ADD COLUMN "decisionIdempotencyKey" TEXT,
  ADD COLUMN "decisionRequestHash" TEXT;
CREATE UNIQUE INDEX "Approval_decisionIdempotencyKey_key" ON "Approval"("decisionIdempotencyKey");

ALTER TABLE "RepairStep"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "RepairStep_caseId_idempotencyKey_key" ON "RepairStep"("caseId", "idempotencyKey");

ALTER TABLE "Dispute"
  ALTER COLUMN "openedById" DROP NOT NULL,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestHash" TEXT;
ALTER TABLE "Dispute" DROP CONSTRAINT "Dispute_openedById_fkey";
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey"
  FOREIGN KEY ("openedById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Dispute_caseId_idempotencyKey_key" ON "Dispute"("caseId", "idempotencyKey");

CREATE TABLE "RepairCaseTransition" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "fromState" "CaseStatus",
  "toState" "CaseStatus" NOT NULL,
  "actorProfileId" TEXT,
  "actorRole" TEXT NOT NULL,
  "reason" TEXT,
  "supportingRecords" JSONB NOT NULL DEFAULT '[]',
  "idempotencyKey" TEXT,
  "requestHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepairCaseTransition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RepairCaseTransition_caseId_createdAt_idx" ON "RepairCaseTransition"("caseId", "createdAt");
CREATE INDEX "RepairCaseTransition_toState_createdAt_idx" ON "RepairCaseTransition"("toState", "createdAt");
CREATE UNIQUE INDEX "RepairCaseTransition_caseId_idempotencyKey_key" ON "RepairCaseTransition"("caseId", "idempotencyKey");
ALTER TABLE "RepairCaseTransition" ADD CONSTRAINT "RepairCaseTransition_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepairCaseTransition" ADD CONSTRAINT "RepairCaseTransition_actorProfileId_fkey"
  FOREIGN KEY ("actorProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VerificationAttempt" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "verifiedById" TEXT NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "notes" TEXT,
  "checklist" JSONB NOT NULL DEFAULT '[]',
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerificationAttempt_idempotencyKey_key" ON "VerificationAttempt"("idempotencyKey");
CREATE INDEX "VerificationAttempt_caseId_verifiedAt_idx" ON "VerificationAttempt"("caseId", "verifiedAt");
ALTER TABLE "VerificationAttempt" ADD CONSTRAINT "VerificationAttempt_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VerificationAttempt" ADD CONSTRAINT "VerificationAttempt_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed one immutable baseline event for each pre-existing case. Older
-- per-action records remain in AuditEvent and are not rewritten.
INSERT INTO "RepairCaseTransition" ("id", "caseId", "fromState", "toState", "actorRole", "reason", "supportingRecords", "createdAt")
SELECT md5('repair-lifecycle-migration:' || "id"), "id", NULL, "status", 'SYSTEM_MIGRATION',
       'Imported persisted status from the legacy repair lifecycle', '[]'::jsonb, CURRENT_TIMESTAMP
FROM "RepairCase";

INSERT INTO "AuditEvent" ("id", "shopId", "actorId", "action", "entityType", "entityId", "metadata", "createdAt")
SELECT md5('repair-lifecycle-audit-migration:' || "id"), "shopId", NULL, 'repair_case.lifecycle_migrated',
       'RepairCase', "id", jsonb_build_object('to', "status"::text, 'source', 'legacy lifecycle'), CURRENT_TIMESTAMP
FROM "RepairCase";
