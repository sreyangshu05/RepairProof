import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTestResultDto } from './test-results.dto';
import { caseAccessWhere } from '../case/case-access';
@Injectable()
export class TestResultsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    caseId: string,
    shopId: string,
    authorId: string,
    actorRole: string,
    dto: CreateTestResultDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const repairCase = await tx.repairCase.findFirst({
        where: caseAccessWhere(caseId, shopId, authorId, actorRole),
        select: { id: true, status: true },
      });
      if (!repairCase) throw new NotFoundException('Repair case not found');
      if (repairCase.status !== 'IN_REPAIR')
        throw new BadRequestException(
          'Technician test results must be recorded before requesting independent verification',
        );
      const evidenceIds = [...new Set(dto.evidenceIds ?? [])];
      if (evidenceIds.length !== (dto.evidenceIds ?? []).length)
        throw new BadRequestException('Evidence references must be unique');
      if (evidenceIds.length) {
        const evidence = await tx.evidence.findMany({
          where: {
            id: { in: evidenceIds },
            caseId,
            deletedAt: null,
            assetRole: 'ORIGINAL',
            malwareStatus: 'CLEAN',
            legacyUnverified: false,
            storagePath: { not: null },
          },
          select: { id: true },
        });
        if (evidence.length !== evidenceIds.length)
          throw new BadRequestException(
            'Test results may reference only clean, managed original evidence attached to this case',
          );
      }
      const result = await tx.testResult.create({
        data: {
          caseId,
          authorId,
          name: dto.name.trim(),
          passed: dto.passed,
          details: dto.details as Prisma.InputJsonValue | undefined,
          notes: dto.notes?.trim(),
          evidenceIds,
        },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId: authorId,
          action: dto.passed ? 'test.passed' : 'test.failed',
          entityType: 'TestResult',
          entityId: result.id,
          metadata: { caseId, name: result.name, evidenceIds },
        },
      });
      return result;
    });
  }
  async list(caseId: string, shopId: string, actorId: string, actorRole: string) {
    const exists = await this.prisma.repairCase.findFirst({
      where: caseAccessWhere(caseId, shopId, actorId, actorRole),
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Repair case not found');
    return this.prisma.testResult.findMany({
      where: { caseId },
      orderBy: { testedAt: 'desc' },
      include: { author: { select: { id: true, displayName: true } } },
    });
  }
}
