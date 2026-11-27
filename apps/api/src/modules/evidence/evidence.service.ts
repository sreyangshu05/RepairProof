import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import {
  EvidenceAssetRole as DbAssetRole,
  EvidenceCategory as DbEvidenceCategory,
  EvidencePurpose as DbEvidencePurpose,
  EvidenceType,
  OrganizationRole,
  Prisma,
} from '@prisma/client';
import { EvidenceCategory, EvidencePurpose as SharedPurpose } from '@repairproof/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AddAnnotationDto, CreateEvidenceUploadDto } from './evidence.dto';
import { ClamAvMalwareScanner } from './clamav-malware-scanner.service';
import { ObjectStorageService, SUPPORTED_EVIDENCE_MIME_TYPES } from './object-storage.service';

const INTEGRITY_STATEMENT =
  'SHA-256 records byte integrity from upload time. It does not prove who created this file, when the depicted event occurred, or whether its contents are truthful.';
const MIME_TO_EVIDENCE_TYPE: Record<string, EvidenceType> = {
  'image/jpeg': 'PHOTO',
  'image/png': 'PHOTO',
  'image/webp': 'PHOTO',
  'image/heic': 'PHOTO',
  'video/mp4': 'VIDEO',
  'video/quicktime': 'VIDEO',
  'application/pdf': 'DOCUMENT',
};
const PURPOSE_TO_CATEGORIES: Record<string, EvidenceCategory[]> = {
  PHOTOGRAPH: [
    EvidenceCategory.INTAKE,
    EvidenceCategory.DIAGNOSTIC,
    EvidenceCategory.DURING_REPAIR,
    EvidenceCategory.POST_REPAIR,
  ],
  INVOICE: [EvidenceCategory.INTAKE, EvidenceCategory.DURING_REPAIR],
  DIAGNOSTIC_REPORT: [EvidenceCategory.DIAGNOSTIC],
  COMPONENT_DOCUMENTATION: [EvidenceCategory.DIAGNOSTIC, EvidenceCategory.DURING_REPAIR],
  TEST_RESULT: [EvidenceCategory.POST_REPAIR],
  REPAIR_COMPLETION: [EvidenceCategory.POST_REPAIR],
  OTHER: [
    EvidenceCategory.INTAKE,
    EvidenceCategory.DIAGNOSTIC,
    EvidenceCategory.DURING_REPAIR,
    EvidenceCategory.POST_REPAIR,
  ],
};

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly malwareScanner: ClamAvMalwareScanner,
    private readonly config: ConfigService,
  ) {}

  getMaxFileBytes() {
    return this.storage.maxFileBytes;
  }

  async createUploadIntent(
    caseId: string,
    shopId: string,
    actorId: string,
    actorRole: string,
    idempotencyKey: string,
    dto: CreateEvidenceUploadDto,
  ) {
    if (!idempotencyKey || idempotencyKey.length > 128)
      throw new BadRequestException('A valid Idempotency-Key (1-128 characters) is required');
    if (!dto.fileName?.trim())
      throw new BadRequestException('Evidence file name must contain text');
    if (
      !Number.isSafeInteger(dto.fileSize) ||
      dto.fileSize <= 0 ||
      dto.fileSize > this.storage.maxFileBytes
    )
      throw new BadRequestException(
        `Evidence files must be between 1 and ${this.storage.maxFileBytes} bytes`,
      );
    if (!(SUPPORTED_EVIDENCE_MIME_TYPES as readonly string[]).includes(dto.mimeType))
      throw new BadRequestException('This evidence media type is not supported');
    const purpose = dto.purpose ?? SharedPurpose.OTHER;
    if (!PURPOSE_TO_CATEGORIES[purpose]?.includes(dto.category))
      throw new BadRequestException(
        `Evidence purpose ${purpose} is not valid for category ${dto.category}`,
      );
    if (!['TECHNICIAN', 'SHOP_OWNER'].includes(actorRole))
      throw new ForbiddenException('Only repair shop staff can upload case evidence');
    await this.assertStaffMembership(this.prisma, shopId, actorId, actorRole);

    const requestHash = this.hash({
      ...dto,
      fileSize: dto.fileSize,
      category: dto.category,
      mimeType: dto.mimeType,
      purpose,
      fileName: dto.fileName.trim(),
      description: dto.description?.trim(),
      actorId,
      shopId,
    });
    const intent = await this.prisma.$transaction(async (tx) => {
      const prior = await tx.evidenceUploadIntent.findFirst({
        where: { shopId, caseId, idempotencyKey },
      });
      if (prior) {
        if (
          prior.requestHash !== requestHash ||
          prior.uploadedById !== actorId ||
          prior.shopId !== shopId
        )
          throw new ConflictException(
            'Idempotency key was already used for a different evidence upload',
          );
        if (prior.status === 'PENDING' && prior.expiresAt <= new Date()) {
          await tx.evidenceUploadIntent.updateMany({
            where: { id: prior.id, status: 'PENDING' },
            data: { status: 'EXPIRED' },
          });
          return { ...prior, status: 'EXPIRED' as const };
        }
        if (prior.status === 'COMPLETED') {
          const evidence = prior.evidenceId
            ? await tx.evidence.findUnique({
                where: { id: prior.evidenceId },
                select: { id: true },
              })
            : null;
          if (!evidence)
            throw new ConflictException('Completed upload intent is missing its evidence record');
          const repairCase = await tx.repairCase.findFirst({
            where: {
              id: caseId,
              shopId,
              deletedAt: null,
              ...(actorRole === 'TECHNICIAN' ? { technicianId: actorId } : {}),
            },
            select: { id: true },
          });
          if (!repairCase)
            throw new NotFoundException('Repair case not found or you are not assigned to it');
          return prior;
        }
        if (prior.status !== 'PENDING')
          throw new ConflictException(
            `Evidence upload intent is ${prior.status.toLowerCase()}; use a new idempotency key to retry`,
          );
        return prior;
      }
      const repairCase = await tx.repairCase.findFirst({
        where: {
          id: caseId,
          shopId,
          deletedAt: null,
          ...(actorRole === 'TECHNICIAN' ? { technicianId: actorId } : {}),
        },
        select: { id: true },
      });
      if (!repairCase)
        throw new NotFoundException('Repair case not found or you are not assigned to it');
      const id = randomUUID();
      const pathName = this.safeObjectName(dto.fileName);
      const objectPath = `quarantine/${shopId}/${caseId}/${id}/${pathName}`;
      const created = await tx.evidenceUploadIntent.create({
        data: {
          id,
          caseId,
          shopId,
          uploadedById: actorId,
          objectPath,
          originalName: dto.fileName.trim(),
          declaredMime: dto.mimeType,
          expectedBytes: dto.fileSize,
          category: dto.category as DbEvidenceCategory,
          purpose: purpose as DbEvidencePurpose,
          description: dto.description?.trim(),
          idempotencyKey,
          requestHash,
          expiresAt: new Date(Date.now() + 15 * 60_000),
        },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'evidence.upload_intent_created',
          entityType: 'EvidenceUploadIntent',
          entityId: created.id,
          metadata: {
            caseId,
            category: dto.category,
            purpose: dto.purpose ?? SharedPurpose.OTHER,
            declaredMime: dto.mimeType,
            expectedBytes: dto.fileSize,
            expiresAt: created.expiresAt.toISOString(),
          },
        },
      });
      return created;
    });
    if (intent.status === 'EXPIRED')
      throw new ConflictException(
        'Evidence upload intent expired; use a new idempotency key to retry',
      );
    if (intent.status === 'COMPLETED') {
      const evidence = intent.evidenceId
        ? await this.prisma.evidence.findUnique({
            where: { id: intent.evidenceId },
            select: { id: true },
          })
        : null;
      if (!evidence)
        throw new ConflictException('Completed upload intent is missing its evidence record');
      return {
        uploadId: intent.id,
        evidenceId: evidence.id,
        status: intent.status,
        expiresAt: intent.expiresAt,
        maxFileBytes: this.storage.maxFileBytes,
        alreadyCompleted: true,
      };
    }
    if (intent.status !== 'PENDING')
      return {
        uploadId: intent.id,
        status: intent.status,
        expiresAt: intent.expiresAt,
        maxFileBytes: this.storage.maxFileBytes,
      };
    const signed = await this.storage.createSignedUpload(intent.objectPath);
    await this.prisma.auditEvent.create({
      data: {
        shopId,
        actorId,
        action: 'evidence.upload_url_issued',
        entityType: 'EvidenceUploadIntent',
        entityId: intent.id,
        metadata: {
          caseId,
          objectPath: intent.objectPath,
          expiresAt: intent.expiresAt.toISOString(),
        },
      },
    });
    return {
      uploadId: intent.id,
      status: intent.status,
      ...signed,
      expiresAt: intent.expiresAt,
      maxFileBytes: this.storage.maxFileBytes,
    };
  }

  async completeUpload(caseId: string, shopId: string, actorId: string, uploadId: string) {
    const intent = await this.prisma.evidenceUploadIntent.findFirst({
      where: {
        id: uploadId,
        caseId,
        shopId,
        uploadedById: actorId,
        repairCase: { deletedAt: null },
      },
    });
    if (!intent) throw new NotFoundException('Evidence upload intent not found');
    const uploaderMembership = await this.prisma.organizationMembership.findFirst({
      where: { shopId, profileId: actorId, revokedAt: null },
      select: { role: true },
    });
    if (!uploaderMembership)
      throw new ForbiddenException(
        'Current organization membership is required to complete an evidence upload',
      );
    if (uploaderMembership.role !== 'TECHNICIAN' && uploaderMembership.role !== 'SHOP_OWNER')
      throw new ForbiddenException('Uploader membership role is not authorized');
    if (uploaderMembership.role === 'TECHNICIAN') {
      const assigned = await this.prisma.repairCase.findFirst({
        where: { id: caseId, shopId, technicianId: actorId, deletedAt: null },
        select: { id: true },
      });
      if (!assigned) throw new NotFoundException('Repair case is not assigned to this technician');
    }
    if (intent.status === 'COMPLETED')
      throw new ConflictException('Evidence upload intent is already complete');
    if (intent.status !== 'PENDING')
      throw new ConflictException(`Evidence upload cannot be completed from ${intent.status}`);

    if (intent.expiresAt <= new Date()) {
      await this.prisma.$transaction(async (tx) => {
        await tx.evidenceUploadIntent.updateMany({
          where: { id: intent.id, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });
        await tx.auditEvent.create({
          data: {
            shopId,
            actorId,
            action: 'evidence.upload_expired',
            entityType: 'EvidenceUploadIntent',
            entityId: intent.id,
            metadata: { caseId },
          },
        });
      });
      throw new ConflictException('Evidence upload intent has expired');
    }
    const bytes = await this.storage.download(intent.objectPath);
    const stillValid = await this.prisma.evidenceUploadIntent.findFirst({
      where: { id: intent.id, status: 'PENDING', expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!stillValid)
      throw new ConflictException(
        'Evidence upload intent expired or changed while the uploaded bytes were being inspected',
      );
    if (bytes.byteLength !== intent.expectedBytes)
      return this.rejectUpload(
        intent.id,
        intent.objectPath,
        shopId,
        actorId,
        'Uploaded file size does not match the declared size',
      );
    if (bytes.byteLength > this.storage.maxFileBytes)
      return this.rejectUpload(
        intent.id,
        intent.objectPath,
        shopId,
        actorId,
        'Uploaded file exceeds the configured size limit',
      );
    const actualMime = this.inspectMime(bytes);
    if (!actualMime || actualMime !== intent.declaredMime || !MIME_TO_EVIDENCE_TYPE[actualMime]) {
      return this.rejectUpload(
        intent.id,
        intent.objectPath,
        shopId,
        actorId,
        'Uploaded bytes do not match the declared supported media type',
      );
    }
    const contentSha256 = createHash('sha256').update(bytes).digest('hex');
    const scan = await this.malwareScanner.scan(bytes);
    if (scan.status === 'INFECTED') {
      await this.rejectUpload(
        intent.id,
        intent.objectPath,
        shopId,
        actorId,
        `Malware detected: ${scan.signature}`,
        scan.signature,
      );
    }
    if (scan.status === 'NOT_SCANNED' && process.env.NODE_ENV === 'production') {
      await this.rejectUpload(
        intent.id,
        intent.objectPath,
        shopId,
        actorId,
        'Malware scanning is required before evidence can be retained',
      );
      throw new ServiceUnavailableException(
        'Malware scanning is required before evidence can be retained',
      );
    }
    const pendingAfterScan = await this.prisma.evidenceUploadIntent.findFirst({
      where: { id: intent.id, status: 'PENDING', expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!pendingAfterScan)
      throw new ConflictException(
        'Evidence upload intent expired or changed during malware scanning',
      );
    const finalObjectPath = intent.objectPath.replace(/^quarantine\//, 'originals/');
    await this.storage.move(intent.objectPath, finalObjectPath);

    try {
      const evidence = await this.prisma.$transaction(async (tx) => {
        const stillPending = await tx.evidenceUploadIntent.updateMany({
          where: { id: intent.id, status: 'PENDING', expiresAt: { gt: new Date() } },
          data: { scanStatus: scan.status, scanSignature: scan.signature },
        });
        if (stillPending.count !== 1)
          throw new ConflictException('Upload intent expired or was completed concurrently');
        const record = await tx.evidence.create({
          data: {
            caseId,
            capturedById: actorId,
            type: MIME_TO_EVIDENCE_TYPE[actualMime]!,
            category: intent.category,
            purpose: intent.purpose,
            assetRole: DbAssetRole.ORIGINAL,
            fileUrl: null,
            thumbnailUrl: null,
            fileName: intent.originalName,
            fileSize: bytes.byteLength,
            mimeType: intent.declaredMime,
            verifiedMimeType: actualMime,
            storagePath: finalObjectPath,
            contentSha256,
            malwareStatus: scan.status,
            malwareScannedAt: scan.status === 'NOT_SCANNED' ? null : new Date(),
            malwareSignature: scan.signature,
            retentionUntil: new Date(Date.now() + this.storage.retentionDays * 86_400_000),
            description: intent.description,
            legacyUnverified: false,
            integrityStatement: INTEGRITY_STATEMENT,
          },
        });
        const completed = await tx.evidenceUploadIntent.updateMany({
          where: { id: intent.id, status: 'PENDING', expiresAt: { gt: new Date() } },
          data: { status: 'COMPLETED', evidenceId: record.id, completedAt: new Date() },
        });
        if (completed.count !== 1)
          throw new ConflictException('Upload intent expired or was completed concurrently');
        await tx.auditEvent.create({
          data: {
            shopId,
            actorId,
            action: 'evidence.upload_completed',
            entityType: 'Evidence',
            entityId: record.id,
            metadata: {
              caseId,
              uploadId: intent.id,
              purpose: intent.purpose,
              assetRole: 'ORIGINAL',
              storagePath: finalObjectPath,
              fileSize: record.fileSize,
              declaredMime: intent.declaredMime,
              verifiedMime: actualMime,
              contentSha256,
              malwareStatus: scan.status,
              malwareSignature: scan.signature,
              integrityStatement: INTEGRITY_STATEMENT,
              retentionUntil: record.retentionUntil?.toISOString(),
            },
          },
        });
        return record;
      });
      return this.decorateForRead(evidence, shopId, actorId);
    } catch (error) {
      await this.storage.remove(finalObjectPath).catch(() => undefined);
      throw error;
    }
  }

  async findByCase(caseId: string, shopId: string, actorId: string, actorRole: string) {
    if (!['TECHNICIAN', 'SHOP_OWNER'].includes(actorRole))
      throw new ForbiddenException('Only repair shop staff can access case evidence');
    await this.assertStaffMembership(this.prisma, shopId, actorId, actorRole);
    const exists = await this.prisma.repairCase.findFirst({
      where: {
        id: caseId,
        shopId,
        deletedAt: null,
        ...(actorRole === 'TECHNICIAN' ? { technicianId: actorId } : {}),
      },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Repair case not found or you are not assigned to it');
    const records = await this.prisma.evidence.findMany({
      where: { caseId, deletedAt: null },
      include: {
        annotations: true,
        derivatives: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        deletionRequests: { orderBy: { requestedAt: 'desc' } },
        capturedBy: { select: { displayName: true } },
      },
      orderBy: { capturedAt: 'desc' },
    });
    return this.decorateForRead(records, shopId, actorId);
  }

  async createDownloadUrl(evidenceId: string, shopId: string, actorId: string, actorRole: string) {
    if (!['TECHNICIAN', 'SHOP_OWNER'].includes(actorRole))
      throw new ForbiddenException('Only repair shop staff can access case evidence');
    await this.assertStaffMembership(this.prisma, shopId, actorId, actorRole);
    const evidence = await this.prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        deletedAt: null,
        malwareStatus: 'CLEAN',
        legacyUnverified: false,
        storagePath: { not: null },
        repairCase: {
          shopId,
          deletedAt: null,
          ...(actorRole === 'TECHNICIAN' ? { technicianId: actorId } : {}),
        },
      },
    });
    if (!evidence?.storagePath) throw new NotFoundException('Verified evidence not found');
    const signedUrl = await this.storage.createDownload(evidence.storagePath, 60);
    await this.prisma.auditEvent.create({
      data: {
        shopId,
        actorId,
        action: 'evidence.access_url_issued',
        entityType: 'Evidence',
        entityId: evidence.id,
        metadata: {
          caseId: evidence.caseId,
          assetRole: evidence.assetRole,
          expiresInSeconds: 60,
          contentSha256: evidence.contentSha256,
          integrityStatement: INTEGRITY_STATEMENT,
        },
      },
    });
    return {
      evidenceId,
      signedUrl,
      expiresInSeconds: 60,
      assetRole: evidence.assetRole,
      contentSha256: evidence.contentSha256,
      integrityStatement: INTEGRITY_STATEMENT,
    };
  }

  /** Re-downloads a tenant-scoped original for explicit integrity audits; a matching hash does not prove authenticity. */
  async verifyStoredContentIntegrity(
    evidenceId: string,
    shopId: string,
    actorId: string,
    actorRole: string,
  ) {
    if (!['TECHNICIAN', 'SHOP_OWNER'].includes(actorRole))
      throw new ForbiddenException('Only repair shop staff can verify case evidence integrity');
    await this.assertStaffMembership(this.prisma, shopId, actorId, actorRole);
    const evidence = await this.prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        deletedAt: null,
        assetRole: 'ORIGINAL',
        storagePath: { not: null },
        repairCase: {
          shopId,
          deletedAt: null,
          ...(actorRole === 'TECHNICIAN' ? { technicianId: actorId } : {}),
        },
      },
      select: { id: true, caseId: true, storagePath: true, contentSha256: true },
    });
    if (!evidence?.storagePath || !evidence.contentSha256)
      throw new NotFoundException('Evidence with a recorded original-content hash was not found');

    const bytes = await this.storage.download(evidence.storagePath);
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    const matches = actualHash === evidence.contentSha256;
    await this.prisma.auditEvent.create({
      data: {
        shopId,
        actorId,
        action: matches ? 'evidence.integrity_match' : 'evidence.integrity_mismatch',
        entityType: 'Evidence',
        entityId: evidence.id,
        metadata: {
          caseId: evidence.caseId,
          expectedSha256: evidence.contentSha256,
          actualSha256: actualHash,
          bytesChecked: bytes.byteLength,
          hashMeaning: 'byte integrity only; not proof of authenticity or truth',
        },
      },
    });
    return { evidenceId, matches, integrityStatement: INTEGRITY_STATEMENT };
  }

  async createPriceObservationReviewDownloadUrl(evidenceId: string, actorId: string) {
    const reviewer = await this.prisma.profile.findFirst({
      where: {
        id: actorId,
        deletedAt: null,
        isActive: true,
        platformAdminRecord: { is: { active: true } },
      },
      select: { id: true },
    });
    if (!reviewer) throw new ForbiddenException('Active platform administrator access is required');
    const evidence = await this.prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        deletedAt: null,
        type: 'DOCUMENT',
        purpose: 'INVOICE',
        assetRole: 'ORIGINAL',
        malwareStatus: 'CLEAN',
        legacyUnverified: false,
        storagePath: { not: null },
        priceTransactions: { some: { status: 'PENDING_REVIEW' } },
      },
      select: {
        id: true,
        caseId: true,
        storagePath: true,
        contentSha256: true,
        priceTransactions: { select: { id: true } },
      },
    });
    if (!evidence?.storagePath)
      throw new NotFoundException('Pending price observation invoice not found');
    const signedUrl = await this.storage.createDownload(evidence.storagePath, 60);
    await this.prisma.platformAdminAuditEvent.create({
      data: {
        actorProfileId: actorId,
        action: 'price_observation.invoice_accessed',
        targetType: 'Evidence',
        targetId: evidence.id,
        metadata: {
          priceObservationIds: evidence.priceTransactions.map((item) => item.id),
          caseId: evidence.caseId,
          contentSha256: evidence.contentSha256,
          expiresInSeconds: 60,
        },
      },
    });
    return {
      evidenceId,
      signedUrl,
      expiresInSeconds: 60,
      contentSha256: evidence.contentSha256,
      integrityNotice:
        'The hash identifies file bytes; it does not establish invoice authenticity or transaction truth.',
    };
  }

  async addAnnotation(
    evidenceId: string,
    shopId: string,
    authorId: string,
    actorRole: string,
    authorName: string,
    dto: AddAnnotationDto,
  ) {
    if (!['TECHNICIAN', 'SHOP_OWNER'].includes(actorRole))
      throw new ForbiddenException('Only repair shop staff can annotate evidence');
    if (!dto.note?.trim()) throw new BadRequestException('Annotation note must contain text');
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffMembership(tx, shopId, authorId, actorRole);
      const evidence = await tx.evidence.findFirst({
        where: {
          id: evidenceId,
          deletedAt: null,
          repairCase: {
            shopId,
            deletedAt: null,
            ...(actorRole === 'TECHNICIAN' ? { technicianId: authorId } : {}),
          },
        },
        select: { id: true, assetRole: true, malwareStatus: true },
      });
      if (!evidence) throw new NotFoundException(`Evidence with ID ${evidenceId} not found`);
      if (evidence.assetRole !== 'ORIGINAL' || evidence.malwareStatus !== 'CLEAN')
        throw new BadRequestException('Only clean, original evidence can be annotated');
      const annotation = await tx.evidenceAnnotation.create({
        data: {
          evidenceId,
          x: dto.x,
          y: dto.y,
          note: dto.note.trim(),
          authorName: authorName.trim(),
        },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId: authorId,
          action: 'evidence.annotated',
          entityType: 'Evidence',
          entityId: evidenceId,
          metadata: { annotationId: annotation.id },
        },
      });
      return annotation;
    });
  }

  /** Used by a trusted image-processing worker; client requests cannot create derived assets. */
  async recordDerivedAsset(input: {
    parentEvidenceId: string;
    actorId: string;
    shopId: string;
    bytes: Buffer;
    fileName: string;
    mimeType: string;
    role: 'THUMBNAIL' | 'PROCESSED';
  }) {
    if (!(SUPPORTED_EVIDENCE_MIME_TYPES as readonly string[]).includes(input.mimeType))
      throw new BadRequestException('Unsupported derived asset media type');
    const detected = this.inspectMime(input.bytes);
    if (detected !== input.mimeType)
      throw new BadRequestException('Derived asset bytes do not match the declared media type');
    const parent = await this.prisma.evidence.findFirst({
      where: {
        id: input.parentEvidenceId,
        malwareStatus: 'CLEAN',
        assetRole: 'ORIGINAL',
        deletedAt: null,
        repairCase: { shopId: input.shopId, deletedAt: null },
      },
    });
    if (!parent) throw new NotFoundException('Clean original evidence was not found');
    const workerIdentity = await this.prisma.profile.findFirst({
      where: {
        id: input.actorId,
        isActive: true,
        memberships: { some: { shopId: input.shopId, revokedAt: null } },
      },
      select: { role: true },
    });
    if (!workerIdentity || workerIdentity.role !== 'PLATFORM_ADMIN')
      throw new ForbiddenException(
        'Derived assets can only be recorded by a trusted processing worker',
      );
    const scan = await this.malwareScanner.scan(input.bytes);
    if (scan.status === 'INFECTED')
      throw new BadRequestException('Derived asset was rejected by malware scanning');
    if (scan.status === 'NOT_SCANNED' && process.env.NODE_ENV === 'production')
      throw new BadRequestException('Derived assets require a clean malware scan in production');
    const storagePath = `derived/${input.shopId}/${parent.caseId}/${parent.id}/${randomUUID()}/${this.safeObjectName(input.fileName)}`;
    await this.storage.uploadDerived(storagePath, input.bytes, input.mimeType);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const derived = await tx.evidence.create({
          data: {
            caseId: parent.caseId,
            capturedById: input.actorId,
            type: MIME_TO_EVIDENCE_TYPE[input.mimeType]!,
            category: parent.category,
            purpose: parent.purpose,
            assetRole: input.role as DbAssetRole,
            derivedFromId: parent.id,
            fileName: input.fileName,
            fileSize: input.bytes.length,
            mimeType: input.mimeType,
            verifiedMimeType: input.mimeType,
            storagePath,
            contentSha256: createHash('sha256').update(input.bytes).digest('hex'),
            malwareStatus: scan.status,
            malwareScannedAt: scan.status === 'NOT_SCANNED' ? null : new Date(),
            malwareSignature: scan.signature,
            retentionUntil: parent.retentionUntil,
            legacyUnverified: false,
            integrityStatement: `${INTEGRITY_STATEMENT} This asset is derived from evidence ${parent.id}.`,
          },
        });
        if (input.role === 'THUMBNAIL')
          await tx.evidence.update({
            where: { id: parent.id },
            data: { thumbnailUrl: storagePath },
          });
        await tx.auditEvent.create({
          data: {
            shopId: input.shopId,
            actorId: input.actorId,
            action: 'evidence.derived_asset_created',
            entityType: 'Evidence',
            entityId: derived.id,
            metadata: {
              parentEvidenceId: parent.id,
              assetRole: input.role,
              contentSha256: derived.contentSha256,
              sourceContentSha256: parent.contentSha256,
            },
          },
        });
        return derived;
      });
    } catch (error) {
      await this.storage.remove(storagePath).catch(() => undefined);
      throw error;
    }
  }

  async createCustomerDownloadUrl(token: string, evidenceId: string) {
    const repairCase = await this.prisma.repairCase.findFirst({
      where: {
        authorizationToken: token,
        deletedAt: null,
        authorizationExpiresAt: { gt: new Date() },
      },
      select: { id: true, shopId: true },
    });
    if (!repairCase) throw new NotFoundException('Invalid or expired authorization link');
    const evidence = await this.prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        caseId: repairCase.id,
        deletedAt: null,
        malwareStatus: 'CLEAN',
        legacyUnverified: false,
        storagePath: { not: null },
      },
      select: { id: true, storagePath: true, assetRole: true, contentSha256: true },
    });
    if (!evidence?.storagePath) throw new NotFoundException('Verified evidence not found');
    const signedUrl = await this.storage.createDownload(evidence.storagePath, 60);
    await this.prisma.auditEvent.create({
      data: {
        shopId: repairCase.shopId,
        actorId: null,
        action: 'evidence.customer_access_url_issued',
        entityType: 'Evidence',
        entityId: evidence.id,
        metadata: {
          caseId: repairCase.id,
          assetRole: evidence.assetRole,
          contentSha256: evidence.contentSha256,
          expiresInSeconds: 60,
          integrityStatement: INTEGRITY_STATEMENT,
        },
      },
    });
    return {
      signedUrl,
      expiresInSeconds: 60,
      assetRole: evidence.assetRole,
      contentSha256: evidence.contentSha256,
      integrityStatement: INTEGRITY_STATEMENT,
    };
  }

  async decorateForRead<T>(value: T, shopId: string, actorId: string | null): Promise<T> {
    const issuedIds = new Set<string>();
    const signedByPath = new Map<string, string>();
    const visit = async (item: unknown): Promise<unknown> => {
      if (
        item === null ||
        item === undefined ||
        typeof item !== 'object' ||
        item instanceof Date ||
        Buffer.isBuffer(item)
      )
        return item;
      if (Array.isArray(item)) return Promise.all(item.map(visit));
      const record = item as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(record)) result[key] = await visit(nested);
      if (
        typeof record.id === 'string' &&
        Object.prototype.hasOwnProperty.call(record, 'malwareStatus')
      ) {
        if (
          typeof record.storagePath === 'string' &&
          record.malwareStatus === 'CLEAN' &&
          record.legacyUnverified === false &&
          !record.deletedAt
        ) {
          let url = signedByPath.get(record.storagePath);
          if (!url) {
            url = await this.storage.createDownload(record.storagePath, 60);
            signedByPath.set(record.storagePath, url);
          }
          result.fileUrl = url;
          issuedIds.add(record.id);
        } else {
          result.fileUrl = null;
        }
        result.thumbnailUrl = null;
        if (typeof record.thumbnailUrl === 'string' && record.thumbnailUrl.startsWith('derived/')) {
          let thumbnail = signedByPath.get(record.thumbnailUrl);
          if (!thumbnail) {
            thumbnail = await this.storage.createDownload(record.thumbnailUrl, 60);
            signedByPath.set(record.thumbnailUrl, thumbnail);
          }
          result.thumbnailUrl = thumbnail;
        }
        result.integrityStatement = record.integrityStatement || INTEGRITY_STATEMENT;
        delete result.storagePath;
        delete result.legacySourceUrl;
        delete result.legacyThumbnailUrl;
      }
      return result;
    };
    const decorated = await visit(value);
    if (issuedIds.size)
      await this.prisma.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'evidence.access_urls_issued',
          entityType: 'Evidence',
          entityId: [...issuedIds].join(','),
          metadata: {
            evidenceIds: [...issuedIds],
            expiresInSeconds: 60,
            reason: 'authorized record view',
            hashMeaning: 'byte integrity only; not proof of authenticity or truth',
          },
        },
      });
    return decorated as T;
  }

  async purgeExpiredEvidence(batchSize = 100) {
    let purged = 0;
    const expiredIntents = await this.prisma.evidenceUploadIntent.findMany({
      where: {
        OR: [
          { storageDeletionPending: true },
          { status: 'PENDING', expiresAt: { lte: new Date() } },
        ],
      },
      select: { id: true, shopId: true, uploadedById: true, objectPath: true, status: true, storageDeletionPending: true },
      take: batchSize,
    });
    for (const intent of expiredIntents) {
      if (intent.status === 'PENDING') {
        const changed = await this.prisma.$transaction(async (tx) => {
          const result = await tx.evidenceUploadIntent.updateMany({
            where: { id: intent.id, status: 'PENDING', expiresAt: { lte: new Date() } },
            data: { status: 'EXPIRED', storageDeletionPending: true },
          });
          if (result.count)
            await tx.auditEvent.create({
              data: {
                shopId: intent.shopId,
                actorId: intent.uploadedById,
                action: 'evidence.upload_expired',
                entityType: 'EvidenceUploadIntent',
                entityId: intent.id,
                metadata: { reason: 'Expired upload queued for quarantine cleanup' },
              },
            });
          return result.count;
        });
        if (!changed) continue;
      }
      try {
        await this.storage.remove(intent.objectPath);
      } catch (error) {
        this.logger.warn(
          `Could not remove quarantined evidence object for upload intent ${intent.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
      await this.prisma.evidenceUploadIntent.updateMany({
        where: { id: intent.id, storageDeletionPending: true },
        data: { storageDeletionPending: false },
      });
      purged++;
    }
    const expired = await this.prisma.evidence.findMany({
      where: {
        storagePath: { not: null },
        OR: [
          { deletedAt: null, retentionUntil: { lte: new Date() } },
          { storageDeletionPending: true },
        ],
      },
      select: {
        id: true,
        caseId: true,
        storagePath: true,
        contentSha256: true,
        storageDeletionPending: true,
        repairCase: { select: { shopId: true } },
        deletionRequests: { where: { status: 'APPROVED', completedAt: null }, select: { id: true } },
      },
      take: batchSize,
    });
    for (const evidence of expired) {
      if (!evidence.storagePath) continue;
      const tombstone = await this.prisma.$transaction(async (tx) => {
        const changed = await tx.evidence.updateMany({
          where: {
            id: evidence.id,
            OR: [
              { deletedAt: null, retentionUntil: { lte: new Date() } },
              { storageDeletionPending: true },
            ],
          },
          data: { deletedAt: new Date(), storageDeletionPending: true },
        });
        if (!changed.count) return false;
        if (!evidence.storageDeletionPending) await tx.auditEvent.create({
          data: {
            shopId: evidence.repairCase.shopId,
            actorId: null,
            action: 'evidence.retention_purged',
            entityType: 'Evidence',
            entityId: evidence.id,
            metadata: {
              caseId: evidence.caseId,
              contentSha256: evidence.contentSha256,
              retentionPolicy: 'configured retention expiry',
            },
          },
        });
        return true;
      });
      if (!tombstone) continue;
      try {
        await this.storage.remove(evidence.storagePath);
      } catch {
        continue;
      }
      await this.prisma.evidence.updateMany({
        where: { id: evidence.id, storageDeletionPending: true },
        data: { storageDeletionPending: false },
      });
      if (evidence.deletionRequests.length)
        await this.prisma.evidenceDeletionRequest.updateMany({
          where: { id: { in: evidence.deletionRequests.map((request) => request.id) }, completedAt: null },
          data: { completedAt: new Date() },
        });
      purged++;
    }
    return purged;
  }

  async requestDeletion(
    evidenceId: string,
    shopId: string,
    actorId: string,
    actorRole: string,
    reason: string,
  ) {
    if (!['TECHNICIAN', 'SHOP_OWNER'].includes(actorRole))
      throw new ForbiddenException('Only repair shop staff can request evidence deletion');
    if (!reason?.trim())
      throw new BadRequestException('A reason is required to request evidence deletion');
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffMembership(tx, shopId, actorId, actorRole);
      const evidence = await tx.evidence.findFirst({
        where: {
          id: evidenceId,
          deletedAt: null,
          repairCase: {
            shopId,
            deletedAt: null,
            ...(actorRole === 'TECHNICIAN' ? { technicianId: actorId } : {}),
          },
        },
      });
      if (!evidence) throw new NotFoundException('Evidence not found');
      const pending = await tx.evidenceDeletionRequest.findFirst({
        where: { evidenceId, status: 'PENDING' },
      });
      if (pending) return pending;
      const request = await tx.evidenceDeletionRequest.create({
        data: { evidenceId, requestedById: actorId, reason: reason.trim() },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'evidence.deletion_requested',
          entityType: 'Evidence',
          entityId: evidenceId,
          metadata: {
            deletionRequestId: request.id,
            reason: reason.trim(),
            contentSha256: evidence.contentSha256,
          },
        },
      });
      return request;
    });
  }

  async listDeletionRequests(shopId: string, reviewerId: string) {
    await this.assertStaffMembership(this.prisma, shopId, reviewerId, 'SHOP_OWNER');
    return this.prisma.evidenceDeletionRequest.findMany({
      where: { evidence: { repairCase: { shopId, deletedAt: null } } },
      include: {
        evidence: {
          select: {
            id: true,
            caseId: true,
            fileName: true,
            purpose: true,
            assetRole: true,
            contentSha256: true,
            retentionUntil: true,
            deletedAt: true,
          },
        },
        requestedBy: { select: { displayName: true } },
      },
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
      take: 100,
    });
  }

  async reviewDeletion(
    requestId: string,
    shopId: string,
    reviewerId: string,
    status: 'APPROVED' | 'REJECTED',
    reviewNotes?: string,
  ) {
    await this.assertStaffMembership(this.prisma, shopId, reviewerId, 'SHOP_OWNER');
    const request = await this.prisma.evidenceDeletionRequest.findFirst({
      where: { id: requestId, evidence: { repairCase: { shopId, deletedAt: null } } },
      include: {
        evidence: {
          select: {
            id: true,
            caseId: true,
            storagePath: true,
            contentSha256: true,
            assetRole: true,
            deletedAt: true,
            retentionUntil: true,
          },
        },
      },
    });
    if (!request) throw new NotFoundException('Evidence deletion request not found');
    if (request.status !== 'PENDING')
      throw new ConflictException('Evidence deletion request has already been reviewed');
    if (status === 'REJECTED') {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.evidenceDeletionRequest.updateMany({
          where: { id: requestId, status: 'PENDING' },
          data: { status, reviewedById: reviewerId, reviewedAt: new Date() },
        });
        if (!updated.count)
          throw new ConflictException('Evidence deletion request changed concurrently');
        await tx.auditEvent.create({
          data: {
            shopId,
            actorId: reviewerId,
            action: 'evidence.deletion_rejected',
            entityType: 'Evidence',
            entityId: request.evidenceId,
            metadata: { deletionRequestId: requestId, reviewNotes },
          },
        });
        return tx.evidenceDeletionRequest.findUnique({ where: { id: requestId } });
      });
    }
    if (request.evidence.assetRole === 'ORIGINAL') {
      const referenced = await this.prisma.$transaction(async (tx) => {
        const [quotes, tests, replacements, children, certificate] = await Promise.all([
          tx.quotationEvidence.count({ where: { evidenceId: request.evidenceId } }),
          tx.testResult.count({ where: { evidenceIds: { has: request.evidenceId } } }),
          tx.componentReplacement.count({ where: { evidenceIds: { has: request.evidenceId } } }),
          tx.evidence.count({ where: { derivedFromId: request.evidenceId, deletedAt: null } }),
          tx.certificate.count({ where: { caseId: request.evidence.caseId } }),
        ]);
        return quotes + tests + replacements + children + certificate > 0;
      });
      if (referenced)
        throw new ConflictException(
          'Evidence is part of a quotation, test, repair component, derived asset, or issued certificate and cannot be purged',
        );
    }
    const retentionLocked =
      request.evidence.retentionUntil && request.evidence.retentionUntil > new Date();
    const legalHold = this.config.get<string>('EVIDENCE_RETENTION_ALLOW_EARLY_DELETION') !== 'true';
    if (retentionLocked && legalHold)
      throw new ConflictException(
        'Evidence retention has not expired; this record remains under retention hold',
      );
    const approved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.evidenceDeletionRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: { status, reviewedById: reviewerId, reviewedAt: new Date() },
      });
      if (!updated.count)
        throw new ConflictException('Evidence deletion request changed concurrently');
      await tx.evidence.updateMany({
        where: { id: request.evidenceId, deletedAt: null },
        data: { deletedAt: new Date(), storageDeletionPending: Boolean(request.evidence.storagePath) },
      });
      if (!request.evidence.storagePath)
        await tx.evidenceDeletionRequest.updateMany({
          where: { id: requestId, status: 'APPROVED', completedAt: null },
          data: { completedAt: new Date() },
        });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId: reviewerId,
          action: 'evidence.deleted',
          entityType: 'Evidence',
          entityId: request.evidenceId,
          metadata: {
            deletionRequestId: requestId,
            contentSha256: request.evidence.contentSha256,
            reviewNotes,
            reason: request.reason,
          },
        },
      });
      return tx.evidenceDeletionRequest.findUnique({ where: { id: requestId } });
    });
    if (request.evidence.storagePath) {
      try {
        await this.storage.remove(request.evidence.storagePath);
        await this.prisma.$transaction(async (tx) => {
          await tx.evidence.updateMany({
            where: { id: request.evidenceId, storageDeletionPending: true },
            data: { storageDeletionPending: false },
          });
          await tx.evidenceDeletionRequest.updateMany({
            where: { id: requestId, status: 'APPROVED', completedAt: null },
            data: { completedAt: new Date() },
          });
        });
      } catch (error) {
        this.logger.warn(`Evidence object deletion deferred for request ${requestId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      await this.prisma.evidenceDeletionRequest.updateMany({
        where: { id: requestId, status: 'APPROVED', completedAt: null },
        data: { completedAt: new Date() },
      });
    }
    return this.prisma.evidenceDeletionRequest.findUnique({ where: { id: requestId } }) ?? approved;
  }

  private async rejectUpload(
    intentId: string,
    path: string,
    shopId: string,
    actorId: string,
    reason: string,
    signature?: string,
  ): Promise<never> {
    await this.prisma.$transaction(async (tx) => {
      await tx.evidenceUploadIntent.updateMany({
        where: { id: intentId, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          storageDeletionPending: true,
          scanStatus: signature ? 'INFECTED' : 'NOT_SCANNED',
          scanSignature: signature,
        },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: signature ? 'evidence.malware_rejected' : 'evidence.validation_rejected',
          entityType: 'EvidenceUploadIntent',
          entityId: intentId,
          metadata: { reason, malwareSignature: signature },
        },
      });
    });
    try {
      await this.storage.remove(path);
      await this.prisma.evidenceUploadIntent.updateMany({
        where: { id: intentId, status: 'REJECTED', storageDeletionPending: true },
        data: { storageDeletionPending: false },
      });
    } catch (error) {
      this.logger.warn(`Rejected evidence cleanup deferred for upload intent ${intentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw new BadRequestException(reason);
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private async assertStaffMembership(
    db: PrismaService | Prisma.TransactionClient,
    shopId: string,
    profileId: string,
    role: string,
  ) {
    const membershipRole = Object.values(OrganizationRole).find((candidate) => candidate === role);
    if (!membershipRole) throw new ForbiddenException(`Current ${role} membership is required`);
    const membership = await db.organizationMembership.findFirst({
      where: { shopId, profileId, role: membershipRole, revokedAt: null },
      select: { id: true },
    });
    if (!membership)
      throw new ForbiddenException(
        `Current ${role.toLowerCase().replace('_', ' ')} membership is required`,
      );
  }

  private safeObjectName(name: string) {
    const normalized = name.trim().split(/[\\/]/).pop() || 'evidence';
    return normalized.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'evidence';
  }

  private inspectMime(bytes: Buffer): string | null {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      return 'image/jpeg';
    if (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    )
      return 'image/png';
    if (
      bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP'
    )
      return 'image/webp';
    if (bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp') {
      const brand = bytes.toString('ascii', 8, 12).toLowerCase();
      if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand))
        return 'image/heic';
      if (brand === 'qt  ') return 'video/quicktime';
      return 'video/mp4';
    }
    if (bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
    return null;
  }
}
