/**
 * Repair Case status values.
 * Defines the complete lifecycle of a repair transaction.
 *
 * Valid transitions:
 *   REGISTERED → DIAGNOSING → QUOTED → AWAITING_APPROVAL
 *   AWAITING_APPROVAL → APPROVED | REJECTED
 *   REJECTED → QUOTED (revise)
 *   APPROVED → IN_REPAIR → VERIFYING → CERTIFIED
 *   VERIFYING → IN_REPAIR (failed verification)
 *   Any pre-repair state → CANCELLED
 */
export const CaseStatus = {
  REGISTERED: 'REGISTERED',
  DIAGNOSING: 'DIAGNOSING',
  QUOTED: 'QUOTED',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  IN_REPAIR: 'IN_REPAIR',
  VERIFYING: 'VERIFYING',
  CERTIFIED: 'CERTIFIED',
  CANCELLED: 'CANCELLED',
} as const;

export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

/** Map of which status transitions are permitted. */
export const CASE_STATUS_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  [CaseStatus.REGISTERED]: [CaseStatus.DIAGNOSING, CaseStatus.CANCELLED],
  [CaseStatus.DIAGNOSING]: [CaseStatus.QUOTED, CaseStatus.CANCELLED],
  [CaseStatus.QUOTED]: [CaseStatus.AWAITING_APPROVAL, CaseStatus.CANCELLED],
  [CaseStatus.AWAITING_APPROVAL]: [
    CaseStatus.APPROVED,
    CaseStatus.REJECTED,
    CaseStatus.CANCELLED,
  ],
  [CaseStatus.APPROVED]: [CaseStatus.IN_REPAIR],
  [CaseStatus.REJECTED]: [CaseStatus.QUOTED, CaseStatus.CANCELLED],
  [CaseStatus.IN_REPAIR]: [CaseStatus.VERIFYING],
  [CaseStatus.VERIFYING]: [CaseStatus.CERTIFIED, CaseStatus.IN_REPAIR],
  [CaseStatus.CERTIFIED]: [],
  [CaseStatus.CANCELLED]: [],
};

export const UserRole = {
  TECHNICIAN: 'TECHNICIAN',
  SHOP_OWNER: 'SHOP_OWNER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const DeviceCategory = {
  SMARTPHONE: 'SMARTPHONE',
  LAPTOP: 'LAPTOP',
} as const;

export type DeviceCategory = (typeof DeviceCategory)[keyof typeof DeviceCategory];

export const EvidenceType = {
  PHOTO: 'PHOTO',
  VIDEO: 'VIDEO',
  DOCUMENT: 'DOCUMENT',
} as const;

export type EvidenceType = (typeof EvidenceType)[keyof typeof EvidenceType];

export const EvidenceCategory = {
  INTAKE: 'INTAKE',
  DIAGNOSTIC: 'DIAGNOSTIC',
  DURING_REPAIR: 'DURING_REPAIR',
  POST_REPAIR: 'POST_REPAIR',
} as const;

export type EvidenceCategory = (typeof EvidenceCategory)[keyof typeof EvidenceCategory];

export const QuotationStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];

export const QuotationItemType = {
  PART: 'PART',
  LABOR: 'LABOR',
} as const;

export type QuotationItemType = (typeof QuotationItemType)[keyof typeof QuotationItemType];

export const PartSource = {
  OEM: 'OEM',
  AFTERMARKET: 'AFTERMARKET',
  REFURBISHED: 'REFURBISHED',
  CUSTOMER_PROVIDED: 'CUSTOMER_PROVIDED',
} as const;

export type PartSource = (typeof PartSource)[keyof typeof PartSource];

export const RepairStepStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
} as const;

export type RepairStepStatus = (typeof RepairStepStatus)[keyof typeof RepairStepStatus];

export const CasePriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type CasePriority = (typeof CasePriority)[keyof typeof CasePriority];
