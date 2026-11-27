import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export const PRODUCT_ANALYTICS_NOTICE_VERSION = '2026-11-24-v1';

export type ProductAnalyticsEventName =
  | 'account.registration_completed'
  | 'device.registration_completed'
  | 'repair_case.created'
  | 'diagnostic.submitted'
  | 'quotation.delivered'
  | 'repair.completion_documented'
  | 'warranty.claim_submitted'
  | 'certificate.accessed';

export interface ProductAnalyticsEventInput {
  name: Exclude<ProductAnalyticsEventName, 'certificate.accessed'>;
  sourceId: string;
  actorProfileId: string;
  shopId: string;
  role: string;
  journeyId?: string;
  properties?: Record<string, string | boolean>;
}

@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name);
  private retentionTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.retentionTimer = setInterval(() => void this.purgeExpiredEvents(), 24 * 60 * 60 * 1000);
    this.retentionTimer.unref?.();
    void this.purgeExpiredEvents();
  }

  onModuleDestroy() {
    if (this.retentionTimer) clearInterval(this.retentionTimer);
  }

  get collectionAvailable() {
    return (
      process.env.PRODUCT_ANALYTICS_ENABLED === 'true' &&
      Boolean(process.env.ANALYTICS_PSEUDONYM_SECRET && process.env.ANALYTICS_PSEUDONYM_SECRET.length >= 32)
    );
  }

  async getConsent(profileId: string) {
    const latest = await this.prisma.analyticsConsent.findFirst({
      where: { profileId, purpose: 'PRODUCT_ANALYTICS' },
      orderBy: { sequence: 'desc' },
      select: { decision: true, noticeVersion: true, decidedAt: true },
    });
    return {
      consented:
        latest?.decision === 'GRANTED' &&
        latest.noticeVersion === PRODUCT_ANALYTICS_NOTICE_VERSION,
      noticeVersion: latest?.noticeVersion ?? null,
      changedAt: latest?.decidedAt ?? null,
      collectionAvailable: this.collectionAvailable,
    };
  }

  async setConsent(profileId: string, enabled: boolean, noticeVersion: string) {
    if (noticeVersion !== PRODUCT_ANALYTICS_NOTICE_VERSION)
      throw new BadRequestException('The analytics notice has changed. Reload this preference and review it again.');

    const decision = enabled ? 'GRANTED' : 'WITHDRAWN';
    await this.prisma.$transaction(async (tx) => {
      // pg_advisory_xact_lock returns PostgreSQL `void`, which Prisma cannot
      // deserialize from `$queryRaw`. Cast its result to text so the lock is
      // still acquired inside this transaction and the result is Prisma-safe.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${profileId}))::text AS acquired`;
      await tx.analyticsConsent.create({
        data: { profileId, decision, noticeVersion: PRODUCT_ANALYTICS_NOTICE_VERSION },
      });
      if (!enabled) {
        const actorKey = this.pseudonym(`actor:${profileId}`);
        if (actorKey)
          await tx.productAnalyticsEvent.deleteMany({ where: { actorKey } });
        const experiments = await tx.featureExperiment.findMany({
          where: { assignmentScope: 'PROFILE' },
          select: { id: true, key: true },
        });
        const assignments = experiments.flatMap((experiment) => {
          const assignmentSecret = process.env.FEATURE_FLAG_ASSIGNMENT_SECRET;
          const subjectKey = assignmentSecret && assignmentSecret.length >= 32
            ? createHmac('sha256', assignmentSecret)
                .update(`assignment:${experiment.key}:${profileId}`)
                .digest('hex')
            : null;
          return subjectKey ? [{ experimentId: experiment.id, subjectKey }] : [];
        });
        if (assignments.length)
          await tx.featureExperimentAssignment.deleteMany({ where: { OR: assignments } });
      }
    });
    return this.getConsent(profileId);
  }

  /** Best-effort after-commit capture. Tracking outages never roll back repair work. */
  async record(input: ProductAnalyticsEventInput) {
    if (!this.collectionAvailable || input.role === 'PLATFORM_ADMIN') return;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.actorProfileId}))::text AS acquired`;
        const consent = await tx.analyticsConsent.findFirst({
          where: { profileId: input.actorProfileId, purpose: 'PRODUCT_ANALYTICS' },
          orderBy: { sequence: 'desc' },
          select: { decision: true, noticeVersion: true },
        });
        if (
          consent?.decision !== 'GRANTED' ||
          consent.noticeVersion !== PRODUCT_ANALYTICS_NOTICE_VERSION
        )
          return;
        const actorKey = this.pseudonym(`actor:${input.actorProfileId}`);
        const organizationKey = this.pseudonym(`organization:${input.shopId}`);
        const journeyKey = input.journeyId ? this.pseudonym(`journey:${input.journeyId}`) : null;
        const eventKey = this.pseudonym(`event:${input.name}:${input.sourceId}`);
        if (!actorKey || !organizationKey || !eventKey) return;
        const safeProperties = this.safeProperties(input.name, input.properties ?? {});
        await tx.productAnalyticsEvent.upsert({
          where: { eventKey },
          create: {
            eventKey,
            actorKey,
            organizationKey,
            journeyKey,
            name: input.name,
            role: input.role.toLowerCase(),
            properties: safeProperties,
            occurredAt: utcDay(new Date()),
          },
          update: {},
        });
      });
    } catch {
      this.logger.warn(`Product analytics event dropped: ${input.name}`);
    }
  }

  /** Public certificate traffic is counted in UTC-day buckets without visitor or certificate identity. */
  async recordAnonymousCertificateAccess(certificateNumber: string) {
    if (!this.collectionAvailable) return;
    try {
      const day = utcDay(new Date());
      const eventKey = this.pseudonym(`certificate-access:${certificateNumber}:${day.toISOString()}`);
      if (!eventKey) return;
      await this.prisma.productAnalyticsEvent.upsert({
        where: { eventKey },
        create: {
          eventKey,
          name: 'certificate.accessed',
          properties: { channel: 'public_certificate' },
          occurredAt: day,
        },
        update: {},
      });
    } catch {
      this.logger.warn('Anonymous certificate access metric was dropped');
    }
  }

  async purgeExpiredEvents() {
    try {
      const cutoff = utcDay(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
      await this.prisma.productAnalyticsEvent.deleteMany({ where: { occurredAt: { lt: cutoff } } });
    } catch {
      this.logger.warn('Product analytics retention cleanup was deferred');
    }
  }

  private pseudonym(value: string) {
    const secret = process.env.ANALYTICS_PSEUDONYM_SECRET;
    if (!secret || secret.length < 32) return null;
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private safeProperties(
    name: ProductAnalyticsEventName,
    properties: Record<string, string | boolean>,
  ) {
    const allowed: Record<string, readonly string[]> = {
      'account.registration_completed': ['channel'],
      'device.registration_completed': ['deviceCategory'],
      'repair_case.created': ['entryMode'],
      'diagnostic.submitted': ['findingCountBand'],
      'quotation.delivered': ['revisionBand', 'channel'],
      'repair.completion_documented': ['postRepairTestPresent'],
      'warranty.claim_submitted': [],
      'certificate.accessed': ['channel'],
    };
    const result: Record<string, string | boolean> = {};
    for (const key of allowed[name] ?? []) {
      const value = properties[key];
      if (typeof value === 'boolean') result[key] = value;
      else if (typeof value === 'string' && value.length <= 24) result[key] = value;
    }
    return result;
  }

  async summary(shopId: string) {
    const [casesByStatus, deviceCount, openDisputes, activeWarranties] = await Promise.all([
      this.prisma.repairCase.groupBy({
        by: ['status'],
        where: { shopId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.device.count({ where: { shopId, deletedAt: null } }),
      this.prisma.dispute.count({
        where: { repairCase: { shopId, deletedAt: null }, status: { in: ['OPEN', 'REVIEWING'] } },
      }),
      this.prisma.warranty.count({
        where: {
          repairCase: { shopId, deletedAt: null },
          status: 'ACTIVE',
          endsAt: { gt: new Date() },
        },
      }),
    ]);
    return {
      casesByStatus: Object.fromEntries(
        casesByStatus.map((item) => [item.status, item._count._all]),
      ),
      deviceCount,
      openDisputes,
      activeWarranties,
    };
  }

  /** Thresholded product-use rollup. It intentionally exposes no raw event or pseudonym values. */
  async productSummary() {
    const since = utcDay(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    const rows = await this.prisma.productAnalyticsEvent.findMany({
      where: { occurredAt: { gte: since } },
      select: { name: true, actorKey: true, journeyKey: true, occurredAt: true },
    });
    const eventCounts = new Map<string, number>();
    const journeyStages = new Map<string, Set<string>>();
    const activeByActor = new Map<string, Set<string>>();
    for (const row of rows) {
      eventCounts.set(row.name, (eventCounts.get(row.name) ?? 0) + 1);
      if (row.journeyKey) {
        const stages = journeyStages.get(row.journeyKey) ?? new Set<string>();
        stages.add(row.name);
        journeyStages.set(row.journeyKey, stages);
      }
      if (row.actorKey) {
        const days = activeByActor.get(row.actorKey) ?? new Set<string>();
        days.add(row.occurredAt.toISOString().slice(0, 10));
        activeByActor.set(row.actorKey, days);
      }
    }
    const stageCount = (eventName: string) =>
      [...journeyStages.values()].filter((stages) => stages.has(eventName)).length;
    const suppress = (count: number) => (count < 20 ? null : count);
    const adoption = Object.fromEntries(
      [...eventCounts.entries()].map(([name, count]) => [name, suppress(count)]),
    );
    const activeDays = [...activeByActor.values()].map((days) => days.size);
    return {
      windowDays: 90,
      minimumCellSize: 20,
      eventCounts: adoption,
      repairJourney: {
        created: suppress(stageCount('repair_case.created')),
        diagnosticSubmitted: suppress(stageCount('diagnostic.submitted')),
        quotationDelivered: suppress(stageCount('quotation.delivered')),
        completionDocumented: suppress(stageCount('repair.completion_documented')),
        note: 'Counts use consented staff events and pseudonymous repair journeys; they are workflow activity, not repair quality or customer value.',
      },
      consentedStaffActivity: {
        activeInWindow: suppress(activeByActor.size),
        activeOnMultipleDays: suppress(activeDays.filter((count) => count > 1).length),
        note: 'Opt-in coverage is incomplete; suppressed values are null.',
      },
    };
  }
}

function utcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
