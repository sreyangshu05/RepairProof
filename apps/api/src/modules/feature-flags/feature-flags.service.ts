import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { UserRole } from '@repairproof/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PRODUCT_ANALYTICS_NOTICE_VERSION } from '../analytics/analytics.service';
import {
  ConfigureExperimentDto,
  CreateFeatureFlagDto,
  ExperimentVariantDto,
  UpdateFeatureFlagDto,
} from './feature-flags.dto';

type Variant = { key: string; weight: number; enabled: boolean };

@Injectable()
export class FeatureFlagsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private retentionTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.retentionTimer = setInterval(() => void this.purgeExpiredExperimentData(), 24 * 60 * 60 * 1000);
    this.retentionTimer.unref?.();
    void this.purgeExpiredExperimentData();
  }

  onModuleDestroy() {
    if (this.retentionTimer) clearInterval(this.retentionTimer);
  }

  private get secret() {
    const secret = this.config.get<string>('FEATURE_FLAG_ASSIGNMENT_SECRET');
    return secret && secret.length >= 32 ? secret : null;
  }

  private get analyticsAvailable() {
    const analyticsSecret = this.config.get<string>('ANALYTICS_PSEUDONYM_SECRET');
    return this.config.get<string>('PRODUCT_ANALYTICS_ENABLED') === 'true' &&
      Boolean(analyticsSecret && analyticsSecret.length >= 32);
  }

  private digest(value: string) {
    const secret = this.secret;
    return secret ? createHmac('sha256', secret).update(value).digest('hex') : null;
  }

  private bucket(value: string) {
    const digest = this.digest(value);
    if (!digest) return null;
    return (Number.parseInt(digest.slice(0, 8), 16) / 0x1_0000_0000) * 100;
  }

  private isSensitiveKey(key: string) {
    return /(^|[._-])(auth|authorization|permission|access|policy|tenant|security|privacy|consent|evidence|approval|lifecycle|verification|audit|encryption|retention|billing|payment|identity|migration|transaction)([._-]|$)/i.test(key);
  }

  private validateKey(key: string) {
    if (this.isSensitiveKey(key))
      throw new BadRequestException('Feature flags cannot control authentication, permissions, evidence, approvals, verification, or repair lifecycle rules');
  }

  async create(actorId: string, dto: CreateFeatureFlagDto) {
    this.validateKey(dto.key);
    if (!dto.description.trim()) throw new BadRequestException('A feature description is required');
    await this.validateOrganizationIds(dto.organizationIds ?? []);
    const flag = await this.prisma.$transaction(async (tx) => {
      const created = await tx.featureFlag.create({
        data: {
          key: dto.key,
          description: dto.description.trim(),
          enabled: dto.enabled ?? false,
          rolloutPercentage: dto.rolloutPercentage ?? 0,
          rolloutScope: dto.rolloutScope ?? 'PROFILE',
          allowedRoles: dto.allowedRoles ?? [],
          organizationIds: [...new Set(dto.organizationIds ?? [])],
        },
      });
      await tx.platformAdminAuditEvent.create({
        data: {
          actorProfileId: actorId,
          action: 'feature_flag.created',
          targetType: 'FeatureFlag',
          targetId: created.id,
          metadata: { key: created.key, enabled: created.enabled },
        },
      });
      return created;
    });
    return flag;
  }

  async list() {
    const flags = await this.prisma.featureFlag.findMany({
      include: { experiment: true },
      orderBy: { key: 'asc' },
    });
    return {
      assignmentKeyConfigured: Boolean(this.secret),
      experimentMeasurementConfigured: this.analyticsAvailable && Boolean(this.secret),
      flags,
    };
  }

  async update(actorId: string, key: string, dto: UpdateFeatureFlagDto) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException('Feature flag not found');
    if (dto.description !== undefined && !dto.description.trim())
      throw new BadRequestException('A feature description is required');
    if (dto.organizationIds !== undefined) await this.validateOrganizationIds(dto.organizationIds);
    if (dto.rolloutScope === 'ORGANIZATION') {
      const running = await this.prisma.featureExperiment.findFirst({
        where: { flagId: existing.id, status: 'RUNNING' }, select: { id: true },
      });
      if (running)
        throw new BadRequestException('Pause profile-based experiments before changing rollout scope to organization');
    }
    const changes = Object.keys(dto);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.featureFlag.update({
        where: { id: existing.id },
        data: {
          ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
          ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
          ...(dto.emergencyDisabled !== undefined ? { emergencyDisabled: dto.emergencyDisabled } : {}),
          ...(dto.rolloutPercentage !== undefined ? { rolloutPercentage: dto.rolloutPercentage } : {}),
          ...(dto.rolloutScope !== undefined ? { rolloutScope: dto.rolloutScope } : {}),
          ...(dto.allowedRoles !== undefined ? { allowedRoles: dto.allowedRoles } : {}),
          ...(dto.organizationIds !== undefined ? { organizationIds: [...new Set(dto.organizationIds)] } : {}),
        },
      });
      const emergencyAction = dto.emergencyDisabled === true
        ? 'feature_flag.emergency_disabled'
        : dto.emergencyDisabled === false
          ? 'feature_flag.emergency_restored'
          : 'feature_flag.updated';
      await tx.platformAdminAuditEvent.create({
        data: {
          actorProfileId: actorId,
          action: emergencyAction,
          targetType: 'FeatureFlag',
          targetId: existing.id,
          metadata: { key, changedFields: changes },
        },
      });
      return result;
    });
    return updated;
  }

  private async validateOrganizationIds(organizationIds: string[]) {
    const uniqueIds = [...new Set(organizationIds)];
    if (!uniqueIds.length) return;
    const count = await this.prisma.shop.count({ where: { id: { in: uniqueIds }, deletedAt: null } });
    if (count !== uniqueIds.length)
      throw new BadRequestException('Organization targeting includes an unknown or inactive organization');
  }

  async configureExperiment(actorId: string, flagKey: string, dto: ConfigureExperimentDto) {
    this.validateKey(dto.key);
    const flag = await this.prisma.featureFlag.findUnique({ where: { key: flagKey } });
    if (!flag) throw new NotFoundException('Feature flag not found');
    const variants = this.validateVariants(dto.variants);
    const keyCollision = await this.prisma.featureExperiment.findUnique({ where: { key: dto.key } });
    if (keyCollision && keyCollision.flagId !== flag.id)
      throw new BadRequestException('Experiment key is already used by another feature flag');
    const metricKeys = [...new Set(dto.metricKeys ?? [])];
    if (metricKeys.length !== (dto.metricKeys ?? []).length)
      throw new BadRequestException('Experiment metric keys must be unique');
    if (dto.status === 'RUNNING' && flag.rolloutScope !== 'PROFILE')
      throw new BadRequestException('Experiments require profile rollout scope so consent and withdrawal apply to one participant');

    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.featureExperiment.findUnique({ where: { flagId: flag.id } });
      if (previous?.status === 'COMPLETED' && dto.status !== 'COMPLETED')
        throw new BadRequestException('A completed experiment is immutable; create a new experiment');
      const variantConfigChanged = previous && (
        previous.key !== dto.key ||
        JSON.stringify(previous.variants) !== JSON.stringify(variants) ||
        JSON.stringify(previous.metricKeys) !== JSON.stringify(metricKeys)
      );
      const assignmentScopeChanged = previous && previous.assignmentScope !== flag.rolloutScope;
      if (variantConfigChanged && previous?.status === 'RUNNING')
        throw new BadRequestException('Pause the experiment before editing its configuration');
      if ((variantConfigChanged || assignmentScopeChanged) && previous) {
        const assignments = await tx.featureExperimentAssignment.count({ where: { experimentId: previous.id } });
        if (assignments > 0)
          throw new BadRequestException('Variant, metric, and assignment-scope definitions cannot change after assignment; create a new experiment');
      }

      const now = new Date();
      const experiment = await tx.featureExperiment.upsert({
        where: { flagId: flag.id },
        create: {
          key: dto.key,
          flagId: flag.id,
          status: dto.status,
          allocationPercentage: dto.allocationPercentage,
          assignmentScope: flag.rolloutScope,
          variants,
          metricKeys,
          ...(dto.status === 'RUNNING' ? { startedAt: now } : {}),
          ...(dto.status === 'COMPLETED' ? { endedAt: now } : {}),
        },
        update: {
          status: dto.status,
          allocationPercentage: dto.allocationPercentage,
          ...(variantConfigChanged ? { key: dto.key, variants, metricKeys } : {}),
          ...(assignmentScopeChanged ? { assignmentScope: flag.rolloutScope } : {}),
          ...(dto.status === 'RUNNING' && previous?.status !== 'RUNNING' ? { startedAt: now, endedAt: null } : {}),
          ...(dto.status === 'COMPLETED' ? { endedAt: now } : {}),
          ...(dto.status !== 'COMPLETED' && previous?.status === 'COMPLETED' ? { endedAt: null } : {}),
        },
      });
      await tx.platformAdminAuditEvent.create({
        data: {
          actorProfileId: actorId,
          action: 'feature_experiment.configured',
          targetType: 'FeatureExperiment',
          targetId: experiment.id,
          metadata: {
            key: experiment.key,
            flagKey,
            status: experiment.status,
            allocationPercentage: experiment.allocationPercentage,
            variantKeys: variants.map((variant) => variant.key),
            metricKeys,
          },
        },
      });
      return experiment;
    });
  }

  private validateVariants(input: ExperimentVariantDto[]): Variant[] {
    const keys = new Set<string>();
    const variants = input.map((variant) => ({ ...variant }));
    for (const variant of variants) {
      if (keys.has(variant.key)) throw new BadRequestException('Experiment variant keys must be unique');
      keys.add(variant.key);
    }
    if (variants.reduce((total, variant) => total + variant.weight, 0) !== 100)
      throw new BadRequestException('Experiment variant weights must add up to 100');
    return variants;
  }

  async evaluate(profileId: string, organizationId: string | null, role: string) {
    try {
      const flags = await this.prisma.featureFlag.findMany({
        include: { experiment: true },
        orderBy: { key: 'asc' },
      });
      const result: Record<string, { enabled: boolean; variant?: string }> = {};
      for (const flag of flags) {
        const value = await this.evaluateOne(flag, profileId, organizationId, role);
        result[flag.key] = value;
      }
      return { flags: result, evaluatedAt: new Date().toISOString() };
    } catch {
      this.logger.warn('Feature evaluation unavailable; returning no enabled flags');
      return { flags: {}, evaluatedAt: new Date().toISOString(), degraded: true };
    }
  }

  async isEnabled(key: string, profileId: string, organizationId: string | null, role: string) {
    try {
      const flag = await this.prisma.featureFlag.findUnique({
        where: { key },
        include: { experiment: true },
      });
      if (!flag) return false;
      return (await this.evaluateOne(flag, profileId, organizationId, role)).enabled;
    } catch {
      this.logger.warn(`Feature evaluation unavailable; ${key} remains disabled`);
      return false;
    }
  }

  private async evaluateOne(
    flag: Prisma.FeatureFlagGetPayload<{ include: { experiment: true } }> | null,
    profileId: string,
    organizationId: string | null,
    role: string,
  ): Promise<{ enabled: boolean; variant?: string }> {
    try {
      if (!flag || !this.secret || this.isSensitiveKey(flag.key) || !flag.enabled || flag.emergencyDisabled) return { enabled: false };
      if (flag.rolloutPercentage < 0 || flag.rolloutPercentage > 100) return { enabled: false };
      if (role === UserRole.PLATFORM_ADMIN && !flag.allowedRoles.includes(UserRole.PLATFORM_ADMIN))
        return { enabled: false };
      if (flag.allowedRoles.length && !flag.allowedRoles.includes(role as UserRole)) return { enabled: false };
      if (flag.organizationIds.length && (!organizationId || !flag.organizationIds.includes(organizationId)))
        return { enabled: false };
      if (flag.rolloutScope === 'ORGANIZATION' && !organizationId) return { enabled: false };
      const subject = flag.rolloutScope === 'ORGANIZATION' ? organizationId! : profileId;
      const rollout = this.bucket(`flag:${flag.key}:${subject}`);
      if (rollout === null || rollout >= flag.rolloutPercentage) return { enabled: false };

      const experiment = flag.experiment;
      if (experiment?.status === 'RUNNING') {
        if (experiment.assignmentScope !== 'PROFILE') return { enabled: true };
        const experimentSubject = profileId;
        const experimentBucket = this.bucket(`experiment:${experiment.key}:${experimentSubject}`);
        if (experimentBucket !== null && experimentBucket < experiment.allocationPercentage) {
          const subjectKey = this.digest(`assignment:${experiment.key}:${experimentSubject}`);
          const variantBucket = this.bucket(`variant:${experiment.key}:${experimentSubject}`);
          if (subjectKey && variantBucket !== null) {
            const variants = this.readVariants(experiment.variants);
            const variantKey = this.selectVariant(variants, variantBucket);
            if (variantKey) {
              const assignment = await this.prisma.$transaction(async (tx) => {
                await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${profileId}))::text AS acquired`;
                if (!(await this.hasExperimentConsent(tx, profileId))) return null;
                return tx.featureExperimentAssignment.upsert({
                  where: { experimentId_subjectKey: { experimentId: experiment.id, subjectKey } },
                  create: { experimentId: experiment.id, subjectKey, variantKey },
                  update: {},
                  select: { variantKey: true },
                });
              });
              if (!assignment) return { enabled: true };
              const selected = variants.find((variant) => variant.key === assignment.variantKey);
              return { enabled: selected?.enabled ?? false, variant: assignment.variantKey };
            }
          }
        }
      }
      return { enabled: true };
    } catch {
      this.logger.warn(`Feature evaluation failed closed for ${flag?.key ?? 'unknown flag'}`);
      return { enabled: false };
    }
  }

  private async hasExperimentConsent(tx: Prisma.TransactionClient, profileId: string) {
    if (!this.analyticsAvailable) return false;
    const consent = await tx.analyticsConsent.findFirst({
      where: { profileId, purpose: 'PRODUCT_ANALYTICS' },
      orderBy: { sequence: 'desc' },
      select: { decision: true, noticeVersion: true },
    });
    return consent?.decision === 'GRANTED' && consent.noticeVersion === PRODUCT_ANALYTICS_NOTICE_VERSION;
  }

  private readVariants(value: unknown): Variant[] {
    if (!Array.isArray(value)) return [];
    const variants = value.filter((item): item is Variant =>
      Boolean(item && typeof item === 'object' &&
        typeof (item as Variant).key === 'string' &&
        Number.isInteger((item as Variant).weight) &&
        (item as Variant).weight > 0 && (item as Variant).weight <= 100 &&
        typeof (item as Variant).enabled === 'boolean'),
    );
    const uniqueKeys = new Set(variants.map((variant) => variant.key));
    return uniqueKeys.size === variants.length && variants.reduce((sum, variant) => sum + variant.weight, 0) === 100
      ? variants
      : [];
  }

  private selectVariant(variants: Variant[], bucket: number) {
    let upper = 0;
    for (const variant of variants) {
      upper += variant.weight;
      if (bucket < upper) return variant.key;
    }
    return null;
  }

  /** Internal domain-service API only. Never expose a client endpoint that accepts arbitrary metric claims. */
  async recordConfiguredMetric(profileId: string, sourceId: string, metricKey: string) {
    try {
      const experiments = await this.prisma.featureExperiment.findMany({
        where: { status: { in: ['RUNNING', 'COMPLETED'] }, metricKeys: { has: metricKey }, assignmentScope: 'PROFILE' },
        select: { key: true },
      });
      await Promise.all(experiments.map((experiment) =>
        this.recordMetric(experiment.key, profileId, sourceId, metricKey),
      ));
    } catch {
      this.logger.warn(`Experiment metric capture failed for ${metricKey}`);
    }
  }

  private async recordMetric(experimentKey: string, profileId: string, sourceId: string, metricKey: string) {
    try {
    const experiment = await this.prisma.featureExperiment.findUnique({ where: { key: experimentKey } });
    if (!experiment || !experiment.metricKeys.includes(metricKey) || experiment.status === 'DRAFT' || experiment.status === 'PAUSED') return;
    if (experiment.assignmentScope !== 'PROFILE') return;
    const subject = profileId;
    const subjectKey = this.digest(`assignment:${experiment.key}:${subject}`);
    const sourceKey = this.digest(`metric:${experiment.key}:${metricKey}:${sourceId}`);
    if (!subjectKey || !sourceKey) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${profileId}))::text AS acquired`;
      if (!(await this.hasExperimentConsent(tx, profileId))) return;
      const assignment = await tx.featureExperimentAssignment.findUnique({
        where: { experimentId_subjectKey: { experimentId: experiment.id, subjectKey } },
        select: { id: true },
      });
      if (!assignment) return;
      await tx.featureExperimentMetricEvent.upsert({
        where: {
          assignmentId_metricKey_sourceKey: {
            assignmentId: assignment.id,
            metricKey,
            sourceKey,
          },
        },
        create: {
          experimentId: experiment.id,
          assignmentId: assignment.id,
          metricKey,
          sourceKey,
          occurredAt: utcDay(new Date()),
        },
        update: {},
      });
    });
    } catch {
      this.logger.warn(`Experiment metric capture failed for ${experimentKey}`);
    }
  }

  async metrics(flagKey: string) {
    const experiment = await this.prisma.featureExperiment.findFirst({ where: { flag: { key: flagKey } } });
    if (!experiment) throw new NotFoundException('Feature experiment not found');
    const [assignments, metricGroups] = await Promise.all([
      this.prisma.featureExperimentAssignment.groupBy({
        by: ['variantKey'], where: { experimentId: experiment.id }, _count: { _all: true },
      }),
      this.prisma.featureExperimentMetricEvent.groupBy({
        by: ['assignmentId', 'metricKey'], where: { experimentId: experiment.id }, _count: { _all: true },
      }),
    ]);
    const assignmentIds = [...new Set(metricGroups.map((item) => item.assignmentId))];
    const assignmentRows = assignmentIds.length
      ? await this.prisma.featureExperimentAssignment.findMany({
          where: { id: { in: assignmentIds } }, select: { id: true, variantKey: true },
        })
      : [];
    const variantForAssignment = new Map(assignmentRows.map((item) => [item.id, item.variantKey]));
    const metrics: Record<string, Record<string, number>> = {};
    for (const row of metricGroups) {
      const variant = variantForAssignment.get(row.assignmentId);
      if (!variant) continue;
      metrics[row.metricKey] ??= {};
      metrics[row.metricKey]![variant] = (metrics[row.metricKey]![variant] ?? 0) + row._count._all;
    }
    const suppress = (count: number) => count < 20 ? null : count;
    return {
      experimentKey: experiment.key,
      status: experiment.status,
      minimumCellSize: 20,
      exposuresByVariant: Object.fromEntries(assignments.map((item) => [item.variantKey, suppress(item._count._all)])),
      metrics: Object.fromEntries(Object.entries(metrics).map(([metric, values]) => [
        metric,
        Object.fromEntries(Object.entries(values).map(([variant, count]) => [variant, suppress(count)])),
      ])),
    };
  }

  async emergencyDisable(actorId: string, key: string, disabled: boolean) {
    return this.update(actorId, key, { emergencyDisabled: disabled });
  }

  async purgeExpiredExperimentData() {
    try {
      const cutoff = utcDay(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
      await this.prisma.featureExperimentMetricEvent.deleteMany({ where: { occurredAt: { lt: cutoff } } });
      const assignmentCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      await this.prisma.featureExperimentAssignment.deleteMany({
        where: {
          assignedAt: { lt: assignmentCutoff },
          experiment: { status: { in: ['PAUSED', 'COMPLETED'] }, updatedAt: { lt: assignmentCutoff } },
        },
      });
    } catch {
      this.logger.warn('Feature experiment retention cleanup was deferred');
    }
  }
}

function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
