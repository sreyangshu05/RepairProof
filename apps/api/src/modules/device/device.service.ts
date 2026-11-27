import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDeviceDto, UpdateDeviceDto } from './device.dto';
import { UserRole } from '@repairproof/shared';
import { AnalyticsService } from '../analytics/analytics.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly featureFlags?: FeatureFlagsService,
  ) {}

  async create(shopId: string, registeredById: string, dto: CreateDeviceDto, actorRole = 'SHOP_OWNER') {
    const device = await this.prisma.$transaction(async (tx) => {
      const device = await tx.device.create({
        data: {
          shopId,
          registeredById,
          category: dto.category,
          make: dto.make,
          model: dto.model,
          serialNumber: dto.serialNumber,
          imei: dto.imei,
          color: dto.color,
          storageCapacity: dto.storageCapacity,
          intakePhotos: dto.intakePhotos || [],
          intakeCondition: dto.intakeCondition,
        },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId: registeredById,
          action: 'device.registered',
          entityType: 'Device',
          entityId: device.id,
          metadata: { make: device.make, model: device.model, category: device.category },
        },
      });
      return device;
    });
    void this.analytics?.record({
      name: 'device.registration_completed',
      sourceId: device.id,
      actorProfileId: registeredById,
      shopId,
      role: actorRole,
      properties: { deviceCategory: device.category.toLowerCase() },
    });
    void this.featureFlags?.recordConfiguredMetric(registeredById, device.id, 'device_registered');
    return device;
  }

  private visibleToTechnician(profileId: string) {
    return {
      OR: [
        { registeredById: profileId },
        { repairCases: { some: { technicianId: profileId, deletedAt: null } } },
      ],
    };
  }

  private accessWhere(shopId: string, profileId: string, role: string) {
    return {
      shopId,
      deletedAt: null,
      ...(role === UserRole.TECHNICIAN ? this.visibleToTechnician(profileId) : {}),
    };
  }

  async findAll(shopId: string, profileId: string, role: string) {
    return this.prisma.device.findMany({
      where: this.accessWhere(shopId, profileId, role),
      include: {
        repairCases: {
          where:
            role === UserRole.TECHNICIAN ? { technicianId: profileId, deletedAt: null } : undefined,
          select: {
            id: true,
            caseNumber: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, shopId: string, profileId: string, role: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, ...this.accessWhere(shopId, profileId, role) },
      include: {
        repairCases: {
          where:
            role === UserRole.TECHNICIAN ? { technicianId: profileId, deletedAt: null } : undefined,
          orderBy: { createdAt: 'desc' },
          include: {
            technician: true,
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    return device;
  }

  async update(id: string, shopId: string, profileId: string, role: string, dto: UpdateDeviceDto) {
    const update = await this.prisma.device.updateMany({
      where: { id, ...this.accessWhere(shopId, profileId, role) },
      data: { ...dto },
    });
    if (!update.count) throw new NotFoundException(`Device with ID ${id} not found`);
    return this.findOne(id, shopId, profileId, role);
  }

  async softDelete(id: string, shopId: string, profileId: string, role: string) {
    const update = await this.prisma.device.updateMany({
      where: { id, ...this.accessWhere(shopId, profileId, role) },
      data: { deletedAt: new Date() },
    });
    if (!update.count) throw new NotFoundException(`Device with ID ${id} not found`);
    return { id, deleted: true };
  }
}
