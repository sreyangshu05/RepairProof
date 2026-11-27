-- Original evidence is private and immutable in object storage. Derived assets
-- are related records. Legacy URLs remain identifiable but are never rendered
-- as verified or signed private objects.
BEGIN;

CREATE TYPE "EvidencePurpose" AS ENUM (
  'PHOTOGRAPH', 'INVOICE', 'DIAGNOSTIC_REPORT', 'COMPONENT_DOCUMENTATION',
  'TEST_RESULT', 'REPAIR_COMPLETION', 'OTHER'
);
CREATE TYPE "EvidenceAssetRole" AS ENUM ('ORIGINAL', 'THUMBNAIL', 'PROCESSED');
CREATE TYPE "EvidenceMalwareStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'NOT_SCANNED');
CREATE TYPE "EvidenceUploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'EXPIRED');

ALTER TABLE "Evidence"
  ADD COLUMN "purpose" "EvidencePurpose" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "assetRole" "EvidenceAssetRole" NOT NULL DEFAULT 'ORIGINAL',
  ADD COLUMN "legacySourceUrl" TEXT,
  ADD COLUMN "legacyThumbnailUrl" TEXT,
  ADD COLUMN "verifiedMimeType" TEXT,
  ADD COLUMN "storagePath" TEXT,
  ADD COLUMN "contentSha256" CHAR(64),
  ADD COLUMN "malwareStatus" "EvidenceMalwareStatus" NOT NULL DEFAULT 'NOT_SCANNED',
  ADD COLUMN "malwareScannedAt" TIMESTAMP(3),
  ADD COLUMN "malwareSignature" TEXT,
  ADD COLUMN "retentionUntil" TIMESTAMP(3),
  ADD COLUMN "derivedFromId" TEXT,
  ADD COLUMN "legacyUnverified" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "truthfulContentAttestedAt" TIMESTAMP(3),
  ADD COLUMN "integrityStatement" TEXT;

UPDATE "Evidence" SET "legacySourceUrl" = "fileUrl", "legacyThumbnailUrl" = "thumbnailUrl";
ALTER TABLE "Evidence" ALTER COLUMN "fileUrl" DROP NOT NULL;
ALTER TABLE "Evidence" ALTER COLUMN "thumbnailUrl" DROP NOT NULL;
-- Keep external legacy URLs only in explicitly untrusted legacy fields.
UPDATE "Evidence" SET "fileUrl" = NULL, "thumbnailUrl" = NULL;
CREATE UNIQUE INDEX "Evidence_storagePath_key" ON "Evidence"("storagePath");
CREATE INDEX "Evidence_purpose_createdAt_idx" ON "Evidence"("purpose", "createdAt");
CREATE INDEX "Evidence_malwareStatus_retentionUntil_idx" ON "Evidence"("malwareStatus", "retentionUntil");
CREATE INDEX "Evidence_derivedFromId_idx" ON "Evidence"("derivedFromId");
UPDATE "Evidence" SET "legacyUnverified" = TRUE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_derivedFromId_fkey"
  FOREIGN KEY ("derivedFromId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ComponentReplacement" ADD COLUMN "evidenceId" TEXT, ADD COLUMN "evidenceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ComponentReplacement" ADD CONSTRAINT "ComponentReplacement_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ComponentReplacement_evidenceId_idx" ON "ComponentReplacement"("evidenceId");
CREATE INDEX "ComponentReplacement_evidenceIds_idx" ON "ComponentReplacement" USING GIN ("evidenceIds");
ALTER TABLE "TestResult" ADD COLUMN "evidenceId" TEXT, ADD COLUMN "evidenceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "TestResult_evidenceId_idx" ON "TestResult"("evidenceId");
CREATE INDEX "TestResult_evidenceIds_idx" ON "TestResult" USING GIN ("evidenceIds");

CREATE TABLE "EvidenceUploadIntent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "objectPath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "declaredMime" TEXT NOT NULL,
  "expectedBytes" INTEGER NOT NULL,
  CONSTRAINT "EvidenceUploadIntent_positive_size" CHECK ("expectedBytes" > 0 AND "expectedBytes" <= 104857600),
  "category" "EvidenceCategory" NOT NULL,
  "purpose" "EvidencePurpose" NOT NULL,
  "description" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" "EvidenceUploadStatus" NOT NULL DEFAULT 'PENDING',
  "scanStatus" "EvidenceMalwareStatus" NOT NULL DEFAULT 'PENDING',
  "scanSignature" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "evidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvidenceUploadIntent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EvidenceUploadIntent_objectPath_key" ON "EvidenceUploadIntent"("objectPath");
CREATE UNIQUE INDEX "EvidenceUploadIntent_caseId_idempotencyKey_key" ON "EvidenceUploadIntent"("caseId", "idempotencyKey");
CREATE UNIQUE INDEX "EvidenceUploadIntent_evidenceId_key" ON "EvidenceUploadIntent"("evidenceId");
CREATE INDEX "EvidenceUploadIntent_shopId_caseId_status_createdAt_idx" ON "EvidenceUploadIntent"("shopId", "caseId", "status", "createdAt");
CREATE INDEX "EvidenceUploadIntent_status_expiresAt_idx" ON "EvidenceUploadIntent"("status", "expiresAt");
ALTER TABLE "EvidenceUploadIntent" ADD CONSTRAINT "EvidenceUploadIntent_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceUploadIntent" ADD CONSTRAINT "EvidenceUploadIntent_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceUploadIntent" ADD CONSTRAINT "EvidenceUploadIntent_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceUploadIntent" ADD CONSTRAINT "EvidenceUploadIntent_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EvidenceDeletionRequest" (
  "id" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "EvidenceDeletionRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EvidenceDeletionRequest_evidenceId_status_requestedAt_idx" ON "EvidenceDeletionRequest"("evidenceId", "status", "requestedAt");
ALTER TABLE "EvidenceDeletionRequest" ADD CONSTRAINT "EvidenceDeletionRequest_evidenceId_fkey"
  FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceDeletionRequest" ADD CONSTRAINT "EvidenceDeletionRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceDeletionRequest" ADD CONSTRAINT "EvidenceDeletionRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
