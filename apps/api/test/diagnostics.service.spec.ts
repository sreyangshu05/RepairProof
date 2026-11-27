import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CaseStatus } from '@repairproof/shared';
import { DiagnosticsService } from '../src/modules/diagnostics/diagnostics.service';

describe('DiagnosticsService', () => {
  let service: DiagnosticsService;
  let tx: any;
  let prisma: any;
  let lifecycle: any;

  beforeEach(() => {
    tx = {
      repairCase: {
        findFirst: jest.fn().mockResolvedValue({ id: 'case-1', status: CaseStatus.SUBMITTED }),
      },
      diagnostic: {
        create: jest.fn().mockResolvedValue({ id: 'diag-1' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'diag-1' }]),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    lifecycle = { transition: jest.fn().mockResolvedValue({}), hashRequest: jest.fn(() => 'hash') };
    prisma = { $transaction: jest.fn((fn) => fn(tx)), repairCase: tx.repairCase, diagnostic: tx.diagnostic };
    service = new DiagnosticsService(prisma, lifecycle);
  });

  it('starts diagnosis through the lifecycle service when the first diagnostic is submitted', async () => {
    await service.create(
      'case-1',
      'shop-1',
      'tech-1',
      { findings: { issue: 'cracked screen' }, severity: 'HIGH' },
      'TECHNICIAN',
    );
    expect(tx.diagnostic.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUBMITTED', authorId: 'tech-1' }),
      }),
    );
    expect(lifecycle.transition).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorId: 'tech-1',
        toState: CaseStatus.UNDER_DIAGNOSIS,
        supportingRecords: ['diag-1'],
      }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });

  it('scopes diagnostic reads and writes to a technician assignment', async () => {
    await service.findByCase('case-1', 'shop-1', 'tech-1', 'TECHNICIAN');
    expect(prisma.repairCase.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'case-1', shopId: 'shop-1', technicianId: 'tech-1' }),
      }),
    );
  });

  it('requires a submitted diagnostic before completing diagnosis', async () => {
    tx.diagnostic.findMany.mockResolvedValue([]);
    await expect(
      service.complete('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'complete-1'),
    ).rejects.toThrow(BadRequestException);
    expect(lifecycle.transition).not.toHaveBeenCalled();
  });

  it('supports idempotent diagnosis completion', async () => {
    await expect(
      service.complete('case-1', 'shop-1', 'tech-1', 'TECHNICIAN', 'complete-1'),
    ).resolves.toEqual({ caseId: 'case-1', status: CaseStatus.DIAGNOSIS_COMPLETED });
    expect(lifecycle.transition).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        idempotencyKey: 'complete-1',
        toState: CaseStatus.DIAGNOSIS_COMPLETED,
      }),
    );
  });

  it('rejects a case from another tenant and diagnostics after quotation', async () => {
    tx.repairCase.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.create('case-1', 'other-shop', 'tech-1', { findings: {} }),
    ).rejects.toThrow(NotFoundException);
    tx.repairCase.findFirst.mockResolvedValueOnce({
      id: 'case-1',
      status: CaseStatus.AWAITING_CUSTOMER_APPROVAL,
    });
    await expect(service.create('case-1', 'shop-1', 'tech-1', { findings: {} })).rejects.toThrow(
      BadRequestException,
    );
  });
});
