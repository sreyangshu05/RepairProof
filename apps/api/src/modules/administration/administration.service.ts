import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDisputeDto } from './administration.dto';
import { CaseStatus } from '@repairproof/shared';
import { RepairLifecycleService } from '../case/repair-lifecycle.service';
@Injectable()
export class AdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: RepairLifecycleService,
  ) {}
  auditLog(shopId: string, limit = 50) {
    return this.prisma.auditEvent.findMany({
      where: { shopId },
      include: { actor: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
  async organizationOverview(shopId: string) {
    const [members, cases, devices, pendingApprovals] = await Promise.all([
      this.prisma.profile.count({ where: { shopId, deletedAt: null } }),
      this.prisma.repairCase.count({ where: { shopId, deletedAt: null } }),
      this.prisma.device.count({ where: { shopId, deletedAt: null } }),
      this.prisma.approval.count({
        where: { status: 'PENDING', quotation: { repairCase: { shopId, deletedAt: null } } },
      }),
    ]);
    return { members, cases, devices, pendingApprovals };
  }
  disputes(shopId: string) {
    return this.prisma.dispute.findMany({
      where: { repairCase: { shopId, deletedAt: null } },
      include: {
        repairCase: {
          select: {
            id: true,
            caseNumber: true,
            customerName: true,
            device: { select: { make: true, model: true } },
          },
        },
        openedBy: { select: { displayName: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
  }
  async createDispute(
    shopId: string,
    actorId: string,
    caseId: string,
    idempotencyKey: string,
    dto: CreateDisputeDto,
  ) {
    if (!idempotencyKey || idempotencyKey.length > 128)
      throw new ConflictException('A valid Idempotency-Key (1-128 characters) is required');
    return this.prisma.$transaction(async (tx) => {
      const requestHash = this.lifecycle.hashRequest(dto);
      const prior = await tx.dispute.findFirst({ where: { caseId, idempotencyKey } });
      if (prior) {
        if (prior.requestHash !== requestHash || prior.openedById !== actorId)
          throw new ConflictException('Idempotency key was already used for a different dispute');
        return prior;
      }
      const repairCase = await tx.repairCase.findFirst({
        where: { id: caseId, shopId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!repairCase) throw new NotFoundException('Repair case not found');
      if (repairCase.status !== CaseStatus.COMPLETED)
        throw new ConflictException('A dispute can only be opened against a completed repair');
      const dispute = await tx.dispute.create({
        data: {
          caseId,
          openedById: actorId,
          reason: dto.reason.trim(),
          description: dto.description.trim(),
          idempotencyKey,
          requestHash,
        },
      });
      await this.lifecycle.transition(tx, {
        caseId,
        shopId,
        actorId,
        actorRole: 'SHOP_OWNER',
        toState: CaseStatus.DISPUTED,
        idempotencyKey: `dispute:${this.lifecycle.hashRequest(idempotencyKey).slice(0, 32)}`,
        requestHash,
        supportingRecords: [dispute.id],
        reason: dto.reason.trim(),
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'dispute.opened',
          entityType: 'Dispute',
          entityId: dispute.id,
          metadata: { caseId },
        },
      });
      return dispute;
    });
  }
  async updateDispute(
    shopId: string,
    actorId: string,
    disputeId: string,
    idempotencyKey: string,
    status: 'REVIEWING' | 'RESOLVED' | 'REJECTED',
    resolution?: string,
  ) {
    if (!idempotencyKey || idempotencyKey.length > 128)
      throw new ConflictException('A valid Idempotency-Key (1-128 characters) is required');
    return this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findFirst({
        where: { id: disputeId, repairCase: { shopId, deletedAt: null } },
      });
      if (!dispute) throw new NotFoundException('Dispute not found');
      if (status === 'RESOLVED' || status === 'REJECTED') {
        const replay = await this.lifecycle.findReplay(tx, {
          caseId: dispute.caseId,
          shopId,
          actorId,
          actorRole: 'SHOP_OWNER',
          toState: CaseStatus.COMPLETED,
          idempotencyKey: `dispute-resolution:${this.lifecycle.hashRequest(idempotencyKey).slice(0, 32)}`,
          requestHash: this.lifecycle.hashRequest({ disputeId, status, resolution }),
        });
        if (replay) return dispute;
      }
      const allowed: Record<string, string[]> = {
        OPEN: ['REVIEWING', 'REJECTED'],
        REVIEWING: ['RESOLVED', 'REJECTED'],
        RESOLVED: [],
        REJECTED: [],
      };
      if (!allowed[dispute.status]?.includes(status))
        throw new ConflictException(
          `Invalid dispute transition from ${dispute.status} to ${status}`,
        );
      const changed = await tx.dispute.updateMany({
        where: { id: disputeId, status: dispute.status },
        data: {
          status,
          resolution: resolution?.trim(),
          resolvedAt: status === 'RESOLVED' || status === 'REJECTED' ? new Date() : undefined,
        },
      });
      if (!changed.count)
        throw new ConflictException('Dispute changed concurrently; reload and retry');
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'dispute.status_changed',
          entityType: 'Dispute',
          entityId: disputeId,
          metadata: { from: dispute.status, to: status },
        },
      });
      if (status === 'RESOLVED' || status === 'REJECTED')
        await this.lifecycle.transition(tx, {
          caseId: dispute.caseId,
          shopId,
          actorId,
          actorRole: 'SHOP_OWNER',
          toState: CaseStatus.COMPLETED,
          idempotencyKey: `dispute-resolution:${this.lifecycle.hashRequest(idempotencyKey).slice(0, 32)}`,
          requestHash: this.lifecycle.hashRequest({ disputeId, status, resolution }),
          supportingRecords: [disputeId],
          reason: resolution || `Dispute ${status.toLowerCase()}`,
        });
      return tx.dispute.findUnique({ where: { id: disputeId } });
    });
  }
}
