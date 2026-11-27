CREATE TYPE "AnalyticsConsentDecision" AS ENUM ('GRANTED', 'WITHDRAWN');
CREATE TYPE "AnalyticsConsentPurpose" AS ENUM ('PRODUCT_ANALYTICS');

CREATE TABLE "AnalyticsConsent" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "profileId" TEXT NOT NULL,
    "purpose" "AnalyticsConsentPurpose" NOT NULL DEFAULT 'PRODUCT_ANALYTICS',
    "decision" "AnalyticsConsentDecision" NOT NULL,
    "noticeVersion" VARCHAR(40) NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsConsent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AnalyticsConsent_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AnalyticsConsent_sequence_key" ON "AnalyticsConsent"("sequence");

CREATE INDEX "AnalyticsConsent_profileId_decidedAt_idx"
  ON "AnalyticsConsent"("profileId", "decidedAt");

CREATE TABLE "ProductAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventKey" CHAR(64) NOT NULL,
    "actorKey" CHAR(64),
    "organizationKey" CHAR(64),
    "journeyKey" CHAR(64),
    "name" VARCHAR(64) NOT NULL,
    "role" VARCHAR(32),
    "properties" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductAnalyticsEvent_eventKey_key"
  ON "ProductAnalyticsEvent"("eventKey");
CREATE INDEX "ProductAnalyticsEvent_name_occurredAt_idx"
  ON "ProductAnalyticsEvent"("name", "occurredAt");
CREATE INDEX "ProductAnalyticsEvent_actorKey_occurredAt_idx"
  ON "ProductAnalyticsEvent"("actorKey", "occurredAt");
CREATE INDEX "ProductAnalyticsEvent_organizationKey_occurredAt_idx"
  ON "ProductAnalyticsEvent"("organizationKey", "occurredAt");
CREATE INDEX "ProductAnalyticsEvent_journeyKey_occurredAt_idx"
  ON "ProductAnalyticsEvent"("journeyKey", "occurredAt");
