import * as enums from './enums';

export const CaseStatus = enums.CaseStatus;
export const CASE_STATUS_TRANSITIONS = enums.CASE_STATUS_TRANSITIONS;
export const UserRole = enums.UserRole;
export const OrganizationRole = enums.OrganizationRole;
export const DeviceCategory = enums.DeviceCategory;
export const EvidenceType = enums.EvidenceType;
export const EvidenceCategory = enums.EvidenceCategory;
export const EvidencePurpose = enums.EvidencePurpose;
export const EvidenceAssetRole = enums.EvidenceAssetRole;
export const QuotationStatus = enums.QuotationStatus;
export const QuotationItemType = enums.QuotationItemType;
export const PartSource = enums.PartSource;
export const RepairStepStatus = enums.RepairStepStatus;
export const CasePriority = enums.CasePriority;

export type CaseStatus = enums.CaseStatus;
export type UserRole = enums.UserRole;
export type OrganizationRole = enums.OrganizationRole;
export type DeviceCategory = enums.DeviceCategory;
export type EvidenceType = enums.EvidenceType;
export type EvidenceCategory = enums.EvidenceCategory;
export type EvidencePurpose = enums.EvidencePurpose;
export type EvidenceAssetRole = enums.EvidenceAssetRole;
export type QuotationStatus = enums.QuotationStatus;
export type QuotationItemType = enums.QuotationItemType;
export type PartSource = enums.PartSource;
export type RepairStepStatus = enums.RepairStepStatus;
export type CasePriority = enums.CasePriority;
export type {
  BaseEntity,
  Profile,
  Shop,
  Device,
  RepairCase,
  EvidenceAnnotation,
  Evidence,
  QuotationItem,
  Quotation,
  RepairStepPart,
  RepairStep,
  VerificationChecklistItem,
  Verification,
  Certificate,
  ApiResponse,
  PaginatedResult,
} from './types';
