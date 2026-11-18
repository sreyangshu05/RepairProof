import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRepairStepDto, UpdateRepairStepDto } from './tracking.dto';
import { CaseStatus, RepairStepStatus } from '@repairproof/shared';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async addStep(caseId: string, performedById: string, dto: CreateRepairStepDto) {
    const repairCase = await this.prisma.repairCase.findUnique({
      where: { id: caseId },
      include: { steps: { orderBy: { stepNumber: 'desc' }, take: 1 } },
    });

    if (!repairCase) {
      throw new NotFoundException(`Repair case with ID ${caseId} not found`);
    }

    const nextStepNumber = (repairCase.steps[0]?.stepNumber || 0) + 1;

    // Transition case to IN_REPAIR if approved
    if (repairCase.status === CaseStatus.APPROVED) {
      await this.prisma.repairCase.update({
        where: { id: caseId },
        data: { status: CaseStatus.IN_REPAIR },
      });
    }

    return this.prisma.repairStep.create({
      data: {
        caseId,
        stepNumber: nextStepNumber,
        title: dto.title,
        description: dto.description,
        status: RepairStepStatus.IN_PROGRESS,
        photos: dto.photos || [],
        partsUsed: (dto.partsUsed as any) || [],
        performedById,
        startedAt: new Date(),
      },
    });
  }

  async updateStep(stepId: string, dto: UpdateRepairStepDto) {
    const step = await this.prisma.repairStep.findUnique({
      where: { id: stepId },
    });

    if (!step) {
      throw new NotFoundException(`Repair step with ID ${stepId} not found`);
    }

    const isCompleted = dto.status === RepairStepStatus.COMPLETED;

    return this.prisma.repairStep.update({
      where: { id: stepId },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.photos ? { photos: dto.photos } : {}),
        ...(dto.partsUsed ? { partsUsed: dto.partsUsed as any } : {}),
        ...(isCompleted ? { completedAt: new Date() } : {}),
      },
    });
  }

  async findByCase(caseId: string) {
    return this.prisma.repairStep.findMany({
      where: { caseId, deletedAt: null },
      orderBy: { stepNumber: 'asc' },
    });
  }
}
