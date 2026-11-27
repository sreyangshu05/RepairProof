import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRepairStepDto, UpdateRepairStepDto } from './tracking.dto';
import { CaseStatus, RepairStepStatus } from '@repairproof/shared';
import { RepairLifecycleService } from '../case/repair-lifecycle.service';
import { caseAccessWhere } from '../case/case-access';

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: RepairLifecycleService,
  ) {}

  async addStep(
    caseId: string,
    shopId: string,
    performedById: string,
    actorRole: string,
    idempotencyKey: string,
    dto: CreateRepairStepDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (!idempotencyKey || idempotencyKey.length > 128)
        throw new BadRequestException('A valid Idempotency-Key (1-128 characters) is required');
      const repairCase = await tx.repairCase.findFirst({
        where: caseAccessWhere(caseId, shopId, performedById, actorRole),
        include: { steps: { orderBy: { stepNumber: 'desc' }, take: 1 } },
      });
      if (!repairCase) throw new NotFoundException(`Repair case with ID ${caseId} not found`);
      const requestHash = this.lifecycle.hashRequest(dto);
      const existing = await tx.repairStep.findFirst({ where: { caseId, idempotencyKey } });
      if (existing) {
        if (existing.requestHash !== requestHash || existing.performedById !== performedById)
          throw new ConflictException(
            'Idempotency key was already used for a different repair action',
          );
        return existing;
      }
      if (
        !([CaseStatus.APPROVED, CaseStatus.IN_REPAIR] as CaseStatus[]).includes(
          repairCase.status as CaseStatus,
        )
      )
        throw new BadRequestException('Repair steps require an approved repair case');
      const step = await tx.repairStep.create({
        data: {
          caseId,
          stepNumber: (repairCase.steps[0]?.stepNumber || 0) + 1,
          title: dto.title.trim(),
          description: dto.description.trim(),
          status: RepairStepStatus.IN_PROGRESS,
          photos: dto.photos || [],
          partsUsed: (dto.partsUsed as Prisma.InputJsonArray | undefined) || [],
          performedById,
          startedAt: new Date(),
          idempotencyKey,
          requestHash,
        },
      });
      if (repairCase.status === CaseStatus.APPROVED) {
        await this.lifecycle.transition(tx, {
          caseId,
          shopId,
          actorId: performedById,
          actorRole,
          toState: CaseStatus.IN_REPAIR,
          idempotencyKey: `repair-start:${idempotencyKey}`,
          requestHash,
          supportingRecords: [step.id],
          reason: 'Repair work started',
        });
      }
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId: performedById,
          action: 'repair.step_started',
          entityType: 'RepairStep',
          entityId: step.id,
          metadata: { caseId, stepNumber: step.stepNumber },
        },
      });
      return step;
    });
  }

  async updateStep(
    caseId: string,
    stepId: string,
    shopId: string,
    actorId: string,
    actorRole: string,
    dto: UpdateRepairStepDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const step = await tx.repairStep.findFirst({
        where: {
          id: stepId,
          caseId,
          repairCase: caseAccessWhere(caseId, shopId, actorId, actorRole),
        },
        include: { repairCase: { select: { status: true } } },
      });
      if (!step) throw new NotFoundException(`Repair step with ID ${stepId} not found`);
      if (step.repairCase.status !== CaseStatus.IN_REPAIR)
        throw new BadRequestException(
          'Repair actions can only be edited while the case is in repair',
        );
      if (
        ([RepairStepStatus.COMPLETED, RepairStepStatus.SKIPPED] as RepairStepStatus[]).includes(
          step.status,
        )
      )
        throw new BadRequestException('Closed repair actions are immutable');
      const allowed: Record<string, string[]> = {
        PENDING: ['IN_PROGRESS', 'SKIPPED'],
        IN_PROGRESS: ['COMPLETED', 'SKIPPED'],
        COMPLETED: [],
        SKIPPED: [],
      };
      if (dto.status && !allowed[step.status].includes(dto.status))
        throw new BadRequestException(
          `Invalid repair step transition from ${step.status} to ${dto.status}`,
        );
      const isCompleted = dto.status === RepairStepStatus.COMPLETED;
      const changed = await tx.repairStep.updateMany({
        where: {
          id: stepId,
          caseId,
          status: step.status,
          repairCase: caseAccessWhere(caseId, shopId, actorId, actorRole),
        },
        data: {
          ...(dto.title ? { title: dto.title.trim() } : {}),
          ...(dto.description ? { description: dto.description.trim() } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.photos ? { photos: dto.photos } : {}),
          ...(dto.partsUsed ? { partsUsed: dto.partsUsed as Prisma.InputJsonArray } : {}),
          ...(isCompleted ? { completedAt: new Date() } : {}),
        },
      });
      if (!changed.count)
        throw new ConflictException('Repair step changed concurrently; reload and retry');
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: dto.status ? `repair_step.${dto.status.toLowerCase()}` : 'repair_step.updated',
          entityType: 'RepairStep',
          entityId: stepId,
          metadata: { caseId },
        },
      });
      return tx.repairStep.findUnique({ where: { id: stepId } });
    });
  }

  async findByCase(caseId: string, shopId: string, actorId: string, actorRole: string) {
    const exists = await this.prisma.repairCase.findFirst({
      where: caseAccessWhere(caseId, shopId, actorId, actorRole),
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Repair case with ID ${caseId} not found`);
    return this.prisma.repairStep.findMany({
      where: { caseId, deletedAt: null },
      orderBy: { stepNumber: 'asc' },
    });
  }
}
