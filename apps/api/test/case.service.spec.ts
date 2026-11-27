import { CaseStatus } from '@repairproof/shared';
import { CaseService } from '../src/modules/case/case.service';

describe('CaseService lifecycle endpoint', () => {
  it('bounds case listing and returns an opaque next cursor without authorization tokens', async () => {
    const prisma: any = {
      repairCase: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'case-1', authorizationToken: 'token-1' },
          { id: 'case-2', authorizationToken: 'token-2' },
        ]),
      },
    };
    const service = new CaseService(prisma, {} as any, {} as any);
    const result = await service.findAll('shop-1', undefined, 'tech-1', 1);
    expect(prisma.repairCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: 'shop-1', deletedAt: null, technicianId: 'tech-1' },
        take: 2,
      }),
    );
    expect(result).toEqual({ items: [{ id: 'case-1' }], nextCursor: 'case-1' });
  });

  it('creates intake device and repair case in one database transaction', async () => {
    const now = new Date();
    const tx: any = {
      organizationMembership: { findFirst: jest.fn().mockResolvedValue({ id: 'member-1' }) },
      device: { create: jest.fn().mockResolvedValue({ id: 'device-1' }) },
      repairCase: {
        create: jest.fn().mockResolvedValue({
          id: 'case-1',
          authorizationToken: 'private-bearer-token',
          device: { id: 'device-1' },
          technician: { id: 'tech-1' },
          createdAt: now,
        }),
      },
    };
    const prisma: any = { $transaction: jest.fn((fn) => fn(tx)) };
    const lifecycle: any = { initialize: jest.fn().mockResolvedValue(undefined) };
    const service = new CaseService(prisma, lifecycle, {} as any);
    const result = await service.createFromIntake('shop-1', 'tech-1', 'TECHNICIAN', {
      category: 'SMARTPHONE',
      make: 'Acme',
      model: 'Phone 1',
      serialLast4: '1234',
      customerName: 'Customer',
      customerPhone: '+15555550123',
      problemDescription: 'The device will not charge.',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.device.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shopId: 'shop-1', registeredById: 'tech-1' }),
      }),
    );
    expect(tx.repairCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shopId: 'shop-1', deviceId: 'device-1' }),
      }),
    );
    expect(lifecycle.initialize).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ caseId: 'case-1', supportingRecords: ['device-1'] }),
    );
    expect(result.id).toBe('case-1');
    expect(result).not.toHaveProperty('authorizationToken');
  });

  it('delegates status changes to the shared guarded lifecycle and returns the case with history', async () => {
    const tx: any = {
      repairCase: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'case-1',
          status: CaseStatus.SUBMITTED,
          lifecycleTransitions: [],
        }),
      },
    };
    const prisma: any = { $transaction: jest.fn((fn) => fn(tx)) };
    const lifecycle: any = {
      hashRequest: jest.fn(() => 'request-hash'),
      transition: jest.fn().mockResolvedValue({}),
    };
    const service = new CaseService(prisma, lifecycle, {
      decorateForRead: jest.fn(async (value) => value),
    } as any);
    const result = await service.updateStatus(
      'case-1',
      'shop-1',
      'tech-1',
      'TECHNICIAN',
      'request-1',
      { status: CaseStatus.SUBMITTED },
    );
    expect(lifecycle.transition).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        caseId: 'case-1',
        actorId: 'tech-1',
        actorRole: 'TECHNICIAN',
        toState: CaseStatus.SUBMITTED,
        idempotencyKey: 'request-1',
      }),
    );
    expect(result?.status).toBe(CaseStatus.SUBMITTED);
  });

  it("returns only the assigned technician's cases and maps persisted records for the workspace", async () => {
    const now = new Date('2026-11-22T00:00:00.000Z');
    const prisma: any = {
      profile: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tech-1',
          displayName: 'Technician',
          shop: { name: 'Repair Shop' },
        }),
      },
      repairCase: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'case-1',
            caseNumber: 'RP-1',
            status: CaseStatus.UNDER_DIAGNOSIS,
            priority: 'NORMAL',
            customerName: 'Customer',
            customerEmail: null,
            problemDescription: 'Device will not charge',
            createdAt: now,
            updatedAt: now,
            technicianId: 'tech-1',
            technician: { id: 'tech-1', displayName: 'Technician' },
            device: { make: 'Acme', model: 'Phone 1', serialNumber: 'ABCD', createdAt: now },
            diagnostics: [
              {
                findings: {
                  symptoms: 'No charge',
                  findings: 'Port obstructed',
                  recommendedWork: 'Clean port',
                  safetyNotes: '',
                },
                summary: null,
              },
            ],
            evidence: [
              { id: 'evidence-1', fileName: 'port.jpg', purpose: 'PHOTOGRAPH', capturedAt: now },
            ],
            quotations: [],
            testResults: [],
            warranty: null,
          },
        ]),
      },
    };
    const service = new CaseService(prisma, {} as any, {} as any);
    const result = await service.technicianWorkspace('shop-1', 'tech-1', 'TECHNICIAN');
    expect(prisma.repairCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId: 'shop-1', deletedAt: null, technicianId: 'tech-1' },
      }),
    );
    expect(result.technician.organizationName).toBe('Repair Shop');
    expect(result.cases[0]).toMatchObject({
      status: 'diagnosing',
      reference: 'RP-1',
      diagnostics: { findings: 'Port obstructed' },
    });
    expect(result.cases[0].evidence[0]).not.toHaveProperty('url');
  });

  it('does not query cases when the profile is outside the requested organization', async () => {
    const prisma: any = {
      profile: { findFirst: jest.fn().mockResolvedValue(null) },
      repairCase: { findMany: jest.fn() },
    };
    const service = new CaseService(prisma, {} as any, {} as any);
    await expect(service.technicianWorkspace('other-shop', 'tech-1', 'TECHNICIAN')).rejects.toThrow(
      'Technician workspace was not found',
    );
    expect(prisma.repairCase.findMany).not.toHaveBeenCalled();
  });
});
