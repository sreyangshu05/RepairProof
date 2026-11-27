ALTER TABLE "Evidence"
ADD COLUMN "storageDeletionPending" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "EvidenceUploadIntent"
ADD COLUMN "storageDeletionPending" BOOLEAN NOT NULL DEFAULT false;

-- Existing rejected uploads may have been left in quarantine if an earlier
-- storage removal failed. Retry those removals through the retention worker.
UPDATE "EvidenceUploadIntent"
SET "storageDeletionPending" = true
WHERE "status" = 'REJECTED';
