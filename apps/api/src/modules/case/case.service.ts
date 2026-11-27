import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCaseDto, CreateCaseIntakeDto, UpdateCaseStatusDto } from './case.dto';
import { CaseStatus } from '@repairproof/shared';
import * as crypto from 'crypto';
import { RepairLifecycleService } from './repair-lifecycle.service';
import { EvidenceService } from '../evidence/evidence.service';
import { NotificationsService } from '../notifications/notifications.service';

function withoutAuthorizationToken<T extends object>(value: T): Omit<T, 'authorizationToken'> {
  const safeValue = { ...value };
  Reflect.deleteProperty(safeValue, 'authorizationToken');
  return safeValue as Omit<T, 'authorizationToken'>;
}
import { AnalyticsService } from '../analytics/analytics.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

@Injectable()
export class CaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: RepairLifecycleService,
    private readonly evidenceService: EvidenceService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly featureFlags?: FeatureFlagsService,
  ) {}

  private generateCaseNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomBytes(5).toString('hex').toUpperCase();
    return `RP-${date}-${suffix}`;
  }

  private generateAuthToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  async create(
    shopId: string,
    defaultTechId: string,
    dto: CreateCaseDto,
    actorRole = 'SHOP_OWNER',
  ) {
    // Verify device exists and belongs to shop
    const device = await this.prisma.device.findFirst({
      where: {
        id: dto.deviceId,
        shopId,
        deletedAt: null,
        ...(actorRole === 'TECHNICIAN'
          ? {
              OR: [
                { registeredById: defaultTechId },
                { repairCases: { some: { technicianId: defaultTechId, deletedAt: null } } },
              ],
            }
          : {}),
      },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${dto.deviceId} not found`);
    }

    const technicianId = dto.technicianId || defaultTechId;
    if (technicianId) {
      const technician = await this.prisma.organizationMembership.findFirst({
        where: { profileId: technicianId, shopId, revokedAt: null, profile: { deletedAt: null } },
        select: { id: true },
      });
      if (!technician)
        throw new NotFoundException('Technician is not a member of this organization');
    }

    const caseNumber = this.generateCaseNumber();
    const authorizationToken = this.generateAuthToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days validity

    const createdCase = await this.prisma.$transaction(async (tx) => {
      const repairCase = await tx.repairCase.create({
        data: {
          caseNumber,
          shopId,
          deviceId: dto.deviceId,
          technicianId,
          status: CaseStatus.DRAFT,
          priority: dto.priority || 'NORMAL',
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          customerEmail: dto.customerEmail,
          customerLocale: dto.customerLocale ?? 'en-IN',
          problemDescription: dto.problemDescription,
          authorizationToken,
          authorizationExpiresAt: expiresAt,
        },
        include: {
          device: true,
          technician: true,
        },
      });
      await this.lifecycle.initialize(tx, {
        caseId: repairCase.id,
        shopId,
        actorId: defaultTechId,
        actorRole,
        supportingRecords: [dto.deviceId],
      });
      await this.notifications?.notifyCaseEvent(tx, {
        caseId: repairCase.id,
        category: 'CASE_UPDATES',
        type: 'REPAIR_CASE_CREATED',
        title: 'Repair case created',
        body: 'A repair case has been created. Sign in to follow its progress.',
        deduplicationScope: `case-created:${repairCase.id}`,
        audience: 'CUSTOMER',
      });
      if (repairCase.technicianId)
        await this.notifications?.enqueue(tx, {
          profileId: repairCase.technicianId,
          category: 'CASE_UPDATES',
          type: 'REPAIR_CASE_ASSIGNED',
          title: 'Repair case assigned',
          body: 'A repair case has been assigned to you. Sign in to view the case.',
          deduplicationScope: `case-assigned:${repairCase.id}`,
          payload: { caseId: repairCase.id },
        });
      return withoutAuthorizationToken(repairCase);
    });
    void this.analytics?.record({
      name: 'repair_case.created', sourceId: createdCase.id, actorProfileId: defaultTechId,
      shopId, role: actorRole, journeyId: createdCase.id, properties: { entryMode: 'case_form' },
    });
    void this.featureFlags?.recordConfiguredMetric(defaultTechId, createdCase.id, 'repair_case_created');
    return createdCase;
  }

  async createFromIntake(
    shopId: string,
    actorId: string,
    actorRole: string,
    dto: CreateCaseIntakeDto,
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);
    const createdCase = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.organizationMembership.findFirst({
        where: { profileId: actorId, shopId, revokedAt: null, profile: { deletedAt: null } },
        select: { id: true },
      });
      if (!membership) throw new NotFoundException('Active organization membership is required');
      const device = await tx.device.create({
        data: {
          shopId,
          registeredById: actorId,
          category: dto.category,
          make: dto.make.trim(),
          model: dto.model.trim(),
          serialNumber: dto.serialLast4?.trim() || undefined,
          intakeCondition: `Customer reported: ${dto.problemDescription.trim()}`,
        },
      });
      const repairCase = await tx.repairCase.create({
        data: {
          caseNumber: this.generateCaseNumber(),
          shopId,
          deviceId: device.id,
          technicianId: actorId,
          status: CaseStatus.DRAFT,
          priority: dto.priority || 'NORMAL',
          customerName: dto.customerName.trim(),
          customerPhone: dto.customerPhone.trim(),
          customerEmail: dto.customerEmail?.trim() || undefined,
          customerLocale: dto.customerLocale ?? 'en-IN',
          problemDescription: dto.problemDescription.trim(),
          authorizationToken: this.generateAuthToken(),
          authorizationExpiresAt: expiresAt,
        },
        include: { device: true, technician: true },
      });
      await this.lifecycle.initialize(tx, {
        caseId: repairCase.id,
        shopId,
        actorId,
        actorRole,
        supportingRecords: [device.id],
      });
      await this.notifications?.notifyCaseEvent(tx, {
        caseId: repairCase.id,
        category: 'CASE_UPDATES',
        type: 'REPAIR_CASE_CREATED',
        title: 'Repair case created',
        body: 'A repair case has been created. Sign in to follow its progress.',
        deduplicationScope: `case-created:${repairCase.id}`,
        audience: 'CUSTOMER',
      });
      return withoutAuthorizationToken(repairCase);
    });
    void this.analytics?.record({
      name: 'device.registration_completed', sourceId: createdCase.deviceId, actorProfileId: actorId,
      shopId, role: actorRole, journeyId: createdCase.id,
      properties: { deviceCategory: dto.category.toLowerCase() },
    });
    void this.featureFlags?.recordConfiguredMetric(actorId, createdCase.id, 'repair_case_created');
    void this.analytics?.record({
      name: 'repair_case.created', sourceId: createdCase.id, actorProfileId: actorId,
      shopId, role: actorRole, journeyId: createdCase.id, properties: { entryMode: 'shop_intake' },
    });
    return createdCase;
  }

  async findAll(shopId: string, status?: CaseStatus, technicianId?: string, limit = 50, cursor?: string, search?: string) {
    const pageSize = Math.min(Math.max(Number.isFinite(limit) ? limit : 50, 1), 100);
    const term = search?.trim().slice(0, 120);
    const rows = await this.prisma.repairCase.findMany({
      where: {
        shopId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(technicianId ? { technicianId } : {}),
        ...(term ? {
          OR: [
            { caseNumber: { contains: term, mode: 'insensitive' } },
            { customerName: { contains: term, mode: 'insensitive' } },
            { customerPhone: { contains: term } },
            { problemDescription: { contains: term, mode: 'insensitive' } },
            { device: { OR: [
              { make: { contains: term, mode: 'insensitive' } },
              { model: { contains: term, mode: 'insensitive' } },
            ] } },
          ],
        } : {}),
      },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: pageSize + 1,
      include: {
        device: true,
        technician: true,
        _count: {
          select: {
            evidence: true,
            quotations: true,
            steps: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const hasMore = rows.length > pageSize;
    const cases = hasMore ? rows.slice(0, pageSize) : rows;
    return {
      items: cases.map(withoutAuthorizationToken),
      nextCursor: hasMore ? cases[cases.length - 1]?.id ?? null : null,
    };
  }

  async summary(shopId: string, technicianId?: string) {
    const where = { shopId, deletedAt: null, ...(technicianId ? { technicianId } : {}) };
    const [groups, recentRows] = await Promise.all([
      this.prisma.repairCase.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.repairCase.findMany({
        where,
        take: 6,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { device: true },
      }),
    ]);
    return {
      countsByStatus: Object.fromEntries(groups.map((group) => [group.status, group._count._all])),
      recentCases: recentRows.map(withoutAuthorizationToken),
    };
  }

  async technicianWorkspace(shopId: string, profileId: string, role: string) {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, shopId, deletedAt: null, isActive: true },
      select: { id: true, displayName: true, shop: { select: { name: true } } },
    });
    if (!profile)
      throw new NotFoundException('Technician workspace was not found for this organization');
    const cases = await this.prisma.repairCase.findMany({
      where: {
        shopId,
        deletedAt: null,
        ...(role === 'TECHNICIAN' ? { technicianId: profileId } : {}),
      },
      include: {
        device: true,
        technician: { select: { id: true, displayName: true } },
        diagnostics: { orderBy: { createdAt: 'desc' }, take: 1 },
        evidence: {
          where: { deletedAt: null, assetRole: 'ORIGINAL' },
          orderBy: { capturedAt: 'desc' },
          select: { id: true, fileName: true, purpose: true, capturedAt: true },
        },
        quotations: {
          where: { deletedAt: null },
          orderBy: { version: 'desc' },
          take: 1,
          include: { items: true, approval: true },
        },
        testResults: { orderBy: { testedAt: 'desc' } },
        warranty: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return {
      technician: {
        id: profile.id,
        displayName: profile.displayName,
        organizationName: profile.shop?.name ?? 'Repair organization',
      },
      cases: cases.map((item) => {
        const statusMap: Record<string, string> = {
          // A draft is not submitted yet, even if it already has a technician.
          // Keep it in the incoming queue so the UI offers DRAFT -> SUBMITTED
          // before it can offer diagnosis.
          DRAFT: 'incoming',
          SUBMITTED: item.technicianId ? 'assigned' : 'incoming',
          UNDER_DIAGNOSIS: 'diagnosing',
          DIAGNOSIS_COMPLETED: 'pending_approval',
          QUOTATION_PENDING: 'pending_approval',
          AWAITING_CUSTOMER_APPROVAL: 'pending_approval',
          APPROVED: 'approved',
          REJECTED: 'rejected',
          IN_REPAIR: 'in_repair',
          AWAITING_VERIFICATION: 'testing',
          COMPLETED: 'completed',
          DISPUTED: 'disputed',
          CANCELLED: 'cancelled',
        };
        const diagnostic = item.diagnostics[0];
        const finding =
          diagnostic?.findings && typeof diagnostic.findings === 'object'
            ? (diagnostic.findings as Record<string, unknown>)
            : {};
        const quotation = item.quotations[0];
        const warrantyDuration = item.warranty
          ? Math.max(
              0,
              Math.round(
                (item.warranty.endsAt.getTime() - item.warranty.startsAt.getTime()) /
                  (30 * 24 * 60 * 60 * 1000),
              ),
            )
          : 0;
        return {
          id: item.id,
          reference: item.caseNumber,
          status: statusMap[item.status] ?? 'incoming',
          priority: ['HIGH', 'URGENT'].includes(item.priority) ? 'time-sensitive' : 'standard',
          customerName: item.customerName,
          customerContact: item.customerEmail ?? undefined,
          device: {
            manufacturer: item.device.make,
            model: item.device.model,
            serialLast4: item.device.serialNumber?.slice(-4),
            registeredAt: item.device.createdAt.toISOString(),
          },
          issueSummary: item.problemDescription,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          assignedTechnician: item.technician?.displayName ?? null,
          diagnostics: diagnostic
            ? {
                symptoms: String(finding.symptoms ?? item.problemDescription),
                findings: String(finding.findings ?? finding.summary ?? ''),
                recommendedWork: String(finding.recommendedWork ?? ''),
                safetyNotes: String(finding.safetyNotes ?? ''),
              }
            : null,
          evidence: item.evidence.map((evidence) => ({
            id: evidence.id,
            name: evidence.fileName,
            kind: evidence.purpose,
            addedAt: evidence.capturedAt.toISOString(),
          })),
          quotation: quotation
            ? {
                version: quotation.version,
                status:
                  quotation.approval?.status === 'APPROVED'
                    ? 'approved'
                    : quotation.status === 'REJECTED'
                      ? 'declined'
                      : quotation.status === 'SENT'
                        ? 'sent'
                        : 'draft',
                currency: quotation.currency,
                items: quotation.items.map((line) => ({
                  description: line.description,
                  quantity: line.quantity,
                  unitPrice: Number(line.unitPrice),
                })),
                customerNote: quotation.diagnosedIssue,
              }
            : null,
          tests: item.testResults.map((test) => ({
            name: test.name,
            result: test.passed ? 'pass' : 'fail',
            note: test.notes ?? undefined,
          })),
          warranty: item.warranty
            ? {
                durationMonths: warrantyDuration,
                startsAt: item.warranty.startsAt.toISOString(),
                terms: item.warranty.terms,
              }
            : null,
        };
      }),
    };
  }

  async findOne(id: string, shopId: string, assignedTechnicianId?: string, viewerId?: string) {
    const repairCase = await this.prisma.repairCase.findFirst({
      where: {
        id,
        shopId,
        ...(assignedTechnicianId ? { technicianId: assignedTechnicianId } : {}),
        deletedAt: null,
      },
      include: {
        device: true,
        technician: true,
        evidence: {
          include: {
            annotations: true,
            capturedBy: {
              select: { displayName: true },
            },
          },
          orderBy: { capturedAt: 'desc' },
        },
        quotations: {
          include: {
            items: true,
            approval: true,
            evidence: { include: { evidence: true } },
            changeRequests: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { version: 'desc' },
        },
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        verification: {
          include: {
            verifiedBy: { select: { displayName: true } },
          },
        },
        certificate: true,
        lifecycleTransitions: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!repairCase) {
      throw new NotFoundException(`Repair case with ID ${id} not found`);
    }

    const decorated = await this.evidenceService.decorateForRead(
      repairCase,
      shopId,
      viewerId ?? assignedTechnicianId ?? null,
    );
    return withoutAuthorizationToken(decorated);
  }

  async updateStatus(
    id: string,
    shopId: string,
    actorId: string,
    actorRole: string,
    idempotencyKey: string,
    dto: UpdateCaseStatusDto,
  ) {
    const updatedCase = await this.prisma.$transaction(async (tx) => {
      const input = {
        caseId: id,
        shopId,
        actorId,
        actorRole,
        toState: dto.status,
        idempotencyKey,
        requestHash: this.lifecycle.hashRequest({
          status: dto.status,
          notes: dto.notes,
          supportingEvidenceIds: dto.supportingEvidenceIds,
        }),
        reason: dto.notes,
        evidenceIds: dto.supportingEvidenceIds,
      };
      await this.lifecycle.transition(tx, input);
      return tx.repairCase.findFirst({
        where: { id, shopId },
        include: {
          device: true,
          technician: true,
          lifecycleTransitions: { orderBy: { createdAt: 'asc' } },
        },
      });
    });
    if (dto.status === CaseStatus.AWAITING_VERIFICATION)
      void this.analytics?.record({
        name: 'repair.completion_documented', sourceId: id, actorProfileId: actorId,
        shopId, role: actorRole, journeyId: id,
      });
    if (dto.status === CaseStatus.AWAITING_VERIFICATION)
      void this.featureFlags?.recordConfiguredMetric(actorId, id, 'repair_documented');
    return updatedCase;
  }

  async assignTechnician(id: string, shopId: string, actorId: string, technicianId: string) {
    const repairCase = await this.findOne(id, shopId);
    if (
      !(
        [
          CaseStatus.DRAFT,
          CaseStatus.SUBMITTED,
          CaseStatus.UNDER_DIAGNOSIS,
          CaseStatus.DIAGNOSIS_COMPLETED,
          CaseStatus.QUOTATION_PENDING,
          CaseStatus.AWAITING_CUSTOMER_APPROVAL,
          CaseStatus.APPROVED,
          CaseStatus.REJECTED,
        ] as CaseStatus[]
      ).includes(repairCase.status as CaseStatus)
    ) {
      throw new BadRequestException('Technicians can only be reassigned before repair work begins');
    }
    const technician = await this.prisma.organizationMembership.findFirst({
      where: { profileId: technicianId, shopId, revokedAt: null, profile: { deletedAt: null } },
      select: { id: true },
    });
    if (!technician) throw new NotFoundException('Technician is not a member of this organization');
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.repairCase.updateMany({
        where: { id, shopId, deletedAt: null },
        data: { technicianId },
      });
      if (changed.count !== 1) throw new NotFoundException(`Repair case with ID ${id} not found`);
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'repair_case.technician_assigned',
          entityType: 'RepairCase',
          entityId: id,
          metadata: { technicianId },
        },
      });
      return tx.repairCase.findFirst({
        where: { id, shopId },
        include: { device: true, technician: true },
      });
    });
  }
}
