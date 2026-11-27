import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CaseStatus } from '@repairproof/shared';
import { QuotationService } from '../src/modules/quotation/quotation.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('QuotationService lifecycle integration', () => {
  let service: QuotationService;
  let tx: any;
  let lifecycle: any;
  let prisma: any;
  const dto = {
    diagnosedIssue: 'Display is cracked and touch is intermittent',
    proposedRepair: 'Replace the display assembly and verify touch response',
    items: [{ type: 'PART' as any, description: 'Display', quantity: 2, unitPrice: 10 }],
    laborCost: 5,
    additionalCharges: 3,
    taxRate: 0.1,
    estimatedCompletionHours: 48,
    warrantyTerms: '90 day parts and labor warranty',
    supportingEvidenceIds: ['evidence-1'],
    currency: 'usd',
  };

  beforeEach(() => {
    tx = {
      repairCase: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'case-1',
          status: CaseStatus.DIAGNOSIS_COMPLETED,
          technicianId: 'tech-1',
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          technicianId: 'tech-1',
          customerEmail: 'customer@example.test',
        }),
      },
      diagnostic: { findFirst: jest.fn().mockResolvedValue({ id: 'diag-1' }) },
      quotation: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'quote-1', ...data })),
      },
      approval: { upsert: jest.fn().mockResolvedValue({ id: 'approval-1' }) },
      notificationPreference: { findUnique: jest.fn().mockResolvedValue(null) },
      profile: { findUnique: jest.fn().mockResolvedValue({ locale: 'en-IN' }) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      evidence: { findMany: jest.fn().mockResolvedValue([{ id: 'evidence-1' }]) },
      quotationChangeRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    lifecycle = {
      findReplay: jest.fn().mockResolvedValue(null),
      transition: jest.fn().mockResolvedValue({}),
      hashRequest: jest.fn(() => 'hash'),
    };
    prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    service = new QuotationService(
      prisma,
      lifecycle,
      { get: jest.fn((key: string) => key === 'CUSTOMER_AUTHORIZATION_ENABLED' ? 'true' : 'http://localhost:5173') } as any,
      { decorateForRead: jest.fn(async (value) => value) } as any,
      new NotificationsService({} as any),
    );
  });

  it('calculates totals and advances to quotation pending through the guarded lifecycle', async () => {
    const quote = await service.create('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'quote-1', dto);
    expect(quote.partsCost.toString()).toBe('20');
    expect(quote.taxAmount.toString()).toBe('2.8');
    expect(quote.totalCost.toString()).toBe('30.8');
    expect(lifecycle.transition).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        toState: CaseStatus.QUOTATION_PENDING,
        supportingRecords: ['quote-1', 'diag-1', 'evidence-1'],
      }),
    );
  });

  it('does not create a quotation outside a completed diagnosis or rejected state', async () => {
    tx.repairCase.findFirst.mockResolvedValue({ id: 'case-1', status: CaseStatus.SUBMITTED });
    await expect(
      service.create('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'quote-2', dto),
    ).rejects.toThrow(BadRequestException);
    tx.repairCase.findFirst.mockResolvedValue(null);
    await expect(
      service.create('case-1', 'other-shop', 'tech-1', 'TECHNICIAN', 'quote-3', dto),
    ).rejects.toThrow(NotFoundException);
  });

  it('replays a quote create without creating another quotation', async () => {
    lifecycle.findReplay.mockResolvedValue({ supportingRecords: ['quote-existing'] });
    tx.quotation.findFirst.mockResolvedValue({ id: 'quote-existing', items: [] });
    await expect(
      service.create('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'quote-1', dto),
    ).resolves.toMatchObject({ id: 'quote-existing' });
    expect(tx.quotation.create).not.toHaveBeenCalled();
  });

  it('rejects tax rates outside the allowed range', async () => {
    await expect(
      service.create('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'quote-4', { ...dto, taxRate: 3 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a new immutable version after a rejected quotation and resolves open change requests', async () => {
    tx.repairCase.findFirst.mockResolvedValue({
      id: 'case-1',
      status: CaseStatus.REJECTED,
      technicianId: 'tech-1',
    });
    tx.quotation.findFirst.mockResolvedValueOnce({ version: 1 }).mockResolvedValueOnce(null);
    tx.quotation.create.mockImplementation(({ data }: { data: any }) =>
      Promise.resolve({ id: 'quote-2', ...data }),
    );
    tx.quotationChangeRequest.updateMany.mockResolvedValue({ count: 1 });
    const quote = await service.create(
      'case-1',
      'shop-1',
      'tech-1',
      'TECHNICIAN',
      'quote-revision-2',
      dto,
    );
    expect(quote.version).toBe(2);
    expect(tx.quotationChangeRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { caseId: 'case-1', status: 'OPEN' },
        data: expect.objectContaining({
          status: 'RESOLVED',
          replacementQuotationId: 'quote-2',
          resolvedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('refuses to create a revision over an approved quotation', async () => {
    tx.quotation.findFirst
      .mockResolvedValueOnce({ version: 1 })
      .mockResolvedValueOnce({ id: 'approved-quote' });
    await expect(
      service.create('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'quote-revision-blocked', dto),
    ).rejects.toThrow('An approved quotation is immutable');
    expect(tx.quotation.create).not.toHaveBeenCalled();
  });

  it('rejects evidence from another repair case', async () => {
    tx.evidence.findMany.mockResolvedValue([]);
    await expect(
      service.create('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'quote-bad-evidence', dto),
    ).rejects.toThrow(BadRequestException);
    expect(tx.quotation.create).not.toHaveBeenCalled();
  });

  it('sends a quote transactionally, queues the customer authorization link, and records notifications', async () => {
    tx.repairCase.findFirst.mockResolvedValue({
      id: 'case-1',
      status: CaseStatus.QUOTATION_PENDING,
      technicianId: 'tech-1',
      customerEmail: 'customer@example.test',
      authorizationToken: 'secret-token',
    });
    tx.quotation.findFirst
      .mockResolvedValueOnce({
        id: 'quote-1',
        version: 1,
        status: 'DRAFT',
        validUntil: new Date(Date.now() + 60_000),
        totalCost: { toString: () => '30.80' },
        currency: 'USD',
      })
      .mockResolvedValueOnce(null);
    tx.quotation.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.sendToCustomer(
      'case-1',
      'shop-1',
      'tech-1',
      'TECHNICIAN',
      'quote-1',
      'send-key',
    );
    expect(result).toMatchObject({ sent: true, status: CaseStatus.AWAITING_CUSTOMER_APPROVAL });
    expect(tx.approval.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { quotationId: 'quote-1' },
        create: { quotationId: 'quote-1', status: 'PENDING' },
      }),
    );
    expect(tx.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            recipientEmail: 'customer@example.test',
            type: 'NEW_QUOTATION',
            emailStatus: 'QUEUED',
            body: 'A repair quotation is ready for review. Open your secure review link to see details.',
            emailText: expect.stringContaining('/authorize/secret-token'),
            inAppVisible: false,
          }),
        ],
        skipDuplicates: true,
      }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'quotation.sent_for_approval',
          entityId: 'quote-1',
        }),
      }),
    );
  });

  it('does not mutate or notify for a quotation when customer authorization is disabled', async () => {
    const disabled = new QuotationService(
      prisma,
      lifecycle,
      { get: jest.fn(() => undefined) } as any,
      { decorateForRead: jest.fn(async (value) => value) } as any,
    );
    await expect(
      disabled.sendToCustomer('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'quote-1', 'send-disabled'),
    ).rejects.toThrow('Customer quotation authorization is disabled');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses to send a quotation after its validity period', async () => {
    tx.repairCase.findFirst.mockResolvedValue({
      id: 'case-1',
      status: CaseStatus.QUOTATION_PENDING,
      technicianId: 'tech-1',
    });
    tx.quotation.findFirst.mockResolvedValueOnce({
      id: 'quote-1',
      version: 1,
      status: 'DRAFT',
      validUntil: new Date(Date.now() - 1000),
      totalCost: { toString: () => '30.80' },
      currency: 'USD',
    });
    await expect(
      service.sendToCustomer(
        'case-1',
        'shop-1',
        'tech-1',
        'TECHNICIAN',
        'quote-1',
        'expired-send-key',
      ),
    ).rejects.toThrow('Quotation validity date has passed');
    expect(tx.quotation.updateMany).not.toHaveBeenCalled();
    expect(tx.approval.upsert).not.toHaveBeenCalled();
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
});
