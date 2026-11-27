import { normalizePriceLabel } from '../../common/text-normalization';

export interface MeasurementRequirement {
  key: string;
  label: string;
  unit: string;
  min?: number;
  max?: number;
}

export interface DeviceDiagnosticRule {
  id: string;
  version: string;
  manufacturer: string;
  model: string;
  faultType: string;
  symptomTerms: string[];
  requiredFindingTerms: string[];
  requiredMeasurements: MeasurementRequirement[];
  supportedRepairTerms: string[];
  expectedReplacementTerms: string[];
  expectedPostRepairTestTerms: string[];
  limitations: string[];
  reference: { title: string; url: string; section?: string; reviewedAt: string };
}

/** Deliberately narrow workflow relationships derived from official guidance.
 * These are not component failure diagnoses or pass/fail specifications. */
export const REVIEWED_DEVICE_DIAGNOSTIC_RULES: readonly DeviceDiagnosticRule[] = [
  {
    id: 'google-pixel-8-battery-runtime-guidance',
    version: '2026.11.22-r1',
    manufacturer: 'Google',
    model: 'Pixel 8',
    faultType: 'battery runtime concern',
    symptomTerms: ['battery runtime has decreased', 'battery drains quickly', 'short battery life'],
    requiredFindingTerms: ['battery runtime'],
    requiredMeasurements: [],
    supportedRepairTerms: ['battery replacement'],
    expectedReplacementTerms: [],
    expectedPostRepairTestTerms: [],
    limitations: [
      'Google guidance says replacement is recommended when runtime has decreased, but this does not prove battery failure or establish that replacement is the only suitable repair.',
      'Pixel 8 does not expose the battery health status feature described for newer Pixel models; this rule therefore requires no capacity threshold or cycle-count claim.',
    ],
    reference: {
      title: 'Understand your Pixel battery',
      url: 'https://support.google.com/pixelphone/answer/15738128?hl=en',
      section: 'Replace your battery; Battery health',
      reviewedAt: '2026-11-22T00:00:00.000Z',
    },
  },
  {
    id: 'google-pixel-8-pro-battery-runtime-guidance',
    version: '2026.11.22-r1',
    manufacturer: 'Google',
    model: 'Pixel 8 Pro',
    faultType: 'battery runtime concern',
    symptomTerms: ['battery runtime has decreased', 'battery drains quickly', 'short battery life'],
    requiredFindingTerms: ['battery runtime'],
    requiredMeasurements: [],
    supportedRepairTerms: ['battery replacement'],
    expectedReplacementTerms: [],
    expectedPostRepairTestTerms: [],
    limitations: [
      'Google guidance says replacement is recommended when runtime has decreased, but this does not prove battery failure or establish that replacement is the only suitable repair.',
      'Pixel 8 Pro does not expose the battery health status feature described for newer Pixel models; this rule therefore requires no capacity threshold or cycle-count claim.',
    ],
    reference: {
      title: 'Understand your Pixel battery',
      url: 'https://support.google.com/pixelphone/answer/15738128?hl=en',
      section: 'Replace your battery; Battery health',
      reviewedAt: '2026-11-22T00:00:00.000Z',
    },
  },
];

export class DiagnosticRuleCatalog {
  constructor(
    private readonly rules: readonly DeviceDiagnosticRule[] = REVIEWED_DEVICE_DIAGNOSTIC_RULES,
  ) {
    const ids = new Set<string>();
    for (const rule of rules) {
      const referenceUrl = new URL(rule.reference.url);
      if (ids.has(rule.id)) throw new Error(`Duplicate diagnostic rule id: ${rule.id}`);
      if (
        referenceUrl.protocol !== 'https:' ||
        !Number.isFinite(Date.parse(rule.reference.reviewedAt))
      )
        throw new Error(
          `Diagnostic rule ${rule.id} must have an HTTPS reference and reviewedAt timestamp`,
        );
      if (
        rule.requiredMeasurements.some(
          (measurement) =>
            measurement.min != null && measurement.max != null && measurement.min > measurement.max,
        )
      )
        throw new Error(`Diagnostic rule ${rule.id} has an invalid measurement range`);
      ids.add(rule.id);
    }
  }

  find(manufacturer: string, model: string, faultType: string): DeviceDiagnosticRule | undefined {
    const make = normalizePriceLabel(manufacturer);
    const deviceModel = normalizePriceLabel(model);
    const fault = normalizePriceLabel(faultType);
    return this.rules.find(
      (rule) =>
        normalizePriceLabel(rule.manufacturer) === make &&
        normalizePriceLabel(rule.model) === deviceModel &&
        normalizePriceLabel(rule.faultType) === fault,
    );
  }

  get size(): number {
    return this.rules.length;
  }
}

export function normalizeFindingText(value: unknown): string {
  return typeof value === 'string' ? normalizePriceLabel(value) : '';
}
