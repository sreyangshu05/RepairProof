import { BadRequestException } from '@nestjs/common';
import { PartSource, RepairComplexity } from '@prisma/client';
import { PriceIntelligenceService } from '../src/modules/price-intelligence/price-intelligence.service';
import {
  normalizePriceLabel,
  pricePercentileRange,
  removePriceOutliers,
} from '../src/modules/price-intelligence/price-statistics';

describe('Repair price intelligence', () => {
  it('normalizes labels without depending on case or punctuation', () => {
    expect(normalizePriceLabel('  Écran—OLED / 15 Pro ')).toBe('ecran oled 15 pro');
  });

  it('removes extreme outliers using a robust median/MAD rule', () => {
    const base = Array.from({ length: 12 }, (_, index) => ({
      amount: 100 + index,
      shopId: `shop-${index % 5}`,
      transactionAt: new Date('2026-04-01'),
    }));
    const values = [
      ...base,
      { amount: 20_000, shopId: 'shop-outlier', transactionAt: new Date('2026-04-01') },
    ];
    const result = removePriceOutliers(values);
    expect(result.outliersRemoved).toBe(1);
    expect(result.samples).toHaveLength(12);
  });

  it('uses an explainable percentile band rather than a single average', () => {
    const values = [10, 20, 30, 40, 50].map((amount) => ({
      amount,
      shopId: 's',
      transactionAt: new Date(),
    }));
    expect(pricePercentileRange(values)).toEqual({ low: 18, high: 42 });
  });

  it('returns no reference price when regional evidence is insufficient', async () => {
    const prisma: any = {
      repairPriceTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PriceIntelligenceService(prisma);
    const result = await service.benchmark(query());
    expect(result.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.estimate).toBeNull();
    expect(result.sampleSize).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/shop-[0-9]/);
  });

  it('builds a regional range from reviewed comparable reports and never calls an above-range price fraud', async () => {
    const records = Array.from({ length: 15 }, (_, index) => ({
      shopId: `shop-${Math.floor(index / 3)}`,
      transactionAt: new Date(Date.now() - (index + 1) * 86_400_000),
      labourAmount: 50,
      partsAmount: 70 + index,
      additionalAmount: 0,
      items: [{ unitAmount: 70 + index, source: PartSource.OEM }],
    }));
    const prisma: any = {
      repairPriceTransaction: { findMany: jest.fn().mockResolvedValue(records) },
      repairPriceIndex: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PriceIntelligenceService(prisma);
    const result: any = await service.benchmark({ ...query(), quoteAmount: 10_000 });
    expect(result.status).toBe('AVAILABLE');
    expect(result.sampleSize).toBe(15);
    expect(result.independentRepairBusinesses).toBe(5);
    expect(result.estimate.low).toBe('122.80');
    expect(result.estimate.high).toBe('131.20');
    expect(result.quoteComparison.position).toBe('ABOVE_RANGE');
    expect(result.quoteComparison.message).toContain('not a fraud finding');
    expect(result.comparableCriteria.matchedLocationLevel).toBe('REGION');
    expect(result.comparableCriteria.inflationAdjusted).toBe(false);
  });

  it('adjusts comparable prices only when a complete same-currency regional index series exists', async () => {
    const records = Array.from({ length: 15 }, (_, index) => ({
      shopId: `shop-${Math.floor(index / 3)}`,
      transactionAt: new Date(
        `2026-10-${String(10 + (index % 10)).padStart(2, '0')}T12:00:00.000Z`,
      ),
      labourAmount: 50,
      partsAmount: 70,
      additionalAmount: 0,
      items: [{ unitAmount: 70, source: PartSource.OEM }],
    }));
    const prisma: any = {
      repairPriceTransaction: { findMany: jest.fn().mockResolvedValue(records) },
      repairPriceIndex: {
        findMany: jest.fn().mockResolvedValue([
          { period: new Date('2026-11-01T00:00:00.000Z'), indexValue: 120 },
          { period: new Date('2026-10-01T00:00:00.000Z'), indexValue: 100 },
        ]),
      },
    };
    const result: any = await new PriceIntelligenceService(prisma).benchmark(query());
    expect(result.status).toBe('AVAILABLE');
    expect(result.comparableCriteria.inflationAdjusted).toBe(true);
    expect(result.comparableCriteria.inflationAdjustedThrough).toBe('2026-11-01T00:00:00.000Z');
    expect(result.estimate.low).toBe('144.00');
  });

  it('falls back to a sufficiently large country cohort without exposing small local counts', async () => {
    const local = Array.from({ length: 10 }, (_, index) => ({
      shopId: `local-${index % 4}`,
      transactionAt: new Date(),
      labourAmount: 50,
      partsAmount: 70,
      additionalAmount: 0,
      items: [{ unitAmount: 70, source: PartSource.OEM }],
    }));
    const national = Array.from({ length: 24 }, (_, index) => ({
      shopId: `country-${Math.floor(index / 3)}`,
      transactionAt: new Date(),
      labourAmount: 50,
      partsAmount: 70 + index,
      additionalAmount: 0,
      items: [{ unitAmount: 70 + index, source: PartSource.OEM }],
    }));
    const prisma: any = {
      repairPriceTransaction: {
        findMany: jest.fn(({ where }) => Promise.resolve(where.regionCode ? local : national)),
      },
      repairPriceIndex: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result: any = await new PriceIntelligenceService(prisma).benchmark(query());
    expect(result.status).toBe('AVAILABLE');
    expect(result.comparableCriteria.matchedLocationLevel).toBe('COUNTRY');
    expect(result.sampleSize).toBe(24);
    expect(result.limitations).toContain(
      'There was insufficient local evidence, so this range uses other regions in the same country.',
    );
  });

  it('rejects inconsistent invoice totals before attempting database writes', async () => {
    const tx: any = { repairPriceTransaction: { findFirst: jest.fn() } };
    const prisma: any = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new PriceIntelligenceService(prisma);
    const dto: any = {
      transactionAt: '2026-05-20T00:00:00.000Z',
      countryCode: 'US',
      regionCode: 'US-CA',
      currency: 'USD',
      faultType: 'screen damage',
      complexity: RepairComplexity.MEDIUM,
      invoiceEvidenceId: 'evidence-1',
      labourAmount: 50,
      additionalAmount: 0,
      taxAmount: 5,
      totalAmount: 99,
      items: [{ componentName: 'Display', quantity: 1, unitAmount: 40, source: PartSource.OEM }],
    };
    await expect(
      service.recordReportedTransaction('case-1', 'shop-1', 'profile-1', 'idempotency-0001', dto),
    ).rejects.toThrow(BadRequestException);
    expect(tx.repairPriceTransaction.findFirst).not.toHaveBeenCalled();
  });

  it('requires every independent review check before accepting a transaction report', async () => {
    const tx: any = {
      repairPriceTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'price-1',
          shopId: 'shop-1',
          status: 'PENDING_REVIEW',
          enteredByProfileId: 'author-1',
          caseId: 'case-1',
          invoiceEvidenceId: 'evidence-1',
        }),
        updateMany: jest.fn(),
      },
      evidence: { findFirst: jest.fn() },
      platformAdminAuditEvent: { create: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new PriceIntelligenceService(prisma);
    await expect(
      service.reviewReportedTransaction('price-1', 'admin-1', { status: 'ACCEPTED' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(tx.repairPriceTransaction.updateMany).not.toHaveBeenCalled();
  });
});

function query() {
  return {
    priceComponent: 'TOTAL' as const,
    manufacturer: 'Example',
    model: 'Model 1',
    faultType: 'Screen damage',
    component: 'Display',
    partSource: PartSource.OEM,
    complexity: RepairComplexity.MEDIUM,
    countryCode: 'US',
    regionCode: 'US-CA',
    currency: 'USD',
  };
}
