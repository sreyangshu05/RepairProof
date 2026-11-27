import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateOrganizationVerificationDto } from './platform-administration.dto';

@Injectable()
export class PlatformAdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async overview() {
    const [organizations, activeUsers, cases, openDisputes, pendingOrganizations] =
      await Promise.all([
        this.prisma.shop.count({ where: { deletedAt: null } }),
        this.prisma.profile.count({ where: { deletedAt: null, isActive: true } }),
        this.prisma.repairCase.count({ where: { deletedAt: null } }),
        this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
        this.prisma.shop.count({ where: { deletedAt: null, verificationStatus: 'PENDING' } }),
      ]);
    return { organizations, activeUsers, cases, openDisputes, pendingOrganizations };
  }

  organizations(limit = 50) {
    return this.prisma.shop.findMany({
      where: { deletedAt: null },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        verificationStatus: true,
        verifiedAt: true,
        createdAt: true,
        _count: { select: { profiles: true, repairCases: true } },
      },
    });
  }

  users(limit = 50) {
    return this.prisma.profile.findMany({
      where: { deletedAt: null },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        shop: { select: { id: true, name: true } },
        platformAdminRecord: {
          select: { active: true, grantedAt: true, revokedAt: true, reason: true },
        },
      },
    });
  }

  auditEvents(limit = 100) {
    return this.prisma.platformAdminAuditEvent.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, displayName: true, email: true } } },
    });
  }

  async updateOrganizationVerification(
    actorId: string,
    shopId: string,
    dto: UpdateOrganizationVerificationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shop.findFirst({
        where: { id: shopId, deletedAt: null },
        select: { id: true, verificationStatus: true },
      });
      if (!existing) throw new NotFoundException('Organization not found');
      const verifiedAt = dto.status === 'VERIFIED' ? new Date() : null;
      const organization = await tx.shop.update({
        where: { id: shopId },
        data: {
          verificationStatus: dto.status,
          verificationNotes: dto.notes?.trim(),
          verifiedAt,
          verifiedById: actorId,
        },
        select: {
          id: true,
          name: true,
          verificationStatus: true,
          verifiedAt: true,
          verificationNotes: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'organization.verification_changed',
          entityType: 'Shop',
          entityId: shopId,
          metadata: { from: existing.verificationStatus, to: dto.status, notes: dto.notes?.trim() },
        },
      });
      await tx.platformAdminAuditEvent.create({
        data: {
          actorProfileId: actorId,
          action: 'organization.verification_changed',
          targetType: 'Shop',
          targetId: shopId,
          metadata: { from: existing.verificationStatus, to: dto.status },
        },
      });
      return organization;
    });
  }

  async updateUserAccess(actorId: string, profileId: string, active: boolean) {
    if (actorId === profileId)
      throw new BadRequestException('Platform administrators cannot change their own access');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.profile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          shopId: true,
          isActive: true,
          deletedAt: true,
          platformAdminRecord: { select: { active: true } },
        },
      });
      if (!user || user.deletedAt) throw new NotFoundException('User not found');
      if (user.platformAdminRecord?.active)
        throw new BadRequestException(
          'Platform administrator access must be changed through the provisioned admin command',
        );
      if (user.isActive === active)
        throw new ConflictException('User access already has the requested state');
      const updated = await tx.profile.update({
        where: { id: profileId },
        data: { isActive: active },
        select: { id: true, email: true, displayName: true, isActive: true },
      });
      await tx.platformAdminAuditEvent.create({
        data: {
          actorProfileId: actorId,
          action: active ? 'user.access_enabled' : 'user.access_disabled',
          targetType: 'Profile',
          targetId: profileId,
          metadata: {},
        },
      });
      if (user.shopId)
        await tx.auditEvent.create({
          data: {
            shopId: user.shopId,
            actorId,
            action: active ? 'user.access_enabled' : 'user.access_disabled',
            entityType: 'Profile',
            entityId: profileId,
            metadata: {},
          },
        });
      return updated;
    });
  }

  disputes(limit = 100) {
    return this.prisma.dispute.findMany({
      take: limit,
      orderBy: { openedAt: 'desc' },
      include: {
        repairCase: {
          select: {
            id: true,
            caseNumber: true,
            customerName: true,
            shop: { select: { id: true, name: true } },
            device: { select: { make: true, model: true } },
          },
        },
        openedBy: { select: { id: true, displayName: true } },
      },
    });
  }

  async updateDispute(
    actorId: string,
    disputeId: string,
    status: 'REVIEWING' | 'RESOLVED' | 'REJECTED',
    resolution?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({
        where: { id: disputeId },
        select: { id: true, status: true, caseId: true, repairCase: { select: { shopId: true } } },
      });
      if (!dispute) throw new NotFoundException('Dispute not found');
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
      const updated = await tx.dispute.updateMany({
        where: { id: disputeId, status: dispute.status },
        data: {
          status,
          resolution: resolution?.trim(),
          resolvedAt: status === 'RESOLVED' || status === 'REJECTED' ? new Date() : undefined,
        },
      });
      if (!updated.count)
        throw new ConflictException('Dispute changed concurrently; reload and retry');
      await tx.platformAdminAuditEvent.create({
        data: {
          actorProfileId: actorId,
          action: 'dispute.status_changed',
          targetType: 'Dispute',
          targetId: disputeId,
          metadata: { from: dispute.status, to: status },
        },
      });
      await tx.auditEvent.create({
        data: {
          shopId: dispute.repairCase.shopId,
          actorId,
          action: 'dispute.status_changed',
          entityType: 'Dispute',
          entityId: disputeId,
          metadata: { from: dispute.status, to: status },
        },
      });
      await this.notifications.notifyCaseEvent(tx, {
        caseId: dispute.caseId,
        category: 'DISPUTES',
        type: 'DISPUTE_UPDATED',
        title: 'Dispute status updated',
        body: 'There is an update to a repair case dispute.',
        deduplicationScope: `dispute:${disputeId}:${status}`,
        audience: 'BOTH',
      });
      return tx.dispute.findUnique({ where: { id: disputeId } });
    });
  }
}
