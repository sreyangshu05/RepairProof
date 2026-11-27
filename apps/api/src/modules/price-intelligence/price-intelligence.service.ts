import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, PriceObservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePriceTransactionDto,
  PriceBenchmarkQueryDto,
  ReviewPriceObservationDto,
  UpsertRepairPriceIndexDto,
} from './price-intelligence.dto';
import {
  normalizePriceLabel,
  pricePercentileRange,
  PriceSample,
  removePriceOutliers,
} from './price-statistics';

type BenchmarkTransaction = Prisma.RepairPriceTransactionGetPayload<{
  include: { items: { select: { unitAmount: true; source: true } } };
}>;

const MIN_REGIONAL_SAMPLES = 12;
const MIN_REGIONAL_SHOPS = 5;
const MIN_NATIONAL_SAMPLES = 20;
const MIN_NATIONAL_SHOPS = 8;
const MAX_SHOP_CONTRIBUTIONS = 3;
const MAX_QUERY_SAMPLES = 2_000;
const MAX_REFERENCE_AGE_MONTHS = 24;

@Injectable()
export class PriceIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async pendingReviews(limit = 50) {
    return this.prisma.repairPriceTransaction.findMany({
      where: { status: PriceObservationStatus.PENDING_REVIEW },
      orderBy: { createdAt: 'asc' },
      take: Math.max(1, Math.min(limit, 100)),
      select: {
        id: true,
        caseId: true,
        transactionAt: true,
        countryCode: true,
        regionCode: true,
        currency: true,
        deviceManufacturer: true,
        deviceModel: true,
        faultType: true,
        complexity: true,
        labourAmount: true,
        partsAmount: true,
        additionalAmount: true,
        taxAmount: true,
        totalAmount: true,
        createdAt: true,
        shop: { select: { id: true, name: true } },
        enteredBy: { select: { id: true, displayName: true } },
        repairCase: {
          select: {
            caseNumber: true,
            diagnostics: {
              where: { status: 'SUBMITTED' },
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { findings: true, severity: true, submittedAt: true },
            },
          },
        },
        invoiceEvidence: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            verifiedMimeType: true,
            fileSize: true,
            contentSha256: true,
          },
        },
        items: {
          select: {
            componentName: true,
            quantity: true,
            unitAmount: true,
            totalAmount: true,
            source: true,
          },
        },
      },
    });
  }

  async pendingInvoiceEvidenceId(id: string): Promise<string> {
    const pending = await this.prisma.repairPriceTransaction.findFirst({
      where: { id, status: PriceObservationStatus.PENDING_REVIEW },
      select: { invoiceEvidenceId: true },
    });
    if (!pending) throw new NotFoundException('Pending price observation not found');
    return pending.invoiceEvidenceId;
  }

  async recordReportedTransaction(
    caseId: string,
    shopId: string,
    actorId: string,
    idempotencyKey: string,
    dto: CreatePriceTransactionDto,
  ) {
    if (!idempotencyKey || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey))
      throw new BadRequestException(
        'Provide an Idempotency-Key with 8 to 128 letters, numbers, dots, underscores, colons, or hyphens',
      );
    const items = dto.items.map((item) => ({
      ...item,
      componentName: item.componentName.trim(),
      componentNameNorm: normalizePriceLabel(item.componentName),
      totalAmount: new Prisma.Decimal(item.unitAmount).mul(item.quantity),
    }));
    if (
      !normalizePriceLabel(dto.faultType) ||
      items.some((item) => !item.componentNameNorm || item.totalAmount.greaterThan('9999999999.99'))
    ) {
      throw new BadRequestException(
        'Fault and component labels must contain text, and line totals must fit supported currency precision',
      );
    }
    const parts = items.reduce((sum, item) => sum.add(item.totalAmount), new Prisma.Decimal(0));
    const expectedTotal = new Prisma.Decimal(dto.labourAmount)
      .add(parts)
      .add(dto.additionalAmount ?? 0)
      .add(dto.taxAmount ?? 0);
    if (expectedTotal.greaterThan('9999999999.99'))
      throw new BadRequestException('Invoice total exceeds supported currency precision');
    if (expectedTotal.sub(dto.totalAmount).abs().greaterThan('0.02'))
      throw new BadRequestException(
        'Invoice total must equal labour, listed parts, additional charges, and tax within 0.02',
      );
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ ...dto, items }))
      .digest('hex');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.repairPriceTransaction.findFirst({
            where: { caseId },
            include: { items: true },
          });
          if (existing) {
            if (existing.idempotencyKey === idempotencyKey && existing.requestHash === requestHash)
              return existing;
            throw new ConflictException(
              'A reported transaction already exists for this repair case',
            );
          }
          const repairCase = await tx.repairCase.findFirst({
            where: { id: caseId, shopId, deletedAt: null },
            select: { id: true, status: true, device: { select: { make: true, model: true } } },
          });
          if (!repairCase) throw new NotFoundException('Repair case not found');
          if (repairCase.status !== 'COMPLETED')
            throw new BadRequestException(
              'A price observation can only be recorded for a completed repair',
            );
          if (
            !normalizePriceLabel(repairCase.device.make) ||
            !normalizePriceLabel(repairCase.device.model) ||
            repairCase.device.make.length > 120 ||
            repairCase.device.model.length > 160
          ) {
            throw new BadRequestException(
              'The repair case needs a valid manufacturer and model before its invoice can be used as a price observation',
            );
          }
          const transactionAt = new Date(dto.transactionAt);
          if (transactionAt.getTime() > Date.now() + 24 * 60 * 60 * 1000)
            throw new BadRequestException('Transaction date cannot be in the future');
          const evidence = await tx.evidence.findFirst({
            where: {
              id: dto.invoiceEvidenceId,
              caseId,
              deletedAt: null,
              type: 'DOCUMENT',
              purpose: 'INVOICE',
              assetRole: 'ORIGINAL',
              malwareStatus: 'CLEAN',
              legacyUnverified: false,
              storagePath: { not: null },
            },
            select: { id: true },
          });
          if (!evidence)
            throw new BadRequestException(
              'Attach a clean, managed original invoice document from this repair case',
            );
          const observation = await tx.repairPriceTransaction.create({
            data: {
              caseId,
              shopId,
              invoiceEvidenceId: evidence.id,
              enteredByProfileId: actorId,
              idempotencyKey,
              requestHash,
              transactionAt,
              countryCode: dto.countryCode,
              regionCode: dto.regionCode.trim().toLocaleUpperCase('en-US'),
              currency: dto.currency,
              deviceManufacturer: repairCase.device.make.trim(),
              deviceManufacturerNorm: normalizePriceLabel(repairCase.device.make),
              deviceModel: repairCase.device.model.trim(),
              deviceModelNorm: normalizePriceLabel(repairCase.device.model),
              faultType: dto.faultType.trim(),
              faultTypeNorm: normalizePriceLabel(dto.faultType),
              complexity: dto.complexity,
              labourAmount: dto.labourAmount,
              partsAmount: parts,
              additionalAmount: dto.additionalAmount ?? 0,
              taxAmount: dto.taxAmount ?? 0,
              totalAmount: dto.totalAmount,
              items: {
                create: items.map(
                  ({
                    componentName,
                    componentNameNorm,
                    quantity,
                    unitAmount,
                    totalAmount,
                    source,
                  }) => ({
                    componentName,
                    componentNameNorm,
                    quantity,
                    unitAmount,
                    totalAmount,
                    source,
                  }),
                ),
              },
            },
            include: { items: true },
          });
          await tx.auditEvent.create({
            data: {
              shopId,
              actorId,
              action: 'price_observation.submitted',
              entityType: 'RepairPriceTransaction',
              entityId: observation.id,
              metadata: {
                caseId,
                invoiceEvidenceId: evidence.id,
                status: PriceObservationStatus.PENDING_REVIEW,
                currency: dto.currency,
              },
            },
          });
          return observation;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        const prior = await this.prisma.repairPriceTransaction.findUnique({
          where: { caseId },
          include: { items: true },
        });
        if (prior?.idempotencyKey === idempotencyKey && prior.requestHash === requestHash)
          return prior;
        if (prior)
          throw new ConflictException('A reported transaction already exists for this repair case');
        throw new ConflictException(
          'The transaction report changed concurrently; reload and retry with the same idempotency key',
        );
      }
      throw error;
    }
  }

  async reviewReportedTransaction(id: string, reviewerId: string, dto: ReviewPriceObservationDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const observation = await tx.repairPriceTransaction.findUnique({
          where: { id },
          select: {
            id: true,
            shopId: true,
            status: true,
            enteredByProfileId: true,
            caseId: true,
            invoiceEvidenceId: true,
          },
        });
        if (!observation) throw new NotFoundException('Price observation not found');
        if (observation.enteredByProfileId === reviewerId)
          throw new BadRequestException(
            'The person who entered a price observation cannot review it',
          );
        if (observation.status !== PriceObservationStatus.PENDING_REVIEW)
          throw new ConflictException('Price observation has already been reviewed');
        if (dto.status === 'REJECTED' && !dto.reason?.trim())
          throw new BadRequestException('Provide a reason when rejecting an observation');
        if (
          dto.status === 'ACCEPTED' &&
          (!dto.reviewChecklist ||
            Object.values(dto.reviewChecklist).some((checked) => checked !== true))
        ) {
          throw new BadRequestException(
            'Confirm every invoice, line-item, date, location, repair-scope, and complexity check before accepting a price observation',
          );
        }
        if (dto.status === 'ACCEPTED') {
          const evidence = await tx.evidence.findFirst({
            where: {
              id: observation.invoiceEvidenceId,
              caseId: observation.caseId,
              deletedAt: null,
              assetRole: 'ORIGINAL',
              malwareStatus: 'CLEAN',
              legacyUnverified: false,
            },
            select: { id: true },
          });
          if (!evidence)
            throw new ConflictException('Invoice evidence is no longer eligible for review');
        }
        const changed = await tx.repairPriceTransaction.updateMany({
          where: { id, status: PriceObservationStatus.PENDING_REVIEW },
          data: {
            status: dto.status,
            reviewedByProfileId: reviewerId,
            reviewedAt: new Date(),
            rejectionReason: dto.status === 'REJECTED' ? dto.reason!.trim() : null,
          },
        });
        if (changed.count !== 1)
          throw new ConflictException('Price observation changed during review');
        await tx.platformAdminAuditEvent.create({
          data: {
            actorProfileId: reviewerId,
            action: `price_observation.${dto.status.toLocaleLowerCase()}`,
            targetType: 'RepairPriceTransaction',
            targetId: id,
            metadata: {
              caseId: observation.caseId,
              shopId: observation.shopId,
              reason: dto.reason?.trim() ?? null,
              reviewChecklist: dto.reviewChecklist
                ? {
                    invoiceTotalsMatch: dto.reviewChecklist.invoiceTotalsMatch,
                    lineItemsAndSourcesMatch: dto.reviewChecklist.lineItemsAndSourcesMatch,
                    transactionDateAndRegionPlausible:
                      dto.reviewChecklist.transactionDateAndRegionPlausible,
                    repairScopeAndComplexityReviewed:
                      dto.reviewChecklist.repairScopeAndComplexityReviewed,
                  }
                : null,
            },
          },
        });
        await tx.auditEvent.create({
          data: {
            shopId: observation.shopId,
            actorId: reviewerId,
            action: `price_observation.${dto.status.toLocaleLowerCase()}`,
            entityType: 'RepairPriceTransaction',
            entityId: id,
            metadata: { caseId: observation.caseId },
          },
        });
        return tx.repairPriceTransaction.findUnique({
          where: { id },
          select: { id: true, status: true, reviewedAt: true, rejectionReason: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async upsertIndex(actorId: string, dto: UpsertRepairPriceIndexDto) {
    const period = new Date(dto.period);
    if (period.getUTCDate() !== 1)
      throw new BadRequestException('Price index period must be the first day of its month');
    const regionCode = dto.regionCode.trim().toLocaleUpperCase('en-US');
    return this.prisma.$transaction(
      async (tx) => {
        const index = await tx.repairPriceIndex.upsert({
          where: {
            countryCode_regionCode_currency_period: {
              countryCode: dto.countryCode,
              regionCode,
              currency: dto.currency,
              period,
            },
          },
          create: {
            countryCode: dto.countryCode,
            regionCode,
            currency: dto.currency,
            period,
            indexValue: dto.indexValue,
            sourceName: dto.sourceName.trim(),
            sourceUrl: dto.sourceUrl,
          },
          update: {
            indexValue: dto.indexValue,
            sourceName: dto.sourceName.trim(),
            sourceUrl: dto.sourceUrl,
            importedAt: new Date(),
          },
        });
        await tx.platformAdminAuditEvent.create({
          data: {
            actorProfileId: actorId,
            action: 'repair_price_index.upserted',
            targetType: 'RepairPriceIndex',
            targetId: index.id,
            metadata: {
              countryCode: dto.countryCode,
              regionCode,
              currency: dto.currency,
              period: period.toISOString(),
              sourceName: dto.sourceName.trim(),
            },
          },
        });
        return index;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async benchmark(query: PriceBenchmarkQueryDto, excludeShopId?: string) {
    const manufacturerNorm = normalizePriceLabel(query.manufacturer);
    const modelNorm = normalizePriceLabel(query.model);
    const faultTypeNorm = normalizePriceLabel(query.faultType);
    const componentNorm = normalizePriceLabel(query.component);
    if ([manufacturerNorm, modelNorm, faultTypeNorm, componentNorm].some((value) => !value))
      throw new BadRequestException('Comparison labels must contain letters or numbers');
    const now = new Date();
    const recentCutoff = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - MAX_REFERENCE_AGE_MONTHS, 1),
    );
    const commonWhere = {
      status: PriceObservationStatus.ACCEPTED,
      currency: query.currency,
      deviceManufacturerNorm: manufacturerNorm,
      deviceModelNorm: modelNorm,
      faultTypeNorm,
      complexity: query.complexity,
      transactionAt: { gte: recentCutoff, lte: now },
      items: {
        some: { componentNameNorm: componentNorm, source: query.partSource },
        every: { source: query.partSource },
      },
      ...(excludeShopId ? { shopId: { not: excludeShopId } } : {}),
    } as const;

    const localRecords = await this.prisma.repairPriceTransaction.findMany({
      where: {
        ...commonWhere,
        countryCode: query.countryCode,
        regionCode: query.regionCode.trim().toLocaleUpperCase('en-US'),
      },
      include: {
        items: {
          where: { componentNameNorm: componentNorm, source: query.partSource },
          select: { unitAmount: true, source: true },
        },
      },
      orderBy: { transactionAt: 'desc' },
      take: MAX_QUERY_SAMPLES,
    });
    let records = localRecords;
    let regionMatch: 'REGION' | 'COUNTRY' = 'REGION';
    if (!hasSufficientCohort(localRecords, MIN_REGIONAL_SAMPLES, MIN_REGIONAL_SHOPS)) {
      const national = await this.prisma.repairPriceTransaction.findMany({
        where: { ...commonWhere, countryCode: query.countryCode },
        include: {
          items: {
            where: { componentNameNorm: componentNorm, source: query.partSource },
            select: { unitAmount: true, source: true },
          },
        },
        orderBy: { transactionAt: 'desc' },
        take: MAX_QUERY_SAMPLES,
      });
      if (hasSufficientCohort(national, MIN_NATIONAL_SAMPLES, MIN_NATIONAL_SHOPS)) {
        records = national;
        regionMatch = 'COUNTRY';
      } else {
        return insufficientResult(query);
      }
    }

    // Prevent a single business from dominating a nominally large sample.
    const capped = capShopContributions(records, MAX_SHOP_CONTRIBUTIONS);
    let processed = await this.processCohort(capped, query, regionMatch, now);
    let minimumSamples = regionMatch === 'REGION' ? MIN_REGIONAL_SAMPLES : MIN_NATIONAL_SAMPLES;
    let minimumShops = regionMatch === 'REGION' ? MIN_REGIONAL_SHOPS : MIN_NATIONAL_SHOPS;
    if (
      !hasSufficientCohort(processed.samples, minimumSamples, minimumShops) &&
      regionMatch === 'REGION'
    ) {
      const national = await this.prisma.repairPriceTransaction.findMany({
        where: { ...commonWhere, countryCode: query.countryCode },
        include: {
          items: {
            where: { componentNameNorm: componentNorm, source: query.partSource },
            select: { unitAmount: true, source: true },
          },
        },
        orderBy: { transactionAt: 'desc' },
        take: MAX_QUERY_SAMPLES,
      });
      if (hasSufficientCohort(national, MIN_NATIONAL_SAMPLES, MIN_NATIONAL_SHOPS)) {
        regionMatch = 'COUNTRY';
        processed = await this.processCohort(
          capShopContributions(national, MAX_SHOP_CONTRIBUTIONS),
          query,
          regionMatch,
          now,
        );
        minimumSamples = MIN_NATIONAL_SAMPLES;
        minimumShops = MIN_NATIONAL_SHOPS;
      }
    }
    const { samples, outliersRemoved, adjustedForInflation, inflationAdjustedThrough } = processed;
    const uniqueShops = new Set(samples.map((sample) => sample.shopId)).size;
    if (!hasSufficientCohort(samples, minimumSamples, minimumShops))
      return insufficientResult(query);

    const range = pricePercentileRange(samples);
    const strong = samples.length >= 30 && uniqueShops >= 10 && regionMatch === 'REGION';
    const position =
      query.quoteAmount == null
        ? undefined
        : query.quoteAmount < range.low
          ? 'BELOW_RANGE'
          : query.quoteAmount > range.high
            ? 'ABOVE_RANGE'
            : 'WITHIN_RANGE';
    const since = samples.reduce(
      (earliest, sample) => (sample.transactionAt < earliest ? sample.transactionAt : earliest),
      samples[0].transactionAt,
    );
    const through = samples.reduce(
      (latest, sample) => (sample.transactionAt > latest ? sample.transactionAt : latest),
      samples[0].transactionAt,
    );
    return {
      status: 'AVAILABLE',
      dataSource: 'REVIEWED_COMPLETED_REPAIR_INVOICES',
      estimate: {
        low: money(range.low),
        high: money(range.high),
        currency: query.currency,
        basis: query.priceComponent,
      },
      rangeMeaning:
        'The low and high values are the 20th and 80th percentiles of comparable records after contribution caps and outlier filtering. This is a market comparison band, not a guaranteed quote or statistical confidence interval.',
      sampleSize: samples.length,
      independentRepairBusinesses: uniqueShops,
      reliability: strong ? 'STRONG' : 'MODERATE',
      reliabilityExplanation: strong
        ? 'This range is based on many reviewed invoice-backed reports from multiple repair businesses in the requested region.'
        : `This range meets the minimum evidence threshold of ${minimumSamples} reports across ${minimumShops} repair businesses; treat it as a rough comparison.`,
      comparableCriteria: {
        manufacturer: query.manufacturer.trim(),
        model: query.model.trim(),
        faultType: query.faultType.trim(),
        component: query.component.trim(),
        partSource: query.partSource,
        complexity: query.complexity,
        currency: query.currency,
        requestedCountry: query.countryCode,
        requestedRegion: query.regionCode,
        matchedLocationLevel: regionMatch,
        transactionWindow: { from: since.toISOString(), through: through.toISOString() },
        priceBasis: query.priceComponent,
        inflationAdjusted: adjustedForInflation,
        inflationAdjustedThrough: inflationAdjustedThrough?.toISOString() ?? null,
        includedTax: false,
      },
      outliersRemoved,
      quoteComparison: position
        ? {
            position,
            message:
              position === 'WITHIN_RANGE'
                ? 'The quote is within this comparison range. This does not confirm the quote is fair or the repair is necessary.'
                : `The quote is ${position === 'ABOVE_RANGE' ? 'above' : 'below'} this comparison range. Check repair scope, part source, warranty, taxes, and local availability. This is not a fraud finding.`,
          }
        : undefined,
      limitations: [
        'These are human-reviewed final-invoice amounts for completed repairs, not independently audited market prices, proof of payment settlement, or proof that a repair was performed correctly.',
        'The range describes the 20th to 80th percentile of comparable records; unusual scope or local supply can fall outside it.',
        ...(regionMatch === 'COUNTRY'
          ? [
              'There was insufficient local evidence, so this range uses other regions in the same country.',
            ]
          : []),
        ...(adjustedForInflation
          ? []
          : [
              'No complete official price-index series was available; records are recent and shown without inflation adjustment.',
            ]),
      ],
      notice:
        'A price outside this range is not evidence of fraud. Ask the repairer to explain differences in work, parts, warranty, tax, and availability.',
    };
  }

  private async processCohort(
    records: BenchmarkTransaction[],
    query: PriceBenchmarkQueryDto,
    regionMatch: 'REGION' | 'COUNTRY',
    now: Date,
  ) {
    const {
      samples: rawSamples,
      adjustedForInflation,
      inflationAdjustedThrough,
    } = await this.pricedSamples(records, query, regionMatch, now);
    const { samples, outliersRemoved } = removePriceOutliers(rawSamples);
    return { samples, outliersRemoved, adjustedForInflation, inflationAdjustedThrough };
  }

  private async pricedSamples(
    records: BenchmarkTransaction[],
    query: PriceBenchmarkQueryDto,
    regionMatch: 'REGION' | 'COUNTRY',
    now: Date,
  ): Promise<{
    samples: PriceSample[];
    adjustedForInflation: boolean;
    inflationAdjustedThrough: Date | null;
  }> {
    const exactRegion =
      regionMatch === 'REGION'
        ? query.regionCode.trim().toLocaleUpperCase('en-US')
        : '__NATIONAL__';
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const indexes = await this.prisma.repairPriceIndex.findMany({
      where: {
        countryCode: query.countryCode,
        regionCode: exactRegion,
        currency: query.currency,
        period: { lte: monthStart },
      },
      orderBy: { period: 'desc' },
      take: 60,
    });
    const indexByMonth = new Map(
      indexes.map((index) => [monthKey(index.period), Number(index.indexValue)]),
    );
    const targetIndexRecord = indexes[0];
    const currentIndex = targetIndexRecord ? Number(targetIndexRecord.indexValue) : undefined;
    const targetIndexPeriod = targetIndexRecord?.period ?? null;
    const rawPrices = records
      .map((record) => ({
        record,
        amount:
          query.priceComponent === 'LABOUR'
            ? Number(record.labourAmount)
            : query.priceComponent === 'COMPONENT'
              ? Number(record.items[0]?.unitAmount ?? 0)
              : Number(record.labourAmount) +
                Number(record.partsAmount) +
                Number(record.additionalAmount),
      }))
      .filter((item) => Number.isFinite(item.amount) && item.amount > 0);
    const completeIndexSeries =
      Boolean(currentIndex && targetIndexPeriod) &&
      rawPrices.every(
        ({ record }) =>
          monthKey(record.transactionAt) <= monthKey(targetIndexPeriod!) &&
          nearestIndex(indexByMonth, record.transactionAt) != null,
      );
    const nominalCutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
    const samples = rawPrices.flatMap(({ record, amount }) => {
      let adjusted = amount;
      if (completeIndexSeries)
        adjusted = (amount * currentIndex!) / nearestIndex(indexByMonth, record.transactionAt)!;
      else if (record.transactionAt < nominalCutoff) return [];
      return [
        {
          amount: adjusted,
          shopId: record.shopId,
          transactionAt: record.transactionAt,
        },
      ];
    });
    return {
      samples,
      adjustedForInflation: completeIndexSeries,
      inflationAdjustedThrough: completeIndexSeries ? targetIndexPeriod : null,
    };
  }
}

function hasSufficientCohort(
  records: Array<{ shopId: string }>,
  minCount: number,
  minShops: number,
): boolean {
  return (
    records.length >= minCount && new Set(records.map((record) => record.shopId)).size >= minShops
  );
}

function capShopContributions(
  records: BenchmarkTransaction[],
  cap: number,
): BenchmarkTransaction[] {
  const count = new Map<string, number>();
  return records.filter((record) => {
    const seen = count.get(record.shopId) ?? 0;
    if (seen >= cap) return false;
    count.set(record.shopId, seen + 1);
    return true;
  });
}

function insufficientResult(query: PriceBenchmarkQueryDto) {
  return {
    status: 'INSUFFICIENT_EVIDENCE',
    estimate: null,
    sampleSize: null,
    independentRepairBusinesses: null,
    reliability: 'INSUFFICIENT',
    comparableCriteria: {
      manufacturer: query.manufacturer.trim(),
      model: query.model.trim(),
      faultType: query.faultType.trim(),
      component: query.component.trim(),
      partSource: query.partSource,
      complexity: query.complexity,
      currency: query.currency,
      countryCode: query.countryCode,
      regionCode: query.regionCode,
    },
    reason:
      'RepairProof does not have enough reviewed, comparable invoice-backed transaction reports to calculate a reliable range. No reference price is provided.',
    limitations: [
      'Small cohort counts are withheld to protect contributing businesses.',
      'Try again when more reviewed reports are available or broaden the repair criteria with a human reviewer.',
    ],
  };
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function nearestIndex(indexes: Map<string, number>, date: Date): number | undefined {
  let cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  for (let i = 0; i < 60; i += 1) {
    const value = indexes.get(monthKey(cursor));
    if (value != null) return value;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1));
  }
  return undefined;
}
function money(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}
