import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CaseStatus } from '@repairproof/shared';
import { AuthorizationService } from '../src/modules/authorization/authorization.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('Customer approval workflow', () => {
  let service: AuthorizationService;
  let tx: any;
  let lifecycle: any;
  let currentCase: any;
  let prisma: any;
  beforeEach(() => {
    currentCase = {
      id: 'case-1',
      shopId: 'shop-1',
      status: CaseStatus.AWAITING_CUSTOMER_APPROVAL,
      authorizationExpiresAt: new Date(Date.now() + 60_000),
      technicianId: 'tech-1',
      quotations: [{ id: 'quote-1', status: 'SENT', validUntil: new Date(Date.now() + 60_000) }],
    };
    tx = {
      quotation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'quote-1', status: 'APPROVED' }),
      },
      approval: {
        findFirst: jest.fn().mockResolvedValue({ id: 'approval-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      quotationChangeRequest: { create: jest.fn().mockResolvedValue({ id: 'change-1' }) },
      repairCase: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          technicianId: 'tech-1',
          customerEmail: 'customer@example.test',
        }),
      },
      notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      profile: { findUnique: jest.fn().mockResolvedValue({ locale: 'en-IN' }) },
      auditEvent: { create: jest.fn() },
    };
    lifecycle = {
      hashRequest: jest.fn(() => 'hash'),
      findReplay: jest.fn().mockResolvedValue(null),
      transition: jest.fn().mockResolvedValue({}),
    };
    prisma = {
      repairCase: { findUnique: jest.fn().mockResolvedValue(currentCase) },
      $transaction: jest.fn((fn) => fn(tx)),
    };
    service = new AuthorizationService(
      prisma,
      lifecycle,
      { decorateForRead: jest.fn(async (value) => value) } as any,
      new NotificationsService({} as any),
    );
  });

  it('records one signed customer decision and advances through the lifecycle service', async () => {
    const result = await service.respondToQuotation('long-token', 'approval-key', {
      approved: true,
      customerSignatureName: 'R. Customer',
    });
    expect(result.status).toBe(CaseStatus.APPROVED);
    expect(tx.quotation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SENT' }),
        data: expect.objectContaining({ respondedAt: expect.any(Date) }),
      }),
    );
    expect(tx.approval.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED',
          customerSignatureName: 'R. Customer',
          decisionRequestHash: 'hash',
          respondedAt: expect.any(Date),
        }),
      }),
    );
    expect(lifecycle.transition).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorRole: 'CUSTOMER',
        actorId: null,
        toState: CaseStatus.APPROVED,
        idempotencyKey: 'approval-key',
      }),
    );
  });

  it('prevents a second non-idempotent response', async () => {
    tx.quotation.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.respondToQuotation('long-token', 'different-key', {
        approved: false,
        customerSignatureName: 'R. Customer',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects an unknown authorization link without recording an approval', async () => {
    prisma.repairCase.findUnique.mockResolvedValue(null);
    await expect(
      service.respondToQuotation('guessed-token', 'approval-key', {
        approved: true,
        customerSignatureName: 'R. Customer',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(tx.quotation.updateMany).not.toHaveBeenCalled();
    expect(tx.approval.updateMany).not.toHaveBeenCalled();
    expect(lifecycle.transition).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });

  it('returns an allowlisted authorization view without bearer token or private identifiers', async () => {
    prisma.repairCase.findUnique.mockResolvedValue({
      ...currentCase,
      caseNumber: 'RP-1',
      customerName: 'Customer Name',
      customerPhone: '+100000000',
      customerEmail: 'private@example.test',
      authorizationToken: 'secret-bearer-token',
      createdAt: new Date(),
      estimatedCompletionAt: null,
      problemDescription: 'Screen is cracked',
      shop: {
        name: 'Repair Shop',
        phone: 'private shop phone',
        email: 'private shop email',
        logoUrl: null,
      },
      device: {
        category: 'SMARTPHONE',
        make: 'Maker',
        model: 'Model',
        serialNumber: 'secret serial',
        imei: 'secret imei',
      },
      evidence: [],
      quotations: [],
    });
    const result = await service.getCaseByToken('long-token');
    const serialized = JSON.stringify(result);
    expect(result).toMatchObject({ caseNumber: 'RP-1', device: { make: 'Maker', model: 'Model' } });
    expect(serialized).not.toContain('secret-bearer-token');
    expect(serialized).not.toContain('secret serial');
    expect(serialized).not.toContain('secret imei');
    expect(serialized).not.toContain('private@example.test');
    expect(serialized).not.toContain('customerPhone');
  });

  it('rejects a quotation approval when the signature name is blank', async () => {
    await expect(
      service.respondToQuotation('long-token', 'blank-signature-key', {
        approved: true,
        customerSignatureName: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.quotation.updateMany).not.toHaveBeenCalled();
    expect(tx.approval.updateMany).not.toHaveBeenCalled();
    expect(lifecycle.transition).not.toHaveBeenCalled();
  });

  it('records a signed change request, rejects the old version, and notifies the technician', async () => {
    const result = await service.respondToQuotation('long-token', 'change-key', {
      decision: 'REQUEST_CHANGES',
      customerSignatureName: 'R. Customer',
      notes: 'Please quote an aftermarket display option.',
    });
    expect(result).toMatchObject({
      decision: 'REQUEST_CHANGES',
      status: CaseStatus.REJECTED,
      changeRequest: { id: 'change-1' },
    });
    expect(tx.quotation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }),
    );
    expect(tx.quotationChangeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quotationId: 'quote-1',
          requestText: 'Please quote an aftermarket display option.',
          idempotencyKey: 'change-key',
        }),
      }),
    );
    expect(lifecycle.transition).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        toState: CaseStatus.REJECTED,
        supportingRecords: ['quote-1', 'approval-1', 'change-1'],
      }),
    );
    expect(tx.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            type: 'CUSTOMER_REQUESTED_QUOTATION_CHANGES',
            profileId: 'tech-1',
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });

  it('requires explanatory text for a customer change request', async () => {
    await expect(
      service.respondToQuotation('long-token', 'change-key', {
        decision: 'REQUEST_CHANGES',
        customerSignatureName: 'R. Customer',
      }),
    ).rejects.toThrow('Describe the requested scope or price changes');
    expect(tx.quotationChangeRequest.create).not.toHaveBeenCalled();
  });

  it('replays a prior decision after the authorization link expires', async () => {
    currentCase.authorizationExpiresAt = new Date(Date.now() - 60_000);
    lifecycle.findReplay.mockResolvedValue({ id: 'transition-1' });
    await expect(
      service.respondToQuotation('long-token', 'approval-key', {
        approved: true,
        customerSignatureName: 'R. Customer',
      }),
    ).resolves.toMatchObject({ approved: true, status: CaseStatus.APPROVED, replayed: true });
    expect(tx.quotation.updateMany).not.toHaveBeenCalled();
  });
});
