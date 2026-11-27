import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VerificationService } from '../src/modules/verification/verification.service';
import { TrackingService } from '../src/modules/tracking/tracking.service';
import { EvidenceService } from '../src/modules/evidence/evidence.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { WarrantiesService } from '../src/modules/warranties/warranties.service';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { AdministrationService } from '../src/modules/administration/administration.service';
import { ApprovalsService } from '../src/modules/approvals/approvals.service';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { UsersService } from '../src/modules/users/users.service';

describe('Verification, tracking, evidence and support domains', () => {
  it('records an independent verification and advances only through the lifecycle service', async () => {
    const tx: any = {
      repairCase: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'case-1',
          status: 'AWAITING_VERIFICATION',
          technicianId: 'tech-1',
          device: { category: 'SMARTPHONE' },
        }),
      },
      verificationAttempt: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'attempt-1', passed: true }),
      },
      verification: {
        upsert: jest
          .fn()
          .mockResolvedValue({ id: 'verification-1', passed: true, verifiedById: 'verifier-1' }),
      },
      auditEvent: { create: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn((fn) => fn(tx)),
      organizationMembership: { findFirst: jest.fn().mockResolvedValue({ id: 'membership-1' }) },
    };
    const lifecycle: any = {
      hashRequest: jest.fn(() => 'hash'),
      transition: jest.fn().mockResolvedValue({}),
    };
    const service = new VerificationService(prisma, lifecycle);
    const checklist = service
      .getDefaultChecklist('SMARTPHONE')
      .map((item) => ({ ...item, passed: true }));
    await service.submitVerification(
      'case-1',
      'shop-1',
      'verifier-1',
      'SHOP_OWNER',
      'verification-1',
      { passed: true, checklist },
    );
    expect(lifecycle.transition).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ toState: 'COMPLETED', actorId: 'verifier-1' }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });

  it('rejects an invalid repair step state transition', async () => {
    const tx: any = {
      repairStep: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'step-1',
          status: 'COMPLETED',
          repairCase: { status: 'IN_REPAIR' },
        }),
        updateMany: jest.fn(),
      },
    };
    const prisma: any = { $transaction: jest.fn((fn) => fn(tx)) };
    await expect(
      new TrackingService(prisma, {} as any).updateStep('case-1', 'step-1', 'shop-1', 'profile-1', 'TECHNICIAN', {
        status: 'IN_PROGRESS' as any,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.repairStep.updateMany).not.toHaveBeenCalled();
  });

  it('checks technician assignment before replaying an idempotent repair step', async () => {
    const tx: any = {
      repairCase: { findFirst: jest.fn().mockResolvedValue(null) },
      repairStep: { findFirst: jest.fn().mockResolvedValue({ id: 'step-1' }) },
    };
    const service = new TrackingService(
      { $transaction: jest.fn((fn) => fn(tx)) } as any,
      { hashRequest: jest.fn(() => 'same-hash') } as any,
    );
    await expect(
      service.addStep('case-1', 'shop-1', 'tech-2', 'TECHNICIAN', 'same-key', {
        title: 'Repair', description: 'Repair details',
      } as any),
    ).rejects.toThrow(NotFoundException);
    expect(tx.repairStep.findFirst).not.toHaveBeenCalled();
  });

  it('does not attach evidence to another tenant case', async () => {
    const tx: any = {
      repairCase: { findFirst: jest.fn().mockResolvedValue(null) },
      evidenceUploadIntent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn((fn) => fn(tx)),
      organizationMembership: { findFirst: jest.fn().mockResolvedValue({ id: 'membership-1' }) },
    };
    const evidence = new EvidenceService(prisma, {} as any, {} as any, {} as any);
    const upload = {
      category: 'INTAKE',
      purpose: 'PHOTOGRAPH',
      mimeType: 'image/jpeg',
      fileName: 'x.jpg',
      fileSize: 10,
    };
    await expect(
      evidence.createUploadIntent(
        'case-1',
        'shop-2',
        'profile-1',
        'SHOP_OWNER',
        'upload-key',
        upload as any,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(tx.evidenceUploadIntent.create).not.toHaveBeenCalled();
  });

  it('marks notifications read only for their recipient', async () => {
    const prisma: any = {
      notification: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    await expect(
      new NotificationsService(prisma).markRead('notice-1', 'profile-1'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notice-1', profileId: 'profile-1', inAppVisible: true, readAt: null },
      }),
    );
  });

  it('rejects warranty claims outside an active warranty period', async () => {
    const tx: any = {
      warranty: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'warranty-1',
          status: 'EXPIRED',
          endsAt: new Date(Date.now() - 1000),
          startsAt: new Date(Date.now() - 86400000),
        }),
      },
      warrantyClaim: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((fn) => fn(tx)) };
    await expect(
      new WarrantiesService(prisma).createClaim('warranty-1', 'shop-1', 'profile-1', {
        description: 'Failed part',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.warrantyClaim.create).not.toHaveBeenCalled();
  });

  it('aggregates analytics from database results without fabricated trend data', async () => {
    const prisma: any = {
      repairCase: {
        groupBy: jest.fn().mockResolvedValue([{ status: 'IN_REPAIR', _count: { _all: 2 } }]),
      },
      device: { count: jest.fn().mockResolvedValue(5) },
      dispute: { count: jest.fn().mockResolvedValue(1) },
      warranty: { count: jest.fn().mockResolvedValue(3) },
    };
    await expect(new AnalyticsService(prisma).summary('shop-1')).resolves.toEqual({
      casesByStatus: { IN_REPAIR: 2 },
      deviceCount: 5,
      openDisputes: 1,
      activeWarranties: 3,
    });
  });

  it('scopes organization administration and audit records to the current shop', async () => {
    const prisma: any = {
      auditEvent: { findMany: jest.fn().mockResolvedValue([]) },
      profile: { count: jest.fn().mockResolvedValue(1) },
      repairCase: { count: jest.fn().mockResolvedValue(2) },
      device: { count: jest.fn().mockResolvedValue(3) },
      approval: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new AdministrationService(prisma, {} as any);
    await service.auditLog('shop-1');
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shopId: 'shop-1' } }),
    );
    await expect(service.organizationOverview('shop-1')).resolves.toEqual({
      members: 1,
      cases: 2,
      devices: 3,
      pendingApprovals: 0,
    });
  });

  it('limits pending approvals to the current organization', async () => {
    const prisma: any = { approval: { findMany: jest.fn().mockResolvedValue([]) } };
    await new ApprovalsService(prisma).pending('shop-1');
    expect(prisma.approval.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PENDING',
          quotation: { repairCase: { shopId: 'shop-1', deletedAt: null } },
        },
      }),
    );
  });

  it('only returns visible organization member fields', async () => {
    const prisma: any = {
      shop: { findFirst: jest.fn().mockResolvedValue({ id: 'shop-1' }) },
      profile: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new OrganizationsService(prisma);
    await service.current('shop-1');
    await service.members('shop-1');
    expect(prisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.not.objectContaining({ userId: true }) }),
    );
  });

  it('updates profile fields without accepting role changes', async () => {
    const prisma: any = {
      profile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'profile-1' }),
        update: jest.fn().mockResolvedValue({ displayName: 'Updated' }),
      },
    };
    await expect(
      new UsersService(prisma).updateProfile('auth-user-1', { displayName: 'Updated' }),
    ).resolves.toEqual({ displayName: 'Updated' });
    expect(prisma.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { displayName: 'Updated' } }),
    );
  });
});
