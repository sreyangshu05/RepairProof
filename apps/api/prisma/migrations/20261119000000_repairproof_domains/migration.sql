-- CreateEnum
CREATE TYPE "DiagnosticStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'VOID');

-- CreateEnum
CREATE TYPE "WarrantyClaimStatus" AS ENUM ('OPEN', 'REVIEWING', 'APPROVED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TECHNICIAN',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnostic" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "DiagnosticStatus" NOT NULL DEFAULT 'DRAFT',
    "findings" JSONB NOT NULL,
    "severity" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Diagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "customerSignatureName" TEXT,
    "notes" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "source" "PartSource" NOT NULL DEFAULT 'AFTERMARKET',
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderThreshold" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentReplacement" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "componentId" TEXT,
    "authorId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "source" "PartSource" NOT NULL,
    "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComponentReplacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "details" JSONB,
    "notes" TEXT,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "certificateId" TEXT,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "terms" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyClaim" (
    "id" TEXT NOT NULL,
    "warrantyId" TEXT NOT NULL,
    "status" "WarrantyClaimStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationMembership_profileId_revokedAt_idx" ON "OrganizationMembership"("profileId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_shopId_profileId_key" ON "OrganizationMembership"("shopId", "profileId");

-- CreateIndex
CREATE INDEX "Diagnostic_caseId_createdAt_idx" ON "Diagnostic"("caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_quotationId_key" ON "Approval"("quotationId");

-- CreateIndex
CREATE INDEX "Approval_status_createdAt_idx" ON "Approval"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Component_shopId_deletedAt_idx" ON "Component"("shopId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Component_shopId_sku_key" ON "Component"("shopId", "sku");

-- CreateIndex
CREATE INDEX "ComponentReplacement_caseId_replacedAt_idx" ON "ComponentReplacement"("caseId", "replacedAt");

-- CreateIndex
CREATE INDEX "TestResult_caseId_testedAt_idx" ON "TestResult"("caseId", "testedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_caseId_key" ON "Warranty"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_certificateId_key" ON "Warranty"("certificateId");

-- CreateIndex
CREATE INDEX "Warranty_status_endsAt_idx" ON "Warranty"("status", "endsAt");

-- CreateIndex
CREATE INDEX "WarrantyClaim_warrantyId_status_idx" ON "WarrantyClaim"("warrantyId", "status");

-- CreateIndex
CREATE INDEX "Notification_profileId_readAt_createdAt_idx" ON "Notification"("profileId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_shopId_createdAt_idx" ON "AuditEvent"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Dispute_status_openedAt_idx" ON "Dispute"("status", "openedAt");

-- CreateIndex
CREATE INDEX "Dispute_caseId_openedAt_idx" ON "Dispute"("caseId", "openedAt");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnostic" ADD CONSTRAINT "Diagnostic_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnostic" ADD CONSTRAINT "Diagnostic_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentReplacement" ADD CONSTRAINT "ComponentReplacement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentReplacement" ADD CONSTRAINT "ComponentReplacement_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentReplacement" ADD CONSTRAINT "ComponentReplacement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill the explicit membership relation for profiles already attached to a shop.
INSERT INTO "OrganizationMembership" ("id", "shopId", "profileId", "role", "joinedAt")
SELECT (profile."id" || ':' || profile."shopId"), profile."shopId", profile."id", profile."role", profile."createdAt"
FROM "Profile" AS profile
WHERE profile."shopId" IS NOT NULL AND profile."deletedAt" IS NULL
ON CONFLICT ("shopId", "profileId") DO NOTHING;

