import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCaseDto, UpdateCaseStatusDto } from './case.dto';
import { CASE_STATUS_TRANSITIONS, CaseStatus } from '@repairproof/shared';
import * as crypto from 'crypto';

@Injectable()
export class CaseService {
  constructor(private readonly prisma: PrismaService) {}

  private generateCaseNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `RP-${date}-${rand}`;
  }

  private generateAuthToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  async create(shopId: string, defaultTechId: string | null, dto: CreateCaseDto) {
    // Verify device exists and belongs to shop
    const device = await this.prisma.device.findFirst({
      where: { id: dto.deviceId, shopId, deletedAt: null },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${dto.deviceId} not found`);
    }

    const caseNumber = this.generateCaseNumber();
    const authorizationToken = this.generateAuthToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days validity

    return this.prisma.repairCase.create({
      data: {
        caseNumber,
        shopId,
        deviceId: dto.deviceId,
        technicianId: dto.technicianId || defaultTechId,
        status: CaseStatus.REGISTERED,
        priority: dto.priority || 'NORMAL',
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail,
        problemDescription: dto.problemDescription,
        authorizationToken,
        authorizationExpiresAt: expiresAt,
      },
      include: {
        device: true,
        technician: true,
      },
    });
  }

  async findAll(shopId: string, status?: CaseStatus, technicianId?: string) {
    return this.prisma.repairCase.findMany({
      where: {
        shopId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(technicianId ? { technicianId } : {}),
      },
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
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, shopId: string) {
    const repairCase = await this.prisma.repairCase.findFirst({
      where: {
        id,
        shopId,
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
      },
    });

    if (!repairCase) {
      throw new NotFoundException(`Repair case with ID ${id} not found`);
    }

    return repairCase;
  }

  async updateStatus(id: string, shopId: string, dto: UpdateCaseStatusDto) {
    const currentCase = await this.findOne(id, shopId);

    const allowedNextStatuses = CASE_STATUS_TRANSITIONS[currentCase.status as CaseStatus];

    if (!allowedNextStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentCase.status}' to '${dto.status}'. Allowed transitions: [${allowedNextStatuses.join(', ')}]`,
      );
    }

    const isClosed = dto.status === CaseStatus.CERTIFIED || dto.status === CaseStatus.CANCELLED;

    return this.prisma.repairCase.update({
      where: { id },
      data: {
        status: dto.status,
        closedAt: isClosed ? new Date() : undefined,
      },
      include: {
        device: true,
        technician: true,
      },
    });
  }

  async assignTechnician(id: string, shopId: string, technicianId: string) {
    await this.findOne(id, shopId);

    return this.prisma.repairCase.update({
      where: { id },
      data: { technicianId },
      include: { technician: true },
    });
  }
}
