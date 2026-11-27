import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, CaseStatus as DbCaseStatus } from '@prisma/client';
import { CASE_STATUS_TRANSITIONS, CaseStatus } from '@repairproof/shared';
import { createHash } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';

export interface LifecycleTransitionInput {
  caseId: string;
  shopId: string;
  actorId: string | null;
  actorRole: string;
  toState: CaseStatus;
  idempotencyKey: string;
  requestHash?: string;
  reason?: string;
  evidenceIds?: string[];
  supportingRecords?: string[];
}

const TRANSITION_ROLES: Partial<
  Record<CaseStatus, Partial<Record<CaseStatus, readonly string[]>>>
> = {
  [CaseStatus.DRAFT]: {
    [CaseStatus.SUBMITTED]: ['TECHNICIAN', 'SHOP_OWNER'],
    [CaseStatus.CANCELLED]: ['SHOP_OWNER'],
  },
  [CaseStatus.SUBMITTED]: {
    [CaseStatus.UNDER_DIAGNOSIS]: ['TECHNICIAN', 'SHOP_OWNER'],
    [CaseStatus.CANCELLED]: ['SHOP_OWNER'],
  },
  [CaseStatus.UNDER_DIAGNOSIS]: {
    [CaseStatus.DIAGNOSIS_COMPLETED]: ['TECHNICIAN', 'SHOP_OWNER'],
    [CaseStatus.CANCELLED]: ['SHOP_OWNER'],
  },
  [CaseStatus.DIAGNOSIS_COMPLETED]: {
    [CaseStatus.QUOTATION_PENDING]: ['TECHNICIAN', 'SHOP_OWNER'],
    [CaseStatus.CANCELLED]: ['SHOP_OWNER'],
  },
  [CaseStatus.QUOTATION_PENDING]: {
    [CaseStatus.AWAITING_CUSTOMER_APPROVAL]: ['TECHNICIAN', 'SHOP_OWNER'],
    [CaseStatus.CANCELLED]: ['SHOP_OWNER'],
  },
  [CaseStatus.AWAITING_CUSTOMER_APPROVAL]: {
    [CaseStatus.APPROVED]: ['CUSTOMER'],
    [CaseStatus.REJECTED]: ['CUSTOMER'],
    [CaseStatus.CANCELLED]: ['SHOP_OWNER'],
  },
  [CaseStatus.APPROVED]: {
    [CaseStatus.IN_REPAIR]: ['TECHNICIAN', 'SHOP_OWNER'],
    [CaseStatus.CANCELLED]: ['SHOP_OWNER'],
  },
  [CaseStatus.REJECTED]: {
    [CaseStatus.QUOTATION_PENDING]: ['TECHNICIAN', 'SHOP_OWNER'],
    [CaseStatus.CANCELLED]: ['SHOP_OWNER'],
  },
  [CaseStatus.IN_REPAIR]: { [CaseStatus.AWAITING_VERIFICATION]: ['TECHNICIAN', 'SHOP_OWNER'] },
  [CaseStatus.AWAITING_VERIFICATION]: {
    [CaseStatus.COMPLETED]: ['TECHNICIAN', 'SHOP_OWNER'],
    [CaseStatus.IN_REPAIR]: ['TECHNICIAN', 'SHOP_OWNER'],
  },
  [CaseStatus.COMPLETED]: { [CaseStatus.DISPUTED]: ['CUSTOMER', 'SHOP_OWNER'] },
  [CaseStatus.DISPUTED]: { [CaseStatus.COMPLETED]: ['SHOP_OWNER'] },
  [CaseStatus.CANCELLED]: {},
};

@Injectable()
export class RepairLifecycleService {
  constructor(@Optional() private readonly notifications?: NotificationsService) {}
  hashRequest(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  async findReplay(tx: Prisma.TransactionClient, input: LifecycleTransitionInput) {
    if (!input.idempotencyKey || input.idempotencyKey.length > 128)
      throw new BadRequestException('A valid Idempotency-Key (1-128 characters) is required');
    const prior = await tx.repairCaseTransition.findFirst({
      where: { caseId: input.caseId, idempotencyKey: input.idempotencyKey },
    });
    if (!prior) return null;
    if (
      prior.toState !== input.toState ||
      (input.requestHash && prior.requestHash !== input.requestHash) ||
      prior.actorProfileId !== input.actorId
    ) {
      throw new ConflictException(
        'Idempotency key was already used for a different lifecycle operation',
      );
    }
    return prior;
  }

  async initialize(
    tx: Prisma.TransactionClient,
    input: {
      caseId: string;
      shopId: string;
      actorId: string;
      actorRole: string;
      supportingRecords?: string[];
    },
  ) {
    const records = input.supportingRecords ?? [];
    await tx.repairCaseTransition.create({
      data: {
        caseId: input.caseId,
        fromState: null,
        toState: CaseStatus.DRAFT,
        actorProfileId: input.actorId,
        actorRole: input.actorRole,
        idempotencyKey: `case-created:${input.caseId}`,
        supportingRecords: records,
        reason: 'Repair case created',
      },
    });
    await tx.auditEvent.create({
      data: {
        shopId: input.shopId,
        actorId: input.actorId,
        action: 'repair_case.created',
        entityType: 'RepairCase',
        entityId: input.caseId,
        metadata: { to: CaseStatus.DRAFT, actorRole: input.actorRole, supportingRecords: records },
      },
    });
  }

  async transition(tx: Prisma.TransactionClient, input: LifecycleTransitionInput) {
    if (!input.idempotencyKey || input.idempotencyKey.length > 128)
      throw new BadRequestException('A valid Idempotency-Key (1-128 characters) is required');
    const replay = await this.findReplay(tx, input);
    if (replay) return { transition: replay, replayed: true };

    const repairCase = await tx.repairCase.findFirst({
      where: { id: input.caseId, shopId: input.shopId, deletedAt: null },
      select: { id: true, status: true, technicianId: true },
    });
    if (!repairCase) throw new NotFoundException('Repair case not found');
    const fromState = repairCase.status as CaseStatus;
    if (!CASE_STATUS_TRANSITIONS[fromState]?.includes(input.toState)) {
      throw new BadRequestException(
        `Invalid repair lifecycle transition ${fromState} → ${input.toState}`,
      );
    }
    const roles = TRANSITION_ROLES[fromState]?.[input.toState] ?? [];
    if (!roles.includes(input.actorRole))
      throw new ForbiddenException(
        `Role ${input.actorRole} cannot transition ${fromState} to ${input.toState}`,
      );
    const isIndependentVerification =
      input.toState === CaseStatus.COMPLETED ||
      (input.toState === CaseStatus.IN_REPAIR && fromState === CaseStatus.AWAITING_VERIFICATION);
    if (
      input.actorRole === 'TECHNICIAN' &&
      repairCase.technicianId !== input.actorId &&
      !isIndependentVerification
    ) {
      throw new ForbiddenException('Only the assigned technician can perform this transition');
    }
    if (
      input.toState === CaseStatus.COMPLETED ||
      (input.toState === CaseStatus.IN_REPAIR && fromState === CaseStatus.AWAITING_VERIFICATION)
    ) {
      if (!input.actorId || input.actorId === repairCase.technicianId)
        throw new ForbiddenException('An independent verifier must review this repair');
    }
    if (input.actorRole === 'CUSTOMER' && input.actorId !== null)
      throw new ForbiddenException('Customer decisions must use the customer authorization flow');
    if (input.toState === CaseStatus.CANCELLED && !input.reason?.trim())
      throw new BadRequestException('A cancellation reason is required');

    const evidenceIds = [...new Set(input.evidenceIds ?? [])];
    if (evidenceIds.length) {
      const evidence = await tx.evidence.findMany({
        where: { id: { in: evidenceIds }, caseId: input.caseId, deletedAt: null },
        select: { id: true },
      });
      if (evidence.length !== evidenceIds.length)
        throw new BadRequestException('All supporting evidence must belong to this repair case');
    }
    const supportingRecords = [...new Set([...(input.supportingRecords ?? []), ...evidenceIds])];
    await this.validatePrerequisites(
      tx,
      input,
      repairCase.technicianId,
      fromState,
      evidenceIds,
      supportingRecords,
    );

    const closedAt =
      input.toState === CaseStatus.COMPLETED || input.toState === CaseStatus.CANCELLED
        ? new Date()
        : null;
    const changed = await tx.repairCase.updateMany({
      where: {
        id: input.caseId,
        shopId: input.shopId,
        status: fromState as DbCaseStatus,
        deletedAt: null,
      },
      data: { status: input.toState as DbCaseStatus, closedAt },
    });
    if (changed.count !== 1)
      throw new ConflictException('Repair case changed concurrently; reload and retry');

    const transition = await tx.repairCaseTransition.create({
      data: {
        caseId: input.caseId,
        fromState: fromState as DbCaseStatus,
        toState: input.toState as DbCaseStatus,
        actorProfileId: input.actorId,
        actorRole: input.actorRole,
        reason: input.reason?.trim(),
        supportingRecords,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
      },
    });
    await tx.auditEvent.create({
      data: {
        shopId: input.shopId,
        actorId: input.actorId,
        action: 'repair_case.lifecycle_transition',
        entityType: 'RepairCase',
        entityId: input.caseId,
        metadata: {
          from: fromState,
          to: input.toState,
          actorRole: input.actorRole,
          reason: input.reason?.trim(),
          supportingRecords,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    const notification = lifecycleNotification(input.toState);
    if (notification)
      await this.notifications?.notifyCaseEvent(tx, {
        caseId: input.caseId,
        ...notification,
        deduplicationScope: `transition:${transition.id}`,
      });
    return { transition, replayed: false };
  }

  private async validatePrerequisites(
    tx: Prisma.TransactionClient,
    input: LifecycleTransitionInput,
    technicianId: string | null,
    fromState: CaseStatus,
    evidenceIds: string[],
    supportingRecords: string[],
  ) {
    if (fromState === CaseStatus.DRAFT && input.toState === CaseStatus.SUBMITTED) {
      if (!input.actorId || !technicianId)
        throw new BadRequestException('Assign a technician before submitting the repair case');
      const details = await tx.repairCase.findUnique({
        where: { id: input.caseId },
        select: {
          customerName: true,
          customerPhone: true,
          problemDescription: true,
          deviceId: true,
        },
      });
      if (
        !details?.customerName.trim() ||
        !details.customerPhone.trim() ||
        !details.problemDescription.trim() ||
        !details.deviceId
      ) {
        throw new BadRequestException(
          'Customer contact, problem description, and a registered device are required before submission',
        );
      }
      supportingRecords.push(details.deviceId);
    }
    if (input.toState === CaseStatus.DIAGNOSIS_COMPLETED) {
      const count = await tx.diagnostic.count({
        where: { caseId: input.caseId, status: 'SUBMITTED' },
      });
      if (!count)
        throw new BadRequestException('Submit diagnostic findings before completing diagnosis');
      supportingRecords.push('submitted-diagnostic');
    }
    if (input.toState === CaseStatus.QUOTATION_PENDING) {
      const quote = await tx.quotation.findFirst({
        where: { caseId: input.caseId, status: 'DRAFT', deletedAt: null },
        orderBy: { version: 'desc' },
        select: { id: true },
      });
      if (!quote)
        throw new BadRequestException(
          'A draft quotation is required before entering quotation pending',
        );
      supportingRecords.push(quote.id);
    }
    if (input.toState === CaseStatus.AWAITING_CUSTOMER_APPROVAL) {
      const approval = await tx.approval.findFirst({
        where: { quotation: { caseId: input.caseId, status: 'SENT' }, status: 'PENDING' },
        select: { id: true },
      });
      if (!approval)
        throw new BadRequestException(
          'A sent quotation with a pending customer approval is required',
        );
      supportingRecords.push(approval.id);
    }
    if (input.toState === CaseStatus.APPROVED || input.toState === CaseStatus.REJECTED) {
      const approval = await tx.approval.findFirst({
        where: {
          quotation: { caseId: input.caseId },
          status: input.toState === CaseStatus.APPROVED ? 'APPROVED' : 'REJECTED',
          customerSignatureName: { not: null },
          respondedAt: { not: null },
        },
        orderBy: { respondedAt: 'desc' },
        select: { id: true },
      });
      if (!approval) throw new BadRequestException('A signed customer decision is required');
      supportingRecords.push(approval.id);
    }
    if (input.toState === CaseStatus.IN_REPAIR && fromState === CaseStatus.APPROVED) {
      const count = await tx.repairStep.count({ where: { caseId: input.caseId, deletedAt: null } });
      if (!count) throw new BadRequestException('Create a repair action before starting repair');
    }
    if (input.toState === CaseStatus.AWAITING_VERIFICATION) {
      const [stepCount, incompleteCount, tests, postRepairEvidence] = await Promise.all([
        tx.repairStep.count({ where: { caseId: input.caseId, deletedAt: null } }),
        tx.repairStep.count({
          where: { caseId: input.caseId, deletedAt: null, status: { not: 'COMPLETED' } },
        }),
        tx.testResult.findMany({
          where: { caseId: input.caseId },
          select: { id: true, name: true, passed: true },
          orderBy: { testedAt: 'desc' },
        }),
        tx.evidence.findMany({
          where: { caseId: input.caseId, category: 'POST_REPAIR', deletedAt: null },
          select: { id: true },
        }),
      ]);
      if (!stepCount || incompleteCount)
        throw new BadRequestException(
          'Complete every repair action before requesting verification',
        );
      const latestTests = new Map<string, (typeof tests)[number]>();
      for (const test of tests) if (!latestTests.has(test.name)) latestTests.set(test.name, test);
      if (!latestTests.size || [...latestTests.values()].some((test) => !test.passed))
        throw new BadRequestException('The latest result for each post-repair test must pass');
      if (!postRepairEvidence.length)
        throw new BadRequestException('Attach post-repair evidence before requesting verification');
      supportingRecords.push(
        ...[...latestTests.values()].map((test) => test.id),
        ...postRepairEvidence.map((item) => item.id),
      );
      if (!evidenceIds.length) evidenceIds.push(...postRepairEvidence.map((item) => item.id));
    }
    if (
      input.toState === CaseStatus.COMPLETED ||
      (fromState === CaseStatus.AWAITING_VERIFICATION && input.toState === CaseStatus.IN_REPAIR)
    ) {
      const verification = await tx.verification.findUnique({
        where: { caseId: input.caseId },
        select: { id: true, passed: true, verifiedById: true },
      });
      if (!verification || verification.verifiedById === technicianId)
        throw new BadRequestException('Independent verification is required');
      if (verification.verifiedById !== input.actorId)
        throw new ForbiddenException(
          'Only the recorded independent verifier can finalize the verification result',
        );
      const expectedPass = input.toState === CaseStatus.COMPLETED;
      if (verification.passed !== expectedPass)
        throw new BadRequestException(
          expectedPass
            ? 'Only a passing independent verification can complete a repair'
            : 'A failed independent verification is required to return the case to repair',
        );
      supportingRecords.push(verification.id);
    }
    if (input.toState === CaseStatus.DISPUTED) {
      const dispute = await tx.dispute.findFirst({
        where: { caseId: input.caseId, status: { in: ['OPEN', 'REVIEWING'] } },
        select: { id: true },
      });
      if (!dispute)
        throw new BadRequestException(
          'An open dispute is required before marking a repair disputed',
        );
      supportingRecords.push(dispute.id);
    }
    if (fromState === CaseStatus.DISPUTED && input.toState === CaseStatus.COMPLETED) {
      const active = await tx.dispute.count({
        where: { caseId: input.caseId, status: { in: ['OPEN', 'REVIEWING'] } },
      });
      if (active)
        throw new BadRequestException('Resolve every open dispute before completing the repair');
    }
  }
}

function lifecycleNotification(toState: CaseStatus) {
  if (toState === CaseStatus.DIAGNOSIS_COMPLETED)
    return {
      category: 'DIAGNOSTICS' as const,
      type: 'DIAGNOSTIC_COMPLETED',
      title: 'Diagnostic review is ready',
      body: 'A repair case update is ready to view.',
      audience: 'CUSTOMER' as const,
    };
  if (toState === CaseStatus.APPROVED || toState === CaseStatus.REJECTED)
    return {
      category: 'QUOTATIONS' as const,
      type: 'CUSTOMER_APPROVAL_RECORDED',
      title: 'Customer responded to the quotation',
      body: 'A customer response is ready to review.',
      audience: 'TECHNICIAN' as const,
    };
  if (toState === CaseStatus.COMPLETED)
    return {
      category: 'CASE_UPDATES' as const,
      type: 'REPAIR_COMPLETED',
      title: 'Repair workflow completed',
      body: 'A repair case has reached its completion stage. View the repair record for details.',
      audience: 'CUSTOMER' as const,
    };
  if (toState === CaseStatus.DISPUTED)
    return {
      category: 'DISPUTES' as const,
      type: 'DISPUTE_UPDATED',
      title: 'Dispute status updated',
      body: 'There is an update to a repair case dispute.',
      audience: 'BOTH' as const,
    };
  if (toState === CaseStatus.AWAITING_CUSTOMER_APPROVAL) return null;
  return {
    category: 'CASE_UPDATES' as const,
    type: 'REPAIR_STATUS_CHANGED',
    title: 'Repair case status updated',
    body: 'A repair case status has changed. Sign in to view the latest update.',
    audience: 'CUSTOMER' as const,
  };
}
