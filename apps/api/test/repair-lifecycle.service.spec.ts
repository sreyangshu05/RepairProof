import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CASE_STATUS_TRANSITIONS, CaseStatus } from '@repairproof/shared';
import { RepairLifecycleService } from '../src/modules/case/repair-lifecycle.service';

describe('RepairLifecycleService', () => {
  let service: RepairLifecycleService;
  let tx: any;
  let repairCase: any;

  const input = (overrides: Record<string, unknown> = {}) => ({
    caseId: 'case-1',
    shopId: 'shop-1',
    actorId: 'tech-1',
    actorRole: 'TECHNICIAN',
    toState: CaseStatus.SUBMITTED,
    idempotencyKey: 'request-1',
    requestHash: 'hash-1',
    ...overrides,
  });

  beforeEach(() => {
    service = new RepairLifecycleService();
    repairCase = { id: 'case-1', status: CaseStatus.DRAFT, technicianId: 'tech-1' };
    tx = {
      repairCase: {
        findFirst: jest.fn().mockImplementation(async () => repairCase),
        findUnique: jest.fn().mockResolvedValue({
          customerName: 'Customer',
          customerPhone: '+10000000000',
          problemDescription: 'Screen repair',
          deviceId: 'device-1',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      repairCaseTransition: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'transition-1' }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      diagnostic: { count: jest.fn().mockResolvedValue(1) },
      quotation: { findFirst: jest.fn().mockResolvedValue({ id: 'quote-1' }) },
      approval: { findFirst: jest.fn().mockResolvedValue({ id: 'approval-1' }) },
      repairStep: { count: jest.fn().mockResolvedValue(1) },
      testResult: {
        findMany: jest.fn().mockResolvedValue([{ id: 'test-1', name: 'Power', passed: true }]),
      },
      evidence: { findMany: jest.fn().mockResolvedValue([{ id: 'evidence-1' }]) },
      verification: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'verify-1', passed: true, verifiedById: 'verifier-2' }),
      },
      dispute: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dispute-1' }),
        count: jest.fn().mockResolvedValue(0),
      },
    };
  });

  it('defines exactly the requested states and directed lifecycle edges', () => {
    expect(Object.values(CaseStatus)).toEqual([
      'DRAFT',
      'SUBMITTED',
      'UNDER_DIAGNOSIS',
      'DIAGNOSIS_COMPLETED',
      'QUOTATION_PENDING',
      'AWAITING_CUSTOMER_APPROVAL',
      'APPROVED',
      'REJECTED',
      'IN_REPAIR',
      'AWAITING_VERIFICATION',
      'COMPLETED',
      'DISPUTED',
      'CANCELLED',
    ]);
    expect(CASE_STATUS_TRANSITIONS[CaseStatus.DRAFT]).toEqual([
      CaseStatus.SUBMITTED,
      CaseStatus.CANCELLED,
    ]);
    expect(CASE_STATUS_TRANSITIONS[CaseStatus.IN_REPAIR]).toEqual([
      CaseStatus.AWAITING_VERIFICATION,
    ]);
    expect(CASE_STATUS_TRANSITIONS[CaseStatus.CANCELLED]).toEqual([]);
  });

  it('records a valid transition, timestamp, actor, evidence and audit in one transaction', async () => {
    const result = await service.transition(tx, input({ evidenceIds: ['evidence-1'] }));
    expect(result.replayed).toBe(false);
    expect(tx.repairCase.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: CaseStatus.DRAFT }),
        data: expect.objectContaining({ status: CaseStatus.SUBMITTED }),
      }),
    );
    expect(tx.repairCaseTransition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromState: CaseStatus.DRAFT,
          toState: CaseStatus.SUBMITTED,
          actorProfileId: 'tech-1',
          actorRole: 'TECHNICIAN',
          idempotencyKey: 'request-1',
          supportingRecords: ['evidence-1', 'device-1'],
        }),
      }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'repair_case.lifecycle_transition' }),
      }),
    );
  });

  it('rejects invalid edges and unauthorized actors without writing', async () => {
    await expect(service.transition(tx, input({ toState: CaseStatus.COMPLETED }))).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.repairCase.updateMany).not.toHaveBeenCalled();
    await expect(
      service.transition(tx, input({ actorId: 'other-tech', toState: CaseStatus.SUBMITTED })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires a cancellation reason', async () => {
    await expect(
      service.transition(
        tx,
        input({ actorId: 'owner-1', actorRole: 'SHOP_OWNER', toState: CaseStatus.CANCELLED }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(tx.repairCaseTransition.create).not.toHaveBeenCalled();
  });

  it('requires assignment and complete intake details before submitting a draft', async () => {
    repairCase.technicianId = null;
    await expect(
      service.transition(tx, input({ actorRole: 'SHOP_OWNER', actorId: 'owner-1' })),
    ).rejects.toThrow(BadRequestException);
    repairCase.technicianId = 'tech-1';
    tx.repairCase.findUnique.mockResolvedValueOnce({
      customerName: ' ',
      customerPhone: '+10000000000',
      problemDescription: 'Screen repair',
      deviceId: 'device-1',
    });
    await expect(service.transition(tx, input({ idempotencyKey: 'request-2' }))).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.repairCase.updateMany).not.toHaveBeenCalled();
  });

  it('requires completed repair actions, latest passing tests and post-repair evidence before verification', async () => {
    repairCase.status = CaseStatus.IN_REPAIR;
    tx.repairStep.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    const result = await service.transition(
      tx,
      input({ toState: CaseStatus.AWAITING_VERIFICATION }),
    );
    expect(result.replayed).toBe(false);
    expect(tx.repairCaseTransition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          toState: CaseStatus.AWAITING_VERIFICATION,
          supportingRecords: expect.arrayContaining(['test-1', 'evidence-1']),
        }),
      }),
    );
  });

  it('rejects verification requests when any repair action remains open or evidence is missing', async () => {
    repairCase.status = CaseStatus.IN_REPAIR;
    tx.repairStep.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    await expect(
      service.transition(tx, input({ toState: CaseStatus.AWAITING_VERIFICATION })),
    ).rejects.toThrow(BadRequestException);
    tx.repairStep.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    tx.testResult.findMany.mockResolvedValueOnce([]);
    await expect(
      service.transition(
        tx,
        input({ idempotencyKey: 'request-2', toState: CaseStatus.AWAITING_VERIFICATION }),
      ),
    ).rejects.toThrow(BadRequestException);
    tx.repairStep.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    tx.testResult.findMany.mockResolvedValueOnce([{ id: 'test-1', name: 'Power', passed: true }]);
    tx.evidence.findMany.mockResolvedValueOnce([]);
    await expect(
      service.transition(
        tx,
        input({ idempotencyKey: 'request-3', toState: CaseStatus.AWAITING_VERIFICATION }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows completion only after a passing independent verification', async () => {
    repairCase.status = CaseStatus.AWAITING_VERIFICATION;
    const result = await service.transition(
      tx,
      input({ actorId: 'verifier-2', actorRole: 'TECHNICIAN', toState: CaseStatus.COMPLETED }),
    );
    expect(result.replayed).toBe(false);
    expect(tx.repairCaseTransition.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ toState: CaseStatus.COMPLETED }) }),
    );
  });

  it('prevents the assigned technician from marking a repair independently verified', async () => {
    repairCase.status = CaseStatus.AWAITING_VERIFICATION;
    await expect(service.transition(tx, input({ toState: CaseStatus.COMPLETED }))).rejects.toThrow(
      ForbiddenException,
    );
    expect(tx.repairCase.updateMany).not.toHaveBeenCalled();
  });

  it('prevents another actor from applying someone else’s verification result', async () => {
    repairCase.status = CaseStatus.AWAITING_VERIFICATION;
    await expect(
      service.transition(
        tx,
        input({ actorId: 'shop-owner', actorRole: 'SHOP_OWNER', toState: CaseStatus.COMPLETED }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.repairCase.updateMany).not.toHaveBeenCalled();
  });

  it('requires a signed customer approval before accepting the customer decision', async () => {
    repairCase.status = CaseStatus.AWAITING_CUSTOMER_APPROVAL;
    tx.approval.findFirst.mockResolvedValue(null);
    await expect(
      service.transition(
        tx,
        input({ actorId: null, actorRole: 'CUSTOMER', toState: CaseStatus.APPROVED }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(tx.repairCase.updateMany).not.toHaveBeenCalled();
  });

  it('returns the prior transition for an identical idempotent retry and rejects key reuse', async () => {
    tx.repairCaseTransition.findFirst.mockResolvedValue({
      toState: CaseStatus.SUBMITTED,
      actorProfileId: 'tech-1',
      requestHash: 'hash-1',
    });
    await expect(service.transition(tx, input())).resolves.toMatchObject({ replayed: true });
    expect(tx.repairCase.updateMany).not.toHaveBeenCalled();
    await expect(service.transition(tx, input({ requestHash: 'different' }))).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects concurrent writes without appending history or audit', async () => {
    tx.repairCase.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.transition(tx, input())).rejects.toThrow(ConflictException);
    expect(tx.repairCaseTransition.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
});
