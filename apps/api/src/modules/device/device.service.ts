import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDeviceDto, UpdateDeviceDto } from './device.dto';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(shopId: string, registeredById: string, dto: CreateDeviceDto) {
    return this.prisma.device.create({
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
  }

  async findAll(shopId: string) {
    return this.prisma.device.findMany({
      where: {
        shopId,
        deletedAt: null,
      },
      include: {
        repairCases: {
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

  async findOne(id: string, shopId: string) {
    const device = await this.prisma.device.findFirst({
      where: {
        id,
        shopId,
        deletedAt: null,
      },
      include: {
        repairCases: {
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

  async update(id: string, shopId: string, dto: UpdateDeviceDto) {
    await this.findOne(id, shopId);

    return this.prisma.device.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

  async softDelete(id: string, shopId: string) {
    await this.findOne(id, shopId);

    return this.prisma.device.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
