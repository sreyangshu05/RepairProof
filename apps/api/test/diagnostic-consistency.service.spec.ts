import { DiagnosticConsistencyService } from '../src/modules/diagnostic-consistency/diagnostic-consistency.service';
import {
  DiagnosticRuleCatalog,
  DeviceDiagnosticRule,
  REVIEWED_DEVICE_DIAGNOSTIC_RULES,
} from '../src/modules/diagnostic-consistency/diagnostic-rules';

const fixtureRule: DeviceDiagnosticRule = {
  id: 'fixture-battery-rule',
  version: '1.0',
  manufacturer: 'Example',
  model: 'Phone One',
  faultType: 'battery capacity low',
  symptomTerms: ['battery drains quickly'],
  requiredFindingTerms: ['battery capacity'],
  requiredMeasurements: [{ key: 'capacity', label: 'Battery capacity', unit: '%', min: 80 }],
  supportedRepairTerms: ['replace battery'],
  expectedReplacementTerms: ['battery'],
  expectedPostRepairTestTerms: ['battery health'],
  limitations: ['Fixture rule does not establish diagnosis.'],
  reference: {
    title: 'Reviewed manufacturer service procedure',
    url: 'https://support.example.test/service',
    section: 'Battery',
    reviewedAt: '2026-10-01T00:00:00.000Z',
  },
};

describe('DiagnosticConsistencyService', () => {
  const explanation = { explain: jest.fn().mockResolvedValue(null) } as any;

  it('returns traceable evidence and persists the snapshot and audit event atomically', async () => {
    const prisma = mockPrisma(caseRecord());
    const service = new DiagnosticConsistencyService(
      prisma,
      new DiagnosticRuleCatalog([fixtureRule]),
      explanation,
    );
    const result: any = await service.assessCase('case-1', 'shop-current', 'profile-1');
    expect(result.signal).toBe('POTENTIAL_INCONSISTENCY_PRESENT');
    expect(result.applicableRule?.id).toBe(fixtureRule.id);
    expect(result.supportingEvidence.some((item: any) => item.type === 'CUSTOMER_SYMPTOM')).toBe(
      true,
    );
    expect(result.potentialInconsistencies.map((item: any) => item.code)).toContain(
      'MEASUREMENT_OUTSIDE_REFERENCE',
    );
    expect(result.potentialInconsistencies.map((item: any) => item.code)).toContain(
      'POST_REPAIR_TEST_FAILED',
    );
    expect(result.missingEvidence.some((item: any) => item.type === 'REPLACEMENT_COMPONENT')).toBe(
      true,
    );
    expect(result.decisionSupportNotice).toContain('not a diagnosis or a finding of dishonesty');
    expect(result.persistence.inputSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.transaction.diagnosticConsistencyAssessment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestedById: 'profile-1',
          inputSha256: result.persistence.inputSha256,
        }),
      }),
    );
    expect(prisma.transaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DIAGNOSTIC_CONSISTENCY_ASSESSED',
          actorId: 'profile-1',
        }),
      }),
    );
  });

  it('does not raise a fault verdict or return small historical cohorts', async () => {
    const record = caseRecord();
    record.testResults = [];
    const prisma = mockPrisma(record);
    const result: any = await new DiagnosticConsistencyService(
      prisma,
      new DiagnosticRuleCatalog(),
      explanation,
    ).assessCase('case-1', 'shop-current', 'profile-1');
    expect(result.signal).toBe('INSUFFICIENT_RECORDED_EVIDENCE');
    expect(result.potentialInconsistencies).toHaveLength(0);
    expect(result.statisticalComparison.status).toBe('INSUFFICIENT_SAMPLE');
    expect(result.languageModelExplanation).toBeNull();
    expect(result.confidenceLimitations.join(' ')).toContain(
      'No reviewed manufacturer-specific rule',
    );
  });

  it('reports historical associations only above the case and independent-shop minimums', async () => {
    const history = Array.from({ length: 20 }, (_, index) => ({
      shopId: `shop-${Math.floor(index / 4)}`,
      diagnostics: [{ findings: { faultType: 'battery capacity low' } }],
      quotations: [{ proposedRepair: 'Replace battery' }],
      testResults: [{ passed: index !== 0 }],
    }));
    const prisma = mockPrisma(caseRecord(), history);
    const result: any = await new DiagnosticConsistencyService(
      prisma,
      new DiagnosticRuleCatalog(),
      explanation,
    ).assessCase('case-1', 'shop-current', 'profile-1');
    expect(result.statisticalComparison.status).toBe('DESCRIPTIVE_ASSOCIATION_ONLY');
    expect(result.statisticalComparison.sampleSize).toBe(20);
    expect(result.statisticalComparison.organizationCount).toBe(5);
    expect(result.statisticalComparison.passedCount).toBe(19);
    const query = prisma.repairCase.findMany.mock.calls[0][0];
    expect(query.where.shopId).toEqual({ not: 'shop-current' });
    expect(result.confidenceLimitations.join(' ')).toContain(
      'does not show that a repair caused an outcome',
    );
  });

  it('registers exact, sourced Pixel 8 guidance without introducing unsupported specifications', () => {
    const catalog = new DiagnosticRuleCatalog();
    const pixel = catalog.find('Google', 'Pixel 8', 'battery runtime concern');
    expect(REVIEWED_DEVICE_DIAGNOSTIC_RULES.length).toBeGreaterThan(0);
    expect(pixel?.reference.url).toBe(
      'https://support.google.com/pixelphone/answer/15738128?hl=en',
    );
    expect(pixel?.requiredMeasurements).toEqual([]);
    expect(pixel?.limitations.join(' ')).toContain('does not prove battery failure');
    expect(catalog.find('Google', 'Pixel 9', 'battery runtime concern')).toBeUndefined();
  });

  it('lists historical snapshots with tenant scope and a bounded page size', async () => {
    const prisma = mockPrisma(caseRecord());
    prisma.diagnosticConsistencyAssessment.findMany = jest.fn().mockResolvedValue([]);
    const result = await new DiagnosticConsistencyService(
      prisma,
      new DiagnosticRuleCatalog(),
      explanation,
    ).listAssessmentHistory('case-1', 'shop-current', 500);
    expect(result.limit).toBe(50);
    expect(prisma.diagnosticConsistencyAssessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          caseId: 'case-1',
          shopId: 'shop-current',
          repairCase: { shopId: 'shop-current', deletedAt: null },
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});

function mockPrisma(record: any, history: any[] = []) {
  const transaction: any = {
    diagnosticConsistencyAssessment: { create: jest.fn(async ({ data }) => data) },
    auditEvent: { create: jest.fn(async ({ data }) => data) },
  };
  return {
    transaction,
    diagnosticConsistencyAssessment: transaction.diagnosticConsistencyAssessment,
    repairCase: {
      findFirst: jest.fn().mockResolvedValue(record),
      findMany: jest.fn().mockResolvedValue(history),
    },
    $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(transaction)),
  } as any;
}

function caseRecord(): any {
  return {
    id: 'case-1',
    shopId: 'shop-current',
    status: 'AWAITING_VERIFICATION',
    problemDescription: 'Battery drains quickly',
    device: { category: 'SMARTPHONE', make: 'Example', model: 'Phone One' },
    diagnostics: [
      {
        id: 'diagnostic-1',
        severity: 'MEDIUM',
        findings: {
          faultType: 'battery capacity low',
          summary: 'Battery capacity is reduced',
          measurements: { capacity: { value: 70, unit: '%' } },
        },
      },
    ],
    quotations: [
      {
        id: 'quote-1',
        version: 1,
        status: 'APPROVED',
        proposedRepair: 'Replace battery',
        items: [
          {
            id: 'item-1',
            type: 'PART',
            partName: 'Battery',
            description: 'Battery replacement',
            partSource: 'OEM',
          },
        ],
      },
    ],
    replacements: [],
    testResults: [
      {
        id: 'test-1',
        name: 'Battery health',
        passed: false,
        notes: 'Capacity remains low',
        details: {},
        testedAt: new Date(),
        evidenceIds: [],
      },
    ],
    evidence: [
      {
        id: 'evidence-1',
        purpose: 'DIAGNOSTIC_REPORT',
        category: 'DIAGNOSTIC',
        description: 'Service report',
        malwareStatus: 'CLEAN',
        legacyUnverified: false,
      },
    ],
  };
}
