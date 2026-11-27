CREATE TYPE "PriceObservationStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED');
CREATE TYPE "RepairComplexity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

CREATE TABLE "RepairPriceTransaction" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "invoiceEvidenceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "enteredByProfileId" TEXT NOT NULL,
  "reviewedByProfileId" TEXT,
  "status" "PriceObservationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "transactionAt" TIMESTAMP(3) NOT NULL,
  "countryCode" CHAR(2) NOT NULL,
  "regionCode" VARCHAR(80) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "deviceManufacturer" VARCHAR(120) NOT NULL,
  "deviceManufacturerNorm" VARCHAR(120) NOT NULL,
  "deviceModel" VARCHAR(160) NOT NULL,
  "deviceModelNorm" VARCHAR(160) NOT NULL,
  "faultType" VARCHAR(120) NOT NULL,
  "faultTypeNorm" VARCHAR(120) NOT NULL,
  "complexity" "RepairComplexity" NOT NULL,
  "labourAmount" DECIMAL(12,2) NOT NULL,
  "partsAmount" DECIMAL(12,2) NOT NULL,
  "additionalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "rejectionReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RepairPriceTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RepairPriceTransaction_positive_amounts_check" CHECK (
    "labourAmount" >= 0 AND "partsAmount" >= 0 AND "additionalAmount" >= 0 AND
    "taxAmount" >= 0 AND "totalAmount" > 0
  ),
  CONSTRAINT "RepairPriceTransaction_review_state_check" CHECK (
    ("status" = 'PENDING_REVIEW' AND "reviewedAt" IS NULL AND "reviewedByProfileId" IS NULL) OR
    ("status" IN ('ACCEPTED', 'REJECTED') AND "reviewedAt" IS NOT NULL AND "reviewedByProfileId" IS NOT NULL)
  )
);

CREATE TABLE "RepairPriceTransactionItem" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "componentName" VARCHAR(160) NOT NULL,
  "componentNameNorm" VARCHAR(160) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitAmount" DECIMAL(12,2) NOT NULL,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "source" "PartSource" NOT NULL,
  CONSTRAINT "RepairPriceTransactionItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RepairPriceTransactionItem_positive_amounts_check" CHECK (
    "quantity" > 0 AND "unitAmount" >= 0 AND "totalAmount" >= 0
  )
);

CREATE TABLE "RepairPriceIndex" (
  "id" TEXT NOT NULL,
  "countryCode" CHAR(2) NOT NULL,
  "regionCode" VARCHAR(80) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "period" DATE NOT NULL,
  "indexValue" DECIMAL(12,6) NOT NULL,
  "sourceName" VARCHAR(160) NOT NULL,
  "sourceUrl" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepairPriceIndex_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RepairPriceIndex_positive_value_check" CHECK ("indexValue" > 0)
);

CREATE UNIQUE INDEX "RepairPriceTransaction_caseId_key" ON "RepairPriceTransaction"("caseId");
CREATE UNIQUE INDEX "RepairPriceTransaction_caseId_shopId_key" ON "RepairPriceTransaction"("caseId", "shopId");
CREATE UNIQUE INDEX "RepairCase_id_shopId_price_fk_key" ON "RepairCase"("id", "shopId");
CREATE UNIQUE INDEX "Evidence_id_caseId_price_fk_key" ON "Evidence"("id", "caseId");
CREATE INDEX "RepairPriceTransaction_cohort_idx" ON "RepairPriceTransaction"("status", "currency", "countryCode", "regionCode", "transactionAt");
CREATE INDEX "RepairPriceTransaction_device_fault_idx" ON "RepairPriceTransaction"("status", "deviceManufacturerNorm", "deviceModelNorm", "faultTypeNorm", "complexity");
CREATE INDEX "RepairPriceTransaction_benchmark_cohort_idx" ON "RepairPriceTransaction"("status", "currency", "countryCode", "regionCode", "deviceManufacturerNorm", "deviceModelNorm", "faultTypeNorm", "complexity", "transactionAt");
CREATE INDEX "RepairPriceTransaction_shop_date_idx" ON "RepairPriceTransaction"("shopId", "transactionAt");
CREATE INDEX "RepairPriceTransaction_invoiceEvidenceId_idx" ON "RepairPriceTransaction"("invoiceEvidenceId");
CREATE INDEX "RepairPriceTransactionItem_component_source_idx" ON "RepairPriceTransactionItem"("componentNameNorm", "source", "transactionId");
CREATE UNIQUE INDEX "RepairPriceIndex_location_currency_period_key" ON "RepairPriceIndex"("countryCode", "regionCode", "currency", "period");

ALTER TABLE "RepairPriceTransaction" ADD CONSTRAINT "RepairPriceTransaction_caseId_shopId_fkey"
  FOREIGN KEY ("caseId", "shopId") REFERENCES "RepairCase"("id", "shopId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepairPriceTransaction" ADD CONSTRAINT "RepairPriceTransaction_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepairPriceTransaction" ADD CONSTRAINT "RepairPriceTransaction_invoiceEvidenceId_caseId_fkey"
  FOREIGN KEY ("invoiceEvidenceId", "caseId") REFERENCES "Evidence"("id", "caseId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepairPriceTransaction" ADD CONSTRAINT "RepairPriceTransaction_enteredByProfileId_fkey"
  FOREIGN KEY ("enteredByProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepairPriceTransaction" ADD CONSTRAINT "RepairPriceTransaction_reviewedByProfileId_fkey"
  FOREIGN KEY ("reviewedByProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepairPriceTransactionItem" ADD CONSTRAINT "RepairPriceTransactionItem_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "RepairPriceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
