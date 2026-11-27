import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EvidenceService } from '../src/modules/evidence/evidence.service';
import { ObjectStorageService } from '../src/modules/evidence/object-storage.service';
import { ClamAvMalwareScanner } from '../src/modules/evidence/clamav-malware-scanner.service';

describe('EvidenceService secure upload workflow', () => {
  let service: EvidenceService;
  let prisma: any;
  let tx: any;
  let storage: any;
  let scanner: any;
  let intent: any;
  let original: Buffer;

  const dto = {
    category: 'DIAGNOSTIC',
    purpose: 'PHOTOGRAPH',
    fileName: 'board.jpg',
    fileSize: 11,
    mimeType: 'image/jpeg',
    description: 'Board damage',
  };

  beforeEach(() => {
    original = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
    intent = {
      id: 'upload-1',
      caseId: 'case-1',
      shopId: 'shop-1',
      uploadedById: 'tech-1',
      objectPath: 'quarantine/shop-1/case-1/upload-1/board.jpg',
      originalName: 'board.jpg',
      declaredMime: 'image/jpeg',
      expectedBytes: original.length,
      category: 'DIAGNOSTIC',
      purpose: 'PHOTOGRAPH',
      description: 'Board damage',
      idempotencyKey: 'key-1',
      requestHash: 'request-hash',
      status: 'PENDING',
      scanStatus: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      evidenceId: null,
    };
    tx = {
      evidenceUploadIntent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(intent),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      repairCase: { findFirst: jest.fn().mockResolvedValue({ id: 'case-1' }) },
      evidence: {
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'evidence-1', ...data })),
        findUnique: jest.fn().mockResolvedValue({ id: 'evidence-1' }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({ role: 'TECHNICIAN', id: 'membership-1' }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      quotationEvidence: { count: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn((fn) => fn(tx)),
      evidenceUploadIntent: {
        findFirst: jest.fn().mockResolvedValue(intent),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      evidence: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'evidence-1', storagePath: 'originals/file.jpg' }),
      },
      repairCase: { findFirst: jest.fn().mockResolvedValue({ id: 'case-1', shopId: 'shop-1' }) },
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({ role: 'TECHNICIAN', id: 'membership-1' }),
      },
      profile: { findFirst: jest.fn().mockResolvedValue({ role: 'PLATFORM_ADMIN' }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    storage = {
      maxFileBytes: 25 * 1024 * 1024,
      retentionDays: 2555,
      createSignedUpload: jest.fn().mockResolvedValue({
        bucket: 'evidence',
        objectPath: intent.objectPath,
        uploadToken: 'signed-token',
        signedUploadUrl: 'https://storage.invalid/signed',
      }),
      download: jest.fn().mockResolvedValue(original),
      move: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      createDownload: jest.fn().mockResolvedValue('https://storage.invalid/private-file?token=x'),
      uploadDerived: jest.fn().mockResolvedValue(undefined),
    };
    scanner = { scan: jest.fn().mockResolvedValue({ status: 'CLEAN' }) };
    service = new EvidenceService(
      prisma,
      storage as unknown as ObjectStorageService,
      scanner as unknown as ClamAvMalwareScanner,
      { get: jest.fn(() => 'test') } as any,
    );
  });

  it('creates a tenant-scoped, idempotent signed upload intent and writes an audit event', async () => {
    const result = await service.createUploadIntent(
      'case-1',
      'shop-1',
      'tech-1',
      'TECHNICIAN',
      'key-1',
      dto as any,
    );
    expect(result).toMatchObject({
      uploadId: 'upload-1',
      uploadToken: 'signed-token',
      maxFileBytes: 25 * 1024 * 1024,
    });
    expect(tx.repairCase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'case-1', shopId: 'shop-1', technicianId: 'tech-1' }),
      }),
    );
    expect(storage.createSignedUpload).toHaveBeenCalledWith(
      expect.stringContaining('quarantine/shop-1/case-1'),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'evidence.upload_intent_created' }),
      }),
    );
  });

  it('rejects upload sizes, MIME values, invalid purpose/category pairs, missing assignments and idempotency collisions', async () => {
    await expect(
      service.createUploadIntent('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'key-1', {
        ...dto,
        fileSize: 30 * 1024 * 1024,
      } as any),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createUploadIntent('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'key-1', {
        ...dto,
        mimeType: 'text/html',
      } as any),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createUploadIntent('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'key-1', {
        ...dto,
        purpose: 'INVOICE',
      } as any),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createUploadIntent('case-1', 'shop-1', 'tech-1', 'CUSTOMER', 'key-1', dto as any),
    ).rejects.toThrow(ForbiddenException);
    tx.evidenceUploadIntent.findFirst.mockResolvedValueOnce({
      ...intent,
      requestHash: 'different-hash',
    });
    await expect(
      service.createUploadIntent('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'key-1', dto as any),
    ).rejects.toThrow(ConflictException);
  });

  it('inspects uploaded bytes, computes SHA-256, malware scans and persists an original asset with non-authenticity wording', async () => {
    const result = await service.completeUpload('case-1', 'shop-1', 'tech-1', 'upload-1');
    expect(storage.download).toHaveBeenCalledWith(intent.objectPath);
    expect(scanner.scan).toHaveBeenCalledWith(original);
    expect(storage.move).toHaveBeenCalledWith(
      intent.objectPath,
      expect.stringContaining('originals/'),
    );
    expect(tx.evidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assetRole: 'ORIGINAL',
          purpose: 'PHOTOGRAPH',
          mimeType: 'image/jpeg',
          verifiedMimeType: 'image/jpeg',
          contentSha256: createHash('sha256').update(original).digest('hex'),
          malwareStatus: 'CLEAN',
          legacyUnverified: false,
          integrityStatement: expect.stringContaining('does not prove'),
          retentionUntil: expect.any(Date),
        }),
      }),
    );
    expect(tx.evidenceUploadIntent.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'evidence.upload_completed' }),
      }),
    );
    expect(result).toMatchObject({ id: 'evidence-1', assetRole: 'ORIGINAL' });
  });

  it('rejects MIME spoofing, size mismatch, and malware without creating evidence', async () => {
    storage.download.mockResolvedValue(Buffer.from('<html>hello</html>'));
    await expect(service.completeUpload('case-1', 'shop-1', 'tech-1', 'upload-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(storage.remove).toHaveBeenCalledWith(intent.objectPath);
    expect(tx.evidence.create).not.toHaveBeenCalled();

    storage.download.mockResolvedValue(original);
    scanner.scan.mockResolvedValue({ status: 'INFECTED', signature: 'Eicar-Test-Signature' });
    await expect(service.completeUpload('case-1', 'shop-1', 'tech-1', 'upload-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.evidence.create).not.toHaveBeenCalled();
  });

  it('refuses retrieval from another case/tenant and only issues short-lived signed URLs for clean originals', async () => {
    prisma.evidence.findFirst.mockResolvedValue(null);
    await expect(
      service.createDownloadUrl('evidence-1', 'other-shop', 'owner-1', 'SHOP_OWNER'),
    ).rejects.toThrow(NotFoundException);
    prisma.evidence.findFirst.mockResolvedValue({
      id: 'evidence-1',
      caseId: 'case-1',
      storagePath: 'originals/file.jpg',
      assetRole: 'ORIGINAL',
      contentSha256: 'a'.repeat(64),
    });
    await expect(
      service.createDownloadUrl('evidence-1', 'shop-1', 'owner-1', 'SHOP_OWNER'),
    ).resolves.toMatchObject({ expiresInSeconds: 60, assetRole: 'ORIGINAL' });
    expect(storage.createDownload).toHaveBeenCalledWith('originals/file.jpg', 60);
  });

  it('returns only short-lived links and strips storage internals and historical URLs from API records', async () => {
    const source = {
      id: 'evidence-1',
      caseId: 'case-1',
      storagePath: 'originals/private.jpg',
      malwareStatus: 'CLEAN',
      legacyUnverified: false,
      legacySourceUrl: 'https://old.example/private.jpg',
      legacyThumbnailUrl: 'https://old.example/thumb.jpg',
      thumbnailUrl: 'https://old.example/thumb.jpg',
    };
    const decorated = await service.decorateForRead(source, 'shop-1', 'tech-1');
    expect(decorated).toMatchObject({
      fileUrl: 'https://storage.invalid/private-file?token=x',
      thumbnailUrl: null,
    });
    expect(decorated).not.toHaveProperty('storagePath');
    expect(decorated).not.toHaveProperty('legacySourceUrl');
    expect(decorated).not.toHaveProperty('legacyThumbnailUrl');
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'evidence.access_urls_issued' }),
      }),
    );
  });

  it('detects a stored original whose bytes changed after upload and records the mismatch', async () => {
    const storedHash = createHash('sha256').update(original).digest('hex');
    prisma.evidence.findFirst.mockResolvedValue({
      id: 'evidence-1',
      caseId: 'case-1',
      storagePath: 'originals/private.jpg',
      contentSha256: storedHash,
    });
    storage.download.mockResolvedValue(
      Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    );

    await expect(
      service.verifyStoredContentIntegrity('evidence-1', 'shop-1', 'tech-1', 'TECHNICIAN'),
    ).resolves.toMatchObject({
      evidenceId: 'evidence-1',
      matches: false,
      integrityStatement: expect.stringContaining('does not prove'),
    });
    expect(storage.download).toHaveBeenCalledWith('originals/private.jpg');
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'evidence.integrity_mismatch',
          entityId: 'evidence-1',
          metadata: expect.objectContaining({
            expectedSha256: storedHash,
            actualSha256: expect.not.stringMatching(storedHash),
          }),
        }),
      }),
    );
  });

  it('keeps derived files explicitly linked and never labels their fingerprint as proof of truth', async () => {
    const parent = {
      id: 'parent-1',
      caseId: 'case-1',
      category: 'DIAGNOSTIC',
      purpose: 'PHOTOGRAPH',
      retentionUntil: new Date(Date.now() + 1000),
      contentSha256: 'b'.repeat(64),
    };
    prisma.evidence.findFirst.mockResolvedValue(parent);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    await expect(
      service.recordDerivedAsset({
        parentEvidenceId: 'parent-1',
        actorId: 'worker-1',
        shopId: 'shop-1',
        bytes: png,
        fileName: 'thumb.png',
        mimeType: 'image/png',
        role: 'THUMBNAIL',
      }),
    ).resolves.toMatchObject({ assetRole: 'THUMBNAIL', derivedFromId: 'parent-1' });
    expect(storage.uploadDerived).toHaveBeenCalledWith(
      expect.stringContaining('derived/shop-1/case-1/parent-1'),
      png,
      'image/png',
    );
  });

  it('does not replay completed upload bytes or allow an expired intent to finalize', async () => {
    intent.status = 'COMPLETED';
    intent.evidenceId = 'evidence-1';
    await expect(service.completeUpload('case-1', 'shop-1', 'tech-1', 'upload-1')).rejects.toThrow(
      ConflictException,
    );
    intent.status = 'PENDING';
    intent.expiresAt = new Date(Date.now() - 1000);
    await expect(service.completeUpload('case-1', 'shop-1', 'tech-1', 'upload-1')).rejects.toThrow(
      ConflictException,
    );
    expect(tx.evidence.create).not.toHaveBeenCalled();
  });

  it('records a rejected upload tombstone before storage removal and leaves retry state on failure', async () => {
    scanner.scan.mockResolvedValueOnce({ status: 'INFECTED', signature: 'EICAR-Test' });
    storage.remove.mockRejectedValueOnce(new Error('storage offline'));
    await expect(
      service.completeUpload('case-1', 'shop-1', 'tech-1', 'upload-1'),
    ).rejects.toThrow('Malware detected');
    expect(tx.evidenceUploadIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED', storageDeletionPending: true }),
      }),
    );
    expect(prisma.evidenceUploadIntent.updateMany).not.toHaveBeenCalled();
  });
});
