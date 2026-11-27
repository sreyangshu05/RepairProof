CREATE TYPE "NotificationCategory" AS ENUM ('CASE_UPDATES', 'QUOTATIONS', 'DIAGNOSTICS', 'WARRANTIES', 'DISPUTES');
ALTER TABLE "Notification" ADD COLUMN "category" "NotificationCategory" NOT NULL DEFAULT 'CASE_UPDATES';
ALTER TABLE "Notification" ADD COLUMN "deduplicationKey" TEXT;
ALTER TABLE "Notification" ADD COLUMN "emailText" TEXT;
ALTER TABLE "Notification" ADD COLUMN "inAppVisible" BOOLEAN NOT NULL DEFAULT true;
-- Existing previews may contain free-form notes, quote amounts, or bearer authorization URLs.
UPDATE "Notification"
SET "body" = 'A repair case update is ready to view.', "emailText" = NULL
WHERE "type" IN ('CUSTOMER_QUOTATION_READY', 'CUSTOMER_REQUESTED_QUOTATION_CHANGES', 'CUSTOMER_APPROVED_QUOTATION', 'CUSTOMER_REJECTED_QUOTATION');
CREATE UNIQUE INDEX "Notification_deduplicationKey_key" ON "Notification"("deduplicationKey");
CREATE INDEX "Notification_category_createdAt_idx" ON "Notification"("category", "createdAt");
CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPreference_profileId_category_key" ON "NotificationPreference"("profileId", "category");
CREATE INDEX "NotificationPreference_profileId_idx" ON "NotificationPreference"("profileId");
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
