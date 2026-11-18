import {
  CasePriority,
  CaseStatus,
  DeviceCategory,
  EvidenceCategory,
  EvidenceType,
  PartSource,
  QuotationItemType,
  QuotationStatus,
  RepairStepStatus,
  UserRole,
} from './enums';

export interface BaseEntity {
  id: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;
}

export interface Profile extends BaseEntity {
  userId: string;
  role: UserRole;
  shopId?: string | null;
  displayName: string;
  phone?: string | null;
  email: string;
}

export interface Shop extends BaseEntity {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  ownerId: string;
}

export interface Device extends BaseEntity {
  registeredById: string;
  shopId: string;
  category: DeviceCategory;
  make: string;
  model: string;
  serialNumber?: string | null;
  imei?: string | null;
  color?: string | null;
  storageCapacity?: string | null;
  intakePhotos: string[];
  intakeCondition: string;
}

export interface RepairCase extends BaseEntity {
  caseNumber: string;
  deviceId: string;
  device?: Device;
  shopId: string;
  technicianId?: string | null;
  technician?: Profile | null;
  status: CaseStatus;
  priority: CasePriority;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  problemDescription: string;
  authorizationToken: string;
  authorizationExpiresAt: string | Date;
  estimatedCompletionAt?: string | Date | null;
  closedAt?: string | Date | null;
}

export interface EvidenceAnnotation {
  id: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  note: string;
  createdAt: string | Date;
  authorName?: string;
}

export interface Evidence extends BaseEntity {
  caseId: string;
  capturedById: string;
  type: EvidenceType;
  category: EvidenceCategory;
  fileUrl: string;
  thumbnailUrl?: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  description?: string | null;
  annotations: EvidenceAnnotation[];
  capturedAt: string | Date;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  type: QuotationItemType;
  description: string;
  partName?: string | null;
  partSource?: PartSource | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Quotation extends BaseEntity {
  caseId: string;
  version: number;
  status: QuotationStatus;
  laborCost: number;
  partsCost: number;
  taxAmount: number;
  totalCost: number;
  currency: string;
  validUntil: string | Date;
  customerResponseNote?: string | null;
  respondedAt?: string | Date | null;
  items: QuotationItem[];
}

export interface RepairStepPart {
  name: string;
  partNumber?: string;
  source: PartSource;
  cost?: number;
}

export interface RepairStep extends BaseEntity {
  caseId: string;
  stepNumber: number;
  title: string;
  description: string;
  status: RepairStepStatus;
  photos: string[];
  partsUsed: RepairStepPart[];
  performedById?: string | null;
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
}

export interface VerificationChecklistItem {
  id: string;
  label: string;
  category: string;
  passed: boolean;
  notes?: string;
}

export interface Verification extends BaseEntity {
  caseId: string;
  verifiedById: string;
  verifiedBy?: Profile;
  passed: boolean;
  notes?: string | null;
  checklist: VerificationChecklistItem[];
  verifiedAt: string | Date;
}

export interface Certificate extends BaseEntity {
  caseId: string;
  case?: RepairCase;
  certificateNumber: string;
  qrCodeUrl: string;
  verificationUrl: string;
  pdfUrl?: string | null;
  warrantyPeriodMonths: number;
  warrantyTerms?: string | null;
  issuedAt: string | Date;
  issuedById: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
