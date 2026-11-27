import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePriceLabel } from '../../common/text-normalization';
import { DeviceDiagnosticRule, DiagnosticRuleCatalog } from './diagnostic-rules';
import { LocalExplanationService } from './local-explanation.service';

const HISTORY_WINDOW_MONTHS = 24;
const HISTORY_QUERY_LIMIT = 500;
const MIN_HISTORICAL_CASES = 20;
const MIN_HISTORICAL_SHOPS = 5;
type Ref = { type: string; id?: string; label: string; detail?: string; sourceUrl?: string };

@Injectable()
export class DiagnosticConsistencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: DiagnosticRuleCatalog,
    private readonly explanations: LocalExplanationService,
  ) {}

  async assessCase(caseId: string, shopId: string, actorProfileId: string) {
    const record = await this.prisma.repairCase.findFirst({
      where: { id: caseId, shopId, deletedAt: null },
      include: {
        device: { select: { category: true, make: true, model: true } },
        diagnostics: {
          where: { status: 'SUBMITTED' },
          orderBy: { submittedAt: 'asc' },
          select: { id: true, findings: true, severity: true },
        },
        quotations: {
          where: { deletedAt: null, status: { in: ['DRAFT', 'SENT', 'APPROVED'] } },
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            status: true,
            diagnosedIssue: true,
            proposedRepair: true,
            items: {
              select: { id: true, type: true, partName: true, description: true, partSource: true },
            },
          },
        },
        replacements: {
          orderBy: { replacedAt: 'asc' },
          select: {
            id: true,
            nameSnapshot: true,
            source: true,
            replacedAt: true,
            evidenceIds: true,
          },
        },
        testResults: {
          orderBy: { testedAt: 'asc' },
          select: {
            id: true,
            name: true,
            passed: true,
            details: true,
            notes: true,
            testedAt: true,
            evidenceIds: true,
          },
        },
        evidence: {
          where: { deletedAt: null, assetRole: 'ORIGINAL' },
          orderBy: { capturedAt: 'asc' },
          select: {
            id: true,
            purpose: true,
            category: true,
            description: true,
            malwareStatus: true,
            legacyUnverified: true,
          },
        },
      },
    });
    if (!record) throw new NotFoundException('Repair case not found');

    const supportingEvidence: Ref[] = [];
    const missingEvidence: Ref[] = [];
    const potentialInconsistencies: Array<{
      code: string;
      severity: 'REVIEW';
      description: string;
      evidence: Ref[];
    }> = [];
    const recommendedHumanReview = new Set<string>();
    const confidenceLimitations = new Set<string>([
      'This assessment checks recorded information only. Missing records do not prove that an action did not happen.',
      'It cannot establish intent, honesty, invoice truth, physical condition, or the definitive cause of a fault.',
    ]);

    const symptoms = record.problemDescription?.trim() ?? '';
    if (symptoms)
      supportingEvidence.push({
        type: 'CUSTOMER_SYMPTOM',
        id: record.id,
        label: 'Customer-reported symptom',
        detail: symptoms.slice(0, 500),
      });
    else missingEvidence.push({ type: 'CUSTOMER_SYMPTOM', label: 'Customer-reported symptom' });

    for (const diagnostic of record.diagnostics) {
      const findings = objectValue(diagnostic.findings);
      supportingEvidence.push({
        type: 'TECHNICIAN_FINDING',
        id: diagnostic.id,
        label:
          textValue(findings, ['summary', 'diagnosis', 'finding', 'faultType', 'faultCategory']) ||
          'Submitted technician findings',
        detail: diagnosticSummary(findings),
      });
      for (const measurement of measurementsFrom(findings))
        supportingEvidence.push({
          type: 'MEASUREMENT',
          id: diagnostic.id,
          label: measurement.name,
          detail: `${measurement.value}${measurement.unit ? ` ${measurement.unit}` : ''}`,
        });
    }
    if (!record.diagnostics.length) {
      missingEvidence.push({ type: 'TECHNICIAN_FINDING', label: 'Submitted technician findings' });
      recommendedHumanReview.add(
        'Obtain and record a diagnostic examination before relying on a proposed repair.',
      );
    }

    const quote = record.quotations[0];
    const proposedRepair = quote?.proposedRepair ?? '';
    if (quote)
      supportingEvidence.push({
        type: 'PROPOSED_REPAIR',
        id: quote.id,
        label: `Quotation v${quote.version}`,
        detail: `${quote.proposedRepair} (${quote.status})`,
      });
    else {
      missingEvidence.push({ type: 'PROPOSED_REPAIR', label: 'Proposed repair scope' });
      recommendedHumanReview.add('Confirm the intended repair scope before assessing consistency.');
    }

    const postRepairStage = ['AWAITING_VERIFICATION', 'COMPLETED', 'DISPUTED'].includes(
      record.status,
    );
    for (const replacement of record.replacements)
      supportingEvidence.push({
        type: 'REPLACEMENT_COMPONENT',
        id: replacement.id,
        label: `${replacement.nameSnapshot} (${replacement.source})`,
        detail: replacement.replacedAt.toISOString(),
      });
    if (
      postRepairStage &&
      quote?.items.some((item) => item.type === 'PART') &&
      !record.replacements.length
    ) {
      missingEvidence.push({
        type: 'REPLACEMENT_COMPONENT',
        label: 'Component replacement record for quoted parts',
      });
      recommendedHumanReview.add(
        'Confirm whether the quoted parts were installed, deferred, or not required.',
      );
    }
    if (postRepairStage && quote) {
      const quotedParts = quote.items
        .filter((item) => item.type === 'PART')
        .map((item) => normalizePriceLabel(`${item.partName ?? ''} ${item.description}`));
      const unexpected = record.replacements.filter(
        (item) =>
          !quotedParts.some(
            (part) =>
              part.includes(normalizePriceLabel(item.nameSnapshot)) ||
              normalizePriceLabel(item.nameSnapshot).includes(part),
          ),
      );
      if (unexpected.length) {
        potentialInconsistencies.push({
          code: 'REPLACEMENT_SCOPE_NEEDS_REVIEW',
          severity: 'REVIEW',
          description:
            'One or more recorded replacement components do not clearly match current quotation line items. This may reflect an authorized substitution or later scope change; compare approved quotation versions and evidence.',
          evidence: unexpected.map((item) => ({
            type: 'REPLACEMENT_COMPONENT',
            id: item.id,
            label: item.nameSnapshot,
          })),
        });
        recommendedHumanReview.add(
          'Compare installed components with the customer-approved quotation and any approved change requests.',
        );
      }
    }

    for (const result of record.testResults) {
      supportingEvidence.push({
        type: 'POST_REPAIR_TEST',
        id: result.id,
        label: `${result.name}: ${result.passed ? 'passed' : 'failed'}`,
        detail: result.notes?.slice(0, 300),
      });
      for (const measurement of measurementsFrom(objectValue(result.details)))
        supportingEvidence.push({
          type: 'MEASUREMENT',
          id: result.id,
          label: `${measurement.name} (post-repair)`,
          detail: `${measurement.value}${measurement.unit ? ` ${measurement.unit}` : ''}`,
        });
    }
    if (postRepairStage && !record.testResults.length) {
      missingEvidence.push({
        type: 'POST_REPAIR_TEST',
        label: 'Post-repair tests covering the reported symptom and work performed',
      });
      recommendedHumanReview.add(
        'Request and review post-repair functional tests before case completion.',
      );
    }
    const failedTests = record.testResults.filter((result) => !result.passed);
    if (failedTests.length) {
      potentialInconsistencies.push({
        code: 'POST_REPAIR_TEST_FAILED',
        severity: 'REVIEW',
        description:
          'One or more recorded post-repair tests did not pass. The record does not show whether a later test resolved the result; review the sequence before deciding whether more diagnosis or repair is needed.',
        evidence: failedTests.map((result) => ({
          type: 'POST_REPAIR_TEST',
          id: result.id,
          label: `${result.name}: failed`,
          detail: result.notes?.slice(0, 300),
        })),
      });
      recommendedHumanReview.add(
        'A qualified technician should review each failed test before the case advances.',
      );
    }

    for (const file of record.evidence) {
      if (file.malwareStatus === 'CLEAN' && !file.legacyUnverified)
        supportingEvidence.push({
          type: 'EVIDENCE_FILE',
          id: file.id,
          label: `${file.purpose} evidence`,
          detail: file.description?.slice(0, 300),
        });
      else
        missingEvidence.push({
          type: 'INELIGIBLE_EVIDENCE',
          id: file.id,
          label: 'Evidence file is not eligible for this assessment',
          detail: `Malware status: ${file.malwareStatus}; legacy-unverified: ${file.legacyUnverified}`,
        });
    }
    if (!supportingEvidence.some((item) => item.type === 'EVIDENCE_FILE'))
      confidenceLimitations.add(
        'No eligible explanatory evidence file was available. A photograph alone cannot establish the cause of a fault or confirm a repair.',
      );

    const diagnostics = record.diagnostics.map((item) => objectValue(item.findings));
    const faultType = diagnostics.map(faultFrom).find(Boolean) ?? '';
    const rule = this.rules.find(record.device.make, record.device.model, faultType);
    if (rule)
      this.evaluateRule(
        rule,
        symptoms,
        diagnostics,
        proposedRepair,
        record.replacements,
        record.testResults,
        postRepairStage,
        supportingEvidence,
        missingEvidence,
        potentialInconsistencies,
        recommendedHumanReview,
      );
    else {
      missingEvidence.push({
        type: 'DEVICE_RULE',
        label:
          'No reviewed, source-cited rule matches this manufacturer, model, and structured fault label',
      });
      confidenceLimitations.add(
        'No reviewed manufacturer-specific rule was available for this exact device and fault label.',
      );
      recommendedHumanReview.add(
        'Compare the findings and proposed work with current manufacturer service information.',
      );
    }
    if (rule) for (const limitation of rule.limitations) confidenceLimitations.add(limitation);

    const historical = await this.historicalPattern(
      record.id,
      record.shopId,
      record.device.make,
      record.device.model,
      faultType,
      proposedRepair,
    );
    if (historical) {
      supportingEvidence.push({
        type: 'HISTORICAL_PATTERN',
        label: 'Comparable completed cases',
        detail: `${historical.passedCount} of ${historical.sampleSize} comparable records had all recorded post-repair tests passing across ${historical.organizationCount} other repair organizations.`,
      });
      confidenceLimitations.add(
        'Historical co-occurrence is observational and may reflect selection bias, inconsistent test coverage, interim failed tests, or missing follow-up. It does not show that a repair caused an outcome.',
      );
    } else
      missingEvidence.push({
        type: 'HISTORICAL_PATTERN',
        label: `Insufficient history for comparison (minimum ${MIN_HISTORICAL_CASES} cases across ${MIN_HISTORICAL_SHOPS} organizations)`,
      });

    if (!supportingEvidence.some((item) => item.type === 'MEASUREMENT')) {
      missingEvidence.push({
        type: 'MEASUREMENT',
        label: 'Structured diagnostic measurements with units and test conditions',
      });
      confidenceLimitations.add(
        'Measurements are not consistently structured; free text cannot be safely compared with device specifications.',
      );
    }
    if (!recommendedHumanReview.size)
      recommendedHumanReview.add(
        'A qualified repair professional should review this assessment and use independent judgment.',
      );

    const signal = potentialInconsistencies.length
      ? 'POTENTIAL_INCONSISTENCY_PRESENT'
      : !record.diagnostics.length || !quote || (postRepairStage && !record.testResults.length)
        ? 'INSUFFICIENT_RECORDED_EVIDENCE'
        : 'NO_POTENTIAL_INCONSISTENCY_FOUND_IN_AVAILABLE_RECORD';
    const assessedAt = new Date().toISOString();
    const applicableRule = rule
      ? {
          id: rule.id,
          version: rule.version,
          title: rule.reference.title,
          url: rule.reference.url,
          section: rule.reference.section,
          reviewedAt: rule.reference.reviewedAt,
          limitations: rule.limitations,
        }
      : null;
    const assessment: Record<string, unknown> = {
      assessmentId: randomUUID(),
      caseId: record.id,
      assessedAt,
      assessmentVersion: 'rules-statistics-v1',
      device: {
        category: record.device.category,
        manufacturer: record.device.make,
        model: record.device.model,
      },
      signal,
      confidence: {
        status: 'NOT_CALIBRATED',
        explanation:
          'No validated probability or universal confidence score is produced. Rule matches, data completeness, and historical sample size are reported separately.',
      },
      supportingEvidence,
      missingEvidence,
      potentialInconsistencies,
      confidenceLimitations: [...confidenceLimitations],
      statisticalComparison: historical ?? {
        status: 'INSUFFICIENT_SAMPLE',
        minimumCases: MIN_HISTORICAL_CASES,
        minimumOrganizations: MIN_HISTORICAL_SHOPS,
      },
      applicableRule,
      recommendedHumanReview: [...recommendedHumanReview],
      languageModelExplanation: null as unknown,
      decisionSupportNotice:
        'This is decision support based on recorded information, not a diagnosis or a finding of dishonesty. A qualified repair professional must review it. A photograph alone cannot establish the truth of a diagnosis or repair.',
    };
    assessment.languageModelExplanation = await this.explanations.explain(assessment as never);

    const assessmentId = assessment.assessmentId as string;
    const inputSha256 = createHash('sha256')
      .update(
        JSON.stringify(record, (_key, value) =>
          value instanceof Date ? value.toISOString() : value,
        ),
      )
      .digest('hex');
    await this.prisma.$transaction(async (transaction) => {
      const tx = transaction as unknown as {
        diagnosticConsistencyAssessment: {
          create(args: { data: Record<string, unknown> }): Promise<unknown>;
        };
        auditEvent: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
      };
      await tx.diagnosticConsistencyAssessment.create({
        data: {
          id: assessmentId,
          caseId: record.id,
          shopId: record.shopId,
          requestedById: actorProfileId,
          engineVersion: 'rules-statistics-v1',
          inputSha256,
          signal,
          result: assessment as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.auditEvent.create({
        data: {
          shopId: record.shopId,
          actorId: actorProfileId,
          action: 'DIAGNOSTIC_CONSISTENCY_ASSESSED',
          entityType: 'DiagnosticConsistencyAssessment',
          entityId: assessmentId,
          metadata: {
            caseId: record.id,
            signal,
            engineVersion: 'rules-statistics-v1',
            inputSha256,
          },
        },
      });
    });
    return { ...assessment, persistence: { persisted: true, inputSha256 } };
  }

  async listAssessmentHistory(caseId: string, shopId: string, limit = 20) {
    const safeLimit = Math.max(1, Math.min(50, Number.isFinite(limit) ? Math.floor(limit) : 20));
    const items = await this.prisma.diagnosticConsistencyAssessment.findMany({
      where: { caseId, shopId, repairCase: { shopId, deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        createdAt: true,
        engineVersion: true,
        inputSha256: true,
        signal: true,
        result: true,
      },
    });
    return { items, limit: safeLimit };
  }

  private evaluateRule(
    rule: DeviceDiagnosticRule,
    symptom: string,
    diagnostics: Record<string, unknown>[],
    proposedRepair: string,
    replacements: Array<{ id: string; nameSnapshot: string }>,
    tests: Array<{ id: string; name: string; passed: boolean }>,
    postRepairStage: boolean,
    supporting: Ref[],
    missing: Ref[],
    conflicts: Array<{ code: string; severity: 'REVIEW'; description: string; evidence: Ref[] }>,
    humanReview: Set<string>,
  ) {
    supporting.push({
      type: 'DEVICE_RULE',
      id: rule.id,
      label: `${rule.id} v${rule.version}`,
      detail: rule.reference.title,
      sourceUrl: rule.reference.url,
    });
    if (
      rule.symptomTerms.length &&
      !rule.symptomTerms.some((term) =>
        normalizePriceLabel(symptom).includes(normalizePriceLabel(term)),
      )
    ) {
      conflicts.push({
        code: 'SYMPTOM_RELATION_NEEDS_REVIEW',
        severity: 'REVIEW',
        description:
          'The reported symptom does not match symptom terms associated with this fault in the cited source. Clarify with the customer and technician.',
        evidence: [
          { type: 'CUSTOMER_SYMPTOM', label: 'Customer symptom', detail: symptom.slice(0, 300) },
          {
            type: 'DEVICE_RULE',
            id: rule.id,
            label: rule.reference.title,
            sourceUrl: rule.reference.url,
          },
        ],
      });
      humanReview.add('Confirm the customer symptom and compare it with technician observations.');
    }
    const findingText = normalizePriceLabel(diagnostics.map(diagnosticSummary).join(' '));
    if (
      rule.requiredFindingTerms.length &&
      !rule.requiredFindingTerms.some((term) => findingText.includes(normalizePriceLabel(term)))
    )
      missing.push({
        type: 'TECHNICIAN_FINDING',
        label: `Finding relationship required by ${rule.id}`,
      });

    const measurements = diagnostics.flatMap(measurementsFrom);
    for (const required of rule.requiredMeasurements) {
      const value = measurements.find(
        (entry) => normalizePriceLabel(entry.key) === normalizePriceLabel(required.key),
      );
      if (!value) {
        missing.push({
          type: 'MEASUREMENT',
          label: `${required.label} measurement (${required.unit}) per ${rule.id}`,
        });
        continue;
      }
      if (normalizePriceLabel(value.unit) !== normalizePriceLabel(required.unit)) {
        conflicts.push({
          code: 'MEASUREMENT_UNIT_MISMATCH',
          severity: 'REVIEW',
          description: `The recorded ${required.label} uses “${value.unit || 'no unit'}”; the cited rule expects “${required.unit}”. Confirm value, unit, and test conditions.`,
          evidence: [
            { type: 'MEASUREMENT', label: value.name, detail: `${value.value} ${value.unit}` },
            {
              type: 'DEVICE_RULE',
              id: rule.id,
              label: rule.reference.title,
              sourceUrl: rule.reference.url,
            },
          ],
        });
        continue;
      }
      const numeric = Number(value.value);
      if (!Number.isFinite(numeric)) {
        missing.push({ type: 'MEASUREMENT', label: `${required.label} value is not numeric` });
        continue;
      }
      if (
        (required.min != null && numeric < required.min) ||
        (required.max != null && numeric > required.max)
      )
        conflicts.push({
          code: 'MEASUREMENT_OUTSIDE_REFERENCE',
          severity: 'REVIEW',
          description: `The recorded ${required.label} is outside the cited reference range. Test conditions, tolerance, or measurement error may explain the difference; this does not establish a diagnosis.`,
          evidence: [
            { type: 'MEASUREMENT', label: value.name, detail: `${value.value} ${value.unit}` },
            {
              type: 'DEVICE_RULE',
              id: rule.id,
              label: rule.reference.title,
              sourceUrl: rule.reference.url,
            },
          ],
        });
    }

    const normalizedProposal = normalizePriceLabel(proposedRepair);
    if (
      rule.supportedRepairTerms.length &&
      !rule.supportedRepairTerms.some((term) =>
        normalizedProposal.includes(normalizePriceLabel(term)),
      )
    )
      conflicts.push({
        code: 'PROPOSED_REPAIR_NEEDS_REVIEW',
        severity: 'REVIEW',
        description:
          'The proposed work does not match the repair options listed in the cited source. Confirm scope and any alternate procedure with a qualified professional.',
        evidence: [
          {
            type: 'PROPOSED_REPAIR',
            label: 'Proposed repair',
            detail: proposedRepair.slice(0, 300),
          },
          {
            type: 'DEVICE_RULE',
            id: rule.id,
            label: rule.reference.title,
            sourceUrl: rule.reference.url,
          },
        ],
      });
    if (postRepairStage) {
      for (const term of rule.expectedReplacementTerms)
        if (
          !replacements.some((entry) =>
            normalizePriceLabel(entry.nameSnapshot).includes(normalizePriceLabel(term)),
          )
        )
          missing.push({
            type: 'REPLACEMENT_COMPONENT',
            label: `Replacement record for “${term}” per ${rule.id}`,
          });
      for (const term of rule.expectedPostRepairTestTerms) {
        const matching = tests.filter((entry) =>
          normalizePriceLabel(entry.name).includes(normalizePriceLabel(term)),
        );
        if (!matching.length)
          missing.push({
            type: 'POST_REPAIR_TEST',
            label: `Test “${term}” specified by ${rule.id}`,
          });
        else if (matching.some((entry) => !entry.passed))
          conflicts.push({
            code: 'RULE_EXPECTED_TEST_FAILED',
            severity: 'REVIEW',
            description: `A test named in the cited rule did not pass. A qualified professional should determine what this means.`,
            evidence: matching
              .filter((entry) => !entry.passed)
              .map((entry) => ({
                type: 'POST_REPAIR_TEST',
                id: entry.id,
                label: `${entry.name}: failed`,
              })),
          });
      }
    }
  }

  private async historicalPattern(
    caseId: string,
    excludedShopId: string,
    make: string,
    model: string,
    fault: string,
    repair: string,
  ) {
    if (!fault || !repair) return null;
    const since = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - HISTORY_WINDOW_MONTHS, 1),
    );
    const rows = await this.prisma.repairCase.findMany({
      where: {
        id: { not: caseId },
        shopId: { not: excludedShopId },
        status: 'COMPLETED',
        deletedAt: null,
        closedAt: { gte: since },
        device: { make, model },
      },
      orderBy: { closedAt: 'desc' },
      take: HISTORY_QUERY_LIMIT,
      select: {
        shopId: true,
        diagnostics: { where: { status: 'SUBMITTED' }, select: { findings: true } },
        quotations: {
          where: { status: 'APPROVED', deletedAt: null },
          orderBy: { version: 'desc' },
          take: 1,
          select: { proposedRepair: true },
        },
        testResults: { select: { passed: true } },
      },
    });
    const faultKey = normalizePriceLabel(fault);
    const repairKey = normalizePriceLabel(repair);
    const comparable = rows.filter(
      (row) =>
        row.diagnostics.some((item) => faultFrom(objectValue(item.findings)) === faultKey) &&
        row.quotations.some((item) => normalizePriceLabel(item.proposedRepair) === repairKey) &&
        row.testResults.length > 0,
    );
    const organizations = new Set(comparable.map((row) => row.shopId)).size;
    if (comparable.length < MIN_HISTORICAL_CASES || organizations < MIN_HISTORICAL_SHOPS)
      return null;
    const passedCount = comparable.filter((row) =>
      row.testResults.every((result) => result.passed),
    ).length;
    return {
      status: 'DESCRIPTIVE_ASSOCIATION_ONLY',
      sampleSize: comparable.length,
      organizationCount: organizations,
      passedCount,
      failedCount: comparable.length - passedCount,
      passingTestShare: Number((passedCount / comparable.length).toFixed(3)),
      windowStart: since.toISOString(),
      windowEnd: new Date().toISOString(),
      explanation:
        'Describes recorded outcomes in matching completed cases. It does not show that the repair caused an outcome or predict this case.',
    };
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function textValue(value: Record<string, unknown>, keys: string[]): string {
  for (const key of keys)
    if (typeof value[key] === 'string' && (value[key] as string).trim())
      return (value[key] as string).trim();
  return '';
}
function faultFrom(value: Record<string, unknown>): string {
  return normalizePriceLabel(
    textValue(value, ['faultType', 'faultCategory', 'issue', 'diagnosis']),
  );
}
function diagnosticSummary(value: Record<string, unknown>): string {
  const keys = [
    'summary',
    'diagnosis',
    'finding',
    'faultType',
    'faultCategory',
    'issue',
    'symptoms',
    'observations',
    'measurements',
  ];
  return JSON.stringify(
    Object.fromEntries(keys.filter((key) => value[key] != null).map((key) => [key, value[key]])),
  ).slice(0, 600);
}
function measurementsFrom(
  value: Record<string, unknown>,
): Array<{ key: string; name: string; value: string; unit: string }> {
  const raw = value.measurements;
  if (Array.isArray(raw))
    return raw.flatMap((entry) => {
      const measurement = objectValue(entry);
      const key = textValue(measurement, ['key', 'name', 'metric']);
      const reading = measurement.value;
      return key && (typeof reading === 'string' || typeof reading === 'number')
        ? [
            {
              key,
              name: textValue(measurement, ['label', 'name', 'metric']) || key,
              value: String(reading),
              unit: textValue(measurement, ['unit', 'units']),
            },
          ]
        : [];
    });
  return Object.entries(objectValue(raw)).flatMap(([key, reading]) => {
    const measurement = objectValue(reading);
    if (typeof reading === 'number' || typeof reading === 'string')
      return [{ key, name: key, value: String(reading), unit: '' }];
    if (typeof measurement.value === 'number' || typeof measurement.value === 'string')
      return [
        {
          key,
          name: textValue(measurement, ['label', 'name']) || key,
          value: String(measurement.value),
          unit: textValue(measurement, ['unit', 'units']),
        },
      ];
    return [];
  });
}
