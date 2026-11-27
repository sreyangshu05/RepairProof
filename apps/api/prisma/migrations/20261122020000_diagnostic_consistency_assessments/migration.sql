CREATE TABLE "DiagnosticConsistencyAssessment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "requestedById" TEXT,
    "engineVersion" TEXT NOT NULL,
    "inputSha256" CHAR(64) NOT NULL,
    "signal" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticConsistencyAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiagnosticConsistencyAssessment_shopId_createdAt_idx"
    ON "DiagnosticConsistencyAssessment"("shopId", "createdAt");
CREATE INDEX "DiagnosticConsistencyAssessment_caseId_createdAt_idx"
    ON "DiagnosticConsistencyAssessment"("caseId", "createdAt");

ALTER TABLE "DiagnosticConsistencyAssessment"
    ADD CONSTRAINT "DiagnosticConsistencyAssessment_caseId_shopId_fkey"
    FOREIGN KEY ("caseId", "shopId") REFERENCES "RepairCase"("id", "shopId")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosticConsistencyAssessment"
    ADD CONSTRAINT "DiagnosticConsistencyAssessment_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosticConsistencyAssessment"
    ADD CONSTRAINT "DiagnosticConsistencyAssessment_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "Profile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
