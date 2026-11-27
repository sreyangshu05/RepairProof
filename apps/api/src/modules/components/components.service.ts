import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateComponentDto, ReplaceComponentDto } from './components.dto';
import { caseAccessWhere } from '../case/case-access';
@Injectable()
export class ComponentsService {
  constructor(private readonly prisma: PrismaService) {}
  create(shopId: string, actorId: string, dto: CreateComponentDto) {
    return this.prisma.$transaction(async (tx) => {
      const component = await tx.component.create({
        data: {
          shopId,
          name: dto.name.trim(),
          sku: dto.sku?.trim() || null,
          manufacturer: dto.manufacturer?.trim(),
          source: dto.source,
          quantityOnHand: dto.quantityOnHand,
          reorderThreshold: dto.reorderThreshold,
          unitCost: dto.unitCost,
        },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'component.created',
          entityType: 'Component',
          entityId: component.id,
          metadata: { sku: component.sku },
        },
      });
      return component;
    });
  }
  list(shopId: string) {
    return this.prisma.component.findMany({
      where: { shopId, deletedAt: null },
      orderBy: [{ quantityOnHand: 'asc' }, { name: 'asc' }],
    });
  }
  async replace(caseId: string, shopId: string, authorId: string, actorRole: string, dto: ReplaceComponentDto) {
    return this.prisma.$transaction(async (tx) => {
      const repairCase = await tx.repairCase.findFirst({
        where: caseAccessWhere(caseId, shopId, authorId, actorRole),
        select: { id: true, status: true },
      });
      if (!repairCase) throw new NotFoundException('Repair case not found');
      if (repairCase.status !== 'IN_REPAIR')
        throw new BadRequestException(
          'Components can only be recorded while the repair is in progress',
        );
      const component = await tx.component.findFirst({
        where: { id: dto.componentId, shopId, deletedAt: null },
      });
      if (!component) throw new NotFoundException('Component not found in this organization');
      const changed = await tx.component.updateMany({
        where: { id: component.id, shopId, deletedAt: null, quantityOnHand: { gte: dto.quantity } },
        data: { quantityOnHand: { decrement: dto.quantity } },
      });
      if (changed.count !== 1) throw new BadRequestException('Insufficient component stock');
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
            'Component records may reference only clean, managed original evidence attached to this case',
          );
      }
      const replacement = await tx.componentReplacement.create({
        data: {
          caseId,
          componentId: component.id,
          authorId,
          nameSnapshot: component.name,
          quantity: dto.quantity,
          unitCost: component.unitCost,
          source: component.source,
          evidenceIds,
        },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId: authorId,
          action: 'component.replaced',
          entityType: 'ComponentReplacement',
          entityId: replacement.id,
          metadata: { caseId, componentId: component.id, quantity: dto.quantity },
        },
      });
      return replacement;
    });
  }
  async replacements(caseId: string, shopId: string, actorId: string, actorRole: string) {
    const exists = await this.prisma.repairCase.findFirst({
      where: caseAccessWhere(caseId, shopId, actorId, actorRole),
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Repair case not found');
    return this.prisma.componentReplacement.findMany({
      where: { caseId },
      orderBy: { replacedAt: 'desc' },
    });
  }
}
