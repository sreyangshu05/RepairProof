-- Split tenant membership roles from platform-wide administrator access.
CREATE TYPE "OrganizationRole" AS ENUM ('TECHNICIAN', 'SHOP_OWNER');

-- Add platform administration and organization verification state.
CREATE TYPE "OrganizationVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "NotificationEmailStatus" AS ENUM ('NOT_QUEUED', 'QUEUED', 'SENDING', 'SENT', 'FAILED');
ALTER TYPE "UserRole" ADD VALUE 'PLATFORM_ADMIN';

ALTER TABLE "OrganizationMembership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "OrganizationMembership"
  ALTER COLUMN "role" TYPE "OrganizationRole"
  USING "role"::text::"OrganizationRole";
ALTER TABLE "OrganizationMembership" ALTER COLUMN "role" SET DEFAULT 'TECHNICIAN';

ALTER TABLE "Profile" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Shop"
  ADD COLUMN "verificationNotes" TEXT,
  ADD COLUMN "verificationStatus" "OrganizationVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" TEXT;

ALTER TABLE "Notification"
  ADD COLUMN "emailAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "emailLastError" TEXT,
  ADD COLUMN "emailLockedUntil" TIMESTAMP(3),
  ADD COLUMN "emailNextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "emailSentAt" TIMESTAMP(3),
  ADD COLUMN "emailStatus" "NotificationEmailStatus" NOT NULL DEFAULT 'NOT_QUEUED';

CREATE TABLE "PlatformAdmin" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "previousRole" "UserRole" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "grantedByProfileId" TEXT,
  CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAdminAuditEvent" (
  "id" TEXT NOT NULL,
  "actorProfileId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAdminAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdmin_profileId_key" ON "PlatformAdmin"("profileId");
CREATE INDEX "PlatformAdmin_active_grantedAt_idx" ON "PlatformAdmin"("active", "grantedAt");
CREATE INDEX "PlatformAdminAuditEvent_createdAt_idx" ON "PlatformAdminAuditEvent"("createdAt");
CREATE INDEX "PlatformAdminAuditEvent_targetType_targetId_createdAt_idx" ON "PlatformAdminAuditEvent"("targetType", "targetId", "createdAt");
CREATE INDEX "Notification_emailStatus_emailNextAttemptAt_createdAt_idx" ON "Notification"("emailStatus", "emailNextAttemptAt", "createdAt");
CREATE INDEX "Notification_emailStatus_emailLockedUntil_createdAt_idx" ON "Notification"("emailStatus", "emailLockedUntil", "createdAt");

ALTER TABLE "Shop" ADD CONSTRAINT "Shop_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformAdmin" ADD CONSTRAINT "PlatformAdmin_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformAdmin" ADD CONSTRAINT "PlatformAdmin_grantedByProfileId_fkey"
  FOREIGN KEY ("grantedByProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformAdminAuditEvent" ADD CONSTRAINT "PlatformAdminAuditEvent_actorProfileId_fkey"
  FOREIGN KEY ("actorProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
