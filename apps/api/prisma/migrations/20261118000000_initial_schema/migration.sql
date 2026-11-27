-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TECHNICIAN', 'SHOP_OWNER');

-- CreateEnum
CREATE TYPE "DeviceCategory" AS ENUM ('SMARTPHONE', 'LAPTOP');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('REGISTERED', 'DIAGNOSING', 'QUOTED', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_REPAIR', 'VERIFYING', 'CERTIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('PHOTO', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "EvidenceCategory" AS ENUM ('INTAKE', 'DIAGNOSTIC', 'DURING_REPAIR', 'POST_REPAIR');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "QuotationItemType" AS ENUM ('PART', 'LABOR');

-- CreateEnum
CREATE TYPE "PartSource" AS ENUM ('OEM', 'AFTERMARKET', 'REFURBISHED', 'CUSTOMER_PROVIDED');

-- CreateEnum
CREATE TYPE "RepairStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TECHNICIAN',
    "shopId" TEXT,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logoUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "registeredById" TEXT NOT NULL,
    "category" "DeviceCategory" NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT,
    "imei" TEXT,
    "color" TEXT,
    "storageCapacity" TEXT,
    "intakePhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intakeCondition" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "technicianId" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'REGISTERED',
    "priority" "CasePriority" NOT NULL DEFAULT 'NORMAL',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "problemDescription" TEXT NOT NULL,
    "authorizationToken" TEXT NOT NULL,
    "authorizationExpiresAt" TIMESTAMP(3) NOT NULL,
    "estimatedCompletionAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RepairCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "capturedById" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL DEFAULT 'PHOTO',
    "category" "EvidenceCategory" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "description" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceAnnotation" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "laborCost" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "partsCost" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "totalCost" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "customerResponseNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "type" "QuotationItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "partName" TEXT,
    "partSource" "PartSource",
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairStep" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RepairStepStatus" NOT NULL DEFAULT 'PENDING',
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "partsUsed" JSONB NOT NULL DEFAULT '[]',
    "performedById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RepairStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "verifiedById" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "notes" TEXT,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "qrCodeUrl" TEXT NOT NULL,
    "verificationUrl" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "warrantyPeriodMonths" INTEGER NOT NULL DEFAULT 3,
    "warrantyTerms" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_shopId_idx" ON "Profile"("shopId");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Shop_ownerId_idx" ON "Shop"("ownerId");

-- CreateIndex
CREATE INDEX "Device_shopId_idx" ON "Device"("shopId");

-- CreateIndex
CREATE INDEX "Device_serialNumber_idx" ON "Device"("serialNumber");

-- CreateIndex
CREATE INDEX "Device_imei_idx" ON "Device"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "RepairCase_caseNumber_key" ON "RepairCase"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RepairCase_authorizationToken_key" ON "RepairCase"("authorizationToken");

-- CreateIndex
CREATE INDEX "RepairCase_shopId_idx" ON "RepairCase"("shopId");

-- CreateIndex
CREATE INDEX "RepairCase_deviceId_idx" ON "RepairCase"("deviceId");

-- CreateIndex
CREATE INDEX "RepairCase_technicianId_idx" ON "RepairCase"("technicianId");

-- CreateIndex
CREATE INDEX "RepairCase_status_idx" ON "RepairCase"("status");

-- CreateIndex
CREATE INDEX "RepairCase_authorizationToken_idx" ON "RepairCase"("authorizationToken");

-- CreateIndex
CREATE INDEX "Evidence_caseId_idx" ON "Evidence"("caseId");

-- CreateIndex
CREATE INDEX "Evidence_category_idx" ON "Evidence"("category");

-- CreateIndex
CREATE INDEX "EvidenceAnnotation_evidenceId_idx" ON "EvidenceAnnotation"("evidenceId");

-- CreateIndex
CREATE INDEX "Quotation_caseId_idx" ON "Quotation"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_caseId_version_key" ON "Quotation"("caseId", "version");

-- CreateIndex
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- CreateIndex
CREATE INDEX "RepairStep_caseId_idx" ON "RepairStep"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairStep_caseId_stepNumber_key" ON "RepairStep"("caseId", "stepNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_caseId_key" ON "Verification"("caseId");

-- CreateIndex
CREATE INDEX "Verification_caseId_idx" ON "Verification"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_caseId_key" ON "Certificate"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "Certificate_certificateNumber_idx" ON "Certificate"("certificateNumber");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairCase" ADD CONSTRAINT "RepairCase_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairCase" ADD CONSTRAINT "RepairCase_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairCase" ADD CONSTRAINT "RepairCase_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAnnotation" ADD CONSTRAINT "EvidenceAnnotation_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairStep" ADD CONSTRAINT "RepairStep_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RepairCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

