import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDiagnosticDto } from './diagnostics.dto';
import { RepairLifecycleService } from '../case/repair-lifecycle.service';
import { CaseStatus } from '@repairproof/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { caseAccessWhere } from '../case/case-access';

@Injectable()
export class DiagnosticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: RepairLifecycleService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly featureFlags?: FeatureFlagsService,
  ) {}

  async create(
    caseId: string,
    shopId: string,
    authorId: string,
    dto: CreateDiagnosticDto,
    actorRole = 'TECHNICIAN',
  ) {
    const diagnostic = await this.prisma.$transaction(async (tx) => {
      const repairCase = await tx.repairCase.findFirst({
        where: caseAccessWhere(caseId, shopId, authorId, actorRole),
      });
      if (!repairCase) throw new NotFoundException('Repair case not found');
      if (
        !([CaseStatus.SUBMITTED, CaseStatus.UNDER_DIAGNOSIS] as CaseStatus[]).includes(
          repairCase.status as CaseStatus,
        )
      ) {
        throw new BadRequestException(
          'Diagnostics can only be submitted before a quotation is sent',
        );
      }
      const diagnostic = await tx.diagnostic.create({
        data: {
          caseId,
          authorId,
          status: 'SUBMITTED',
          severity: dto.severity,
          findings: { ...dto.findings, ...(dto.summary ? { summary: dto.summary.trim() } : {}) },
          submittedAt: new Date(),
        },
      });
      if (repairCase.status === CaseStatus.SUBMITTED)
        await this.lifecycle.transition(tx, {
          caseId,
          shopId,
          actorId: authorId,
          actorRole,
          toState: CaseStatus.UNDER_DIAGNOSIS,
          idempotencyKey: `diagnostic-start:${diagnostic.id}`,
          supportingRecords: [diagnostic.id],
        });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId: authorId,
          action: 'diagnostic.submitted',
          entityType: 'Diagnostic',
          entityId: diagnostic.id,
          metadata: { caseId },
        },
      });
      return diagnostic;
    });
    const count = Object.keys(dto.findings ?? {}).length;
    void this.analytics?.record({
      name: 'diagnostic.submitted', sourceId: diagnostic.id, actorProfileId: authorId,
      shopId, role: actorRole, journeyId: caseId,
      properties: {
        findingCountBand: count === 0 ? '0' : count < 3 ? '1-2' : count < 6 ? '3-5' : '6+',
      },
    });
    void this.featureFlags?.recordConfiguredMetric(authorId, caseId, 'diagnostic_submitted');
    return diagnostic;
  }

  async complete(
    caseId: string,
    shopId: string,
    actorId: string,
    actorRole: string,
    idempotencyKey: string,
    notes?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const repairCase = await tx.repairCase.findFirst({
        where: caseAccessWhere(caseId, shopId, actorId, actorRole),
        select: { id: true },
      });
      if (!repairCase) throw new NotFoundException('Repair case not found');
      const diagnostics = await tx.diagnostic.findMany({
        where: { caseId, status: 'SUBMITTED' },
        select: { id: true },
      });
      if (!diagnostics.length)
        throw new BadRequestException('Submit diagnostic findings before completing diagnosis');
      await this.lifecycle.transition(tx, {
        caseId,
        shopId,
        actorId,
        actorRole,
        toState: CaseStatus.DIAGNOSIS_COMPLETED,
        idempotencyKey,
        requestHash: this.lifecycle.hashRequest({ notes }),
        reason: notes,
        supportingRecords: diagnostics.map((item) => item.id),
      });
      return { caseId, status: CaseStatus.DIAGNOSIS_COMPLETED };
    });
  }

  async findByCase(caseId: string, shopId: string, actorId: string, actorRole: string) {
    const exists = await this.prisma.repairCase.findFirst({
      where: caseAccessWhere(caseId, shopId, actorId, actorRole),
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Repair case not found');
    return this.prisma.diagnostic.findMany({
      where: { caseId },
      include: { author: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
