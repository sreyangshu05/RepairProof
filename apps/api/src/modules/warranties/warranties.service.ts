import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWarrantyClaimDto, CreateWarrantyDto } from './warranties.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
@Injectable()
export class WarrantiesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly featureFlags?: FeatureFlagsService,
  ) {}
  async list(shopId: string) {
    await this.prisma.warranty.updateMany({
      where: {
        status: 'ACTIVE',
        endsAt: { lte: new Date() },
        repairCase: { shopId, deletedAt: null },
      },
      data: { status: 'EXPIRED' },
    });
    return this.prisma.warranty.findMany({
      where: { repairCase: { shopId, deletedAt: null } },
      include: {
        repairCase: {
          select: { id: true, caseNumber: true, device: { select: { make: true, model: true } } },
        },
        claims: { orderBy: { openedAt: 'desc' } },
      },
      orderBy: { endsAt: 'asc' },
    });
  }
  async createForCase(caseId: string, shopId: string, actorId: string, dto: CreateWarrantyDto) {
    return this.prisma.$transaction(async (tx) => {
      const repairCase = await tx.repairCase.findFirst({
        where: { id: caseId, shopId, deletedAt: null, status: 'COMPLETED' },
        select: {
          id: true,
          verification: { select: { passed: true, verifiedById: true } },
        },
      });
      if (!repairCase) throw new NotFoundException('Completed repair case not found');
      if (!repairCase.verification?.passed || repairCase.verification.verifiedById === actorId) {
        throw new BadRequestException('A passing independent verification is required first');
      }
      const existing = await tx.warranty.findUnique({ where: { caseId }, select: { id: true } });
      if (existing)
        throw new BadRequestException('Warranty terms already exist and cannot be overwritten');
      const startsAt = new Date(dto.startsAt);
      if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() > Date.now() + 5 * 60_000)
        throw new BadRequestException('Warranty start date must be valid and not in the future');
      const endsAt = new Date(startsAt);
      endsAt.setUTCMonth(endsAt.getUTCMonth() + dto.durationMonths);
      const warranty = await tx.warranty.create({
        data: { caseId, startsAt, endsAt, terms: dto.terms.trim(), status: 'ACTIVE' },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'warranty.created',
          entityType: 'Warranty',
          entityId: warranty.id,
          metadata: { caseId, durationMonths: dto.durationMonths, startsAt, endsAt },
        },
      });
      return warranty;
    });
  }
  async createClaim(
    warrantyId: string,
    shopId: string,
    actorId: string,
    dto: CreateWarrantyClaimDto,
    actorRole = 'SHOP_OWNER',
  ) {
    const claim = await this.prisma.$transaction(async (tx) => {
      const warranty = await tx.warranty.findFirst({
        where: { id: warrantyId, repairCase: { shopId, deletedAt: null } },
        select: { id: true, caseId: true, status: true, endsAt: true, startsAt: true },
      });
      if (!warranty) throw new NotFoundException('Warranty not found');
      if (
        warranty.status !== 'ACTIVE' ||
        warranty.endsAt <= new Date() ||
        warranty.startsAt > new Date()
      )
        throw new BadRequestException('Warranty is not active');
      const claim = await tx.warrantyClaim.create({
        data: { warrantyId, description: dto.description.trim() },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'warranty.claim_opened',
          entityType: 'WarrantyClaim',
          entityId: claim.id,
          metadata: { warrantyId },
        },
      });
      await this.notifications?.notifyCaseEvent(tx, {
        caseId: warranty.caseId,
        category: 'WARRANTIES',
        type: 'WARRANTY_CLAIM_UPDATED',
        title: 'Warranty claim received',
        body: 'A warranty claim update is ready to view.',
        deduplicationScope: `warranty-claim:${claim.id}:OPEN`,
        audience: 'CUSTOMER',
      });
      return claim;
    });
    void this.analytics?.record({
      name: 'warranty.claim_submitted', sourceId: claim.id, actorProfileId: actorId,
      shopId, role: actorRole,
    });
    void this.featureFlags?.recordConfiguredMetric(actorId, claim.id, 'warranty_claim_submitted');
    return claim;
  }
  async updateClaim(
    claimId: string,
    shopId: string,
    actorId: string,
    status: 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'RESOLVED',
    resolution?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.warrantyClaim.findFirst({
        where: { id: claimId, warranty: { repairCase: { shopId, deletedAt: null } } },
        include: { warranty: { select: { caseId: true } } },
      });
      if (!claim) throw new NotFoundException('Warranty claim not found');
      const allowed: Record<string, string[]> = {
        OPEN: ['REVIEWING', 'REJECTED'],
        REVIEWING: ['APPROVED', 'REJECTED'],
        APPROVED: ['RESOLVED'],
        REJECTED: [],
        RESOLVED: [],
      };
      if (!allowed[claim.status]?.includes(status))
        throw new BadRequestException(
          `Invalid warranty claim transition from ${claim.status} to ${status}`,
        );
      const updated = await tx.warrantyClaim.updateMany({
        where: { id: claimId, status: claim.status },
        data: {
          status,
          resolution: resolution?.trim(),
          closedAt: status === 'RESOLVED' || status === 'REJECTED' ? new Date() : undefined,
        },
      });
      if (!updated.count)
        throw new BadRequestException('Warranty claim changed concurrently; reload and retry');
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'warranty.claim_status_changed',
          entityType: 'WarrantyClaim',
          entityId: claimId,
          metadata: { from: claim.status, to: status },
        },
      });
      await this.notifications?.notifyCaseEvent(tx, {
        caseId: claim.warranty.caseId,
        category: 'WARRANTIES',
        type: 'WARRANTY_CLAIM_UPDATED',
        title: 'Warranty claim updated',
        body: 'A warranty claim update is ready to view.',
        deduplicationScope: `warranty-claim:${claimId}:${status}`,
        audience: 'BOTH',
      });
      return tx.warrantyClaim.findUnique({ where: { id: claimId } });
    });
  }
}
