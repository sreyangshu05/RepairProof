/** Repair lifecycle states. Edges are enforced by the backend workflow service. */
export const CaseStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_DIAGNOSIS: 'UNDER_DIAGNOSIS',
  DIAGNOSIS_COMPLETED: 'DIAGNOSIS_COMPLETED',
  QUOTATION_PENDING: 'QUOTATION_PENDING',
  AWAITING_CUSTOMER_APPROVAL: 'AWAITING_CUSTOMER_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  IN_REPAIR: 'IN_REPAIR',
  AWAITING_VERIFICATION: 'AWAITING_VERIFICATION',
  COMPLETED: 'COMPLETED',
  DISPUTED: 'DISPUTED',
  CANCELLED: 'CANCELLED',
} as const;

export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

/** Map of which status transitions are permitted. */
export const CASE_STATUS_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  [CaseStatus.DRAFT]: [CaseStatus.SUBMITTED, CaseStatus.CANCELLED],
  [CaseStatus.SUBMITTED]: [CaseStatus.UNDER_DIAGNOSIS, CaseStatus.CANCELLED],
  [CaseStatus.UNDER_DIAGNOSIS]: [CaseStatus.DIAGNOSIS_COMPLETED, CaseStatus.CANCELLED],
  [CaseStatus.DIAGNOSIS_COMPLETED]: [CaseStatus.QUOTATION_PENDING, CaseStatus.CANCELLED],
  [CaseStatus.QUOTATION_PENDING]: [CaseStatus.AWAITING_CUSTOMER_APPROVAL, CaseStatus.CANCELLED],
  [CaseStatus.AWAITING_CUSTOMER_APPROVAL]: [
    CaseStatus.APPROVED,
    CaseStatus.REJECTED,
    CaseStatus.CANCELLED,
  ],
  [CaseStatus.APPROVED]: [CaseStatus.IN_REPAIR, CaseStatus.CANCELLED],
  [CaseStatus.REJECTED]: [CaseStatus.QUOTATION_PENDING, CaseStatus.CANCELLED],
  [CaseStatus.IN_REPAIR]: [CaseStatus.AWAITING_VERIFICATION],
  [CaseStatus.AWAITING_VERIFICATION]: [CaseStatus.COMPLETED, CaseStatus.IN_REPAIR],
  [CaseStatus.COMPLETED]: [CaseStatus.DISPUTED],
  [CaseStatus.DISPUTED]: [CaseStatus.COMPLETED],
  [CaseStatus.CANCELLED]: [],
};

export const UserRole = {
  TECHNICIAN: 'TECHNICIAN',
  SHOP_OWNER: 'SHOP_OWNER',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Roles that can be assigned inside a shop; platform privileges use UserRole and a separate grant. */
export const OrganizationRole = {
  TECHNICIAN: 'TECHNICIAN',
  SHOP_OWNER: 'SHOP_OWNER',
} as const;

export type OrganizationRole = (typeof OrganizationRole)[keyof typeof OrganizationRole];

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

export const EvidencePurpose = {
  PHOTOGRAPH: 'PHOTOGRAPH',
  INVOICE: 'INVOICE',
  DIAGNOSTIC_REPORT: 'DIAGNOSTIC_REPORT',
  COMPONENT_DOCUMENTATION: 'COMPONENT_DOCUMENTATION',
  TEST_RESULT: 'TEST_RESULT',
  REPAIR_COMPLETION: 'REPAIR_COMPLETION',
  OTHER: 'OTHER',
} as const;
export type EvidencePurpose = (typeof EvidencePurpose)[keyof typeof EvidencePurpose];

export const EvidenceAssetRole = {
  ORIGINAL: 'ORIGINAL',
  THUMBNAIL: 'THUMBNAIL',
  PROCESSED: 'PROCESSED',
} as const;
export type EvidenceAssetRole = (typeof EvidenceAssetRole)[keyof typeof EvidenceAssetRole];

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
