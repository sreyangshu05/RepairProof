CREATE TYPE "FeatureFlagRolloutScope" AS ENUM ('PROFILE', 'ORGANIZATION');
CREATE TYPE "FeatureExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED');

CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "emergencyDisabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 0,
    "rolloutScope" "FeatureFlagRolloutScope" NOT NULL DEFAULT 'PROFILE',
    "allowedRoles" "UserRole"[] NOT NULL DEFAULT ARRAY[]::"UserRole"[],
    "organizationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");
CREATE INDEX "FeatureFlag_enabled_emergencyDisabled_idx"
  ON "FeatureFlag"("enabled", "emergencyDisabled");

CREATE TABLE "FeatureExperiment" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "flagId" TEXT NOT NULL,
    "status" "FeatureExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "allocationPercentage" INTEGER NOT NULL DEFAULT 0,
    "assignmentScope" "FeatureFlagRolloutScope" NOT NULL DEFAULT 'PROFILE',
    "variants" JSONB NOT NULL DEFAULT '[]',
    "metricKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeatureExperiment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeatureExperiment_flagId_fkey" FOREIGN KEY ("flagId")
      REFERENCES "FeatureFlag"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FeatureExperiment_key_key" ON "FeatureExperiment"("key");
CREATE UNIQUE INDEX "FeatureExperiment_flagId_key" ON "FeatureExperiment"("flagId");
CREATE INDEX "FeatureExperiment_status_updatedAt_idx"
  ON "FeatureExperiment"("status", "updatedAt");

CREATE TABLE "FeatureExperimentAssignment" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "subjectKey" CHAR(64) NOT NULL,
    "variantKey" VARCHAR(64) NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureExperimentAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeatureExperimentAssignment_experimentId_fkey" FOREIGN KEY ("experimentId")
      REFERENCES "FeatureExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FeatureExperimentAssignment_experimentId_subjectKey_key"
  ON "FeatureExperimentAssignment"("experimentId", "subjectKey");
CREATE INDEX "FeatureExperimentAssignment_experimentId_variantKey_idx"
  ON "FeatureExperimentAssignment"("experimentId", "variantKey");

CREATE TABLE "FeatureExperimentMetricEvent" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "metricKey" VARCHAR(80) NOT NULL,
    "sourceKey" CHAR(64) NOT NULL,
    "occurredAt" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureExperimentMetricEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeatureExperimentMetricEvent_experimentId_fkey" FOREIGN KEY ("experimentId")
      REFERENCES "FeatureExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeatureExperimentMetricEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId")
      REFERENCES "FeatureExperimentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FeatureExperimentMetricEvent_assignmentId_metricKey_sourceKey_key"
  ON "FeatureExperimentMetricEvent"("assignmentId", "metricKey", "sourceKey");
CREATE INDEX "FeatureExperimentMetricEvent_experimentId_metricKey_occurredAt_idx"
  ON "FeatureExperimentMetricEvent"("experimentId", "metricKey", "occurredAt");
