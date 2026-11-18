import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuotationDto } from './quotation.dto';
import { CaseStatus, QuotationStatus } from '@repairproof/shared';

@Injectable()
export class QuotationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(caseId: string, dto: CreateQuotationDto) {
    const repairCase = await this.prisma.repairCase.findUnique({
      where: { id: caseId },
      include: { quotations: { orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!repairCase) {
      throw new NotFoundException(`Repair case with ID ${caseId} not found`);
    }

    // Determine version number
    const nextVersion = (repairCase.quotations[0]?.version || 0) + 1;

    // Mark previous active quotes as SUPERSEDED
    if (repairCase.quotations.length > 0) {
      await this.prisma.quotation.updateMany({
        where: { caseId, status: { in: [QuotationStatus.DRAFT, QuotationStatus.SENT] } },
        data: { status: QuotationStatus.SUPERSEDED },
      });
    }

    // Calculate parts cost and totals
    let partsCost = 0;
    const itemsData = dto.items.map((item) => {
      const totalPrice = Number((item.quantity * item.unitPrice).toFixed(2));
      if (item.type === 'PART') {
        partsCost += totalPrice;
      }
      return {
        type: item.type,
        description: item.description,
        partName: item.partName,
        partSource: item.partSource,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
      };
    });

    const laborCost = Number(dto.laborCost.toFixed(2));
    const subtotal = partsCost + laborCost;
    const taxRate = dto.taxRate ?? 0;
    const taxAmount = Number((subtotal * taxRate).toFixed(2));
    const totalCost = Number((subtotal + taxAmount).toFixed(2));

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (dto.validDays || 7));

    // Create quote with items
    const quotation = await this.prisma.quotation.create({
      data: {
        caseId,
        version: nextVersion,
        status: QuotationStatus.DRAFT,
        laborCost,
        partsCost,
        taxAmount,
        totalCost,
        currency: dto.currency || 'USD',
        validUntil,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: true,
      },
    });

    // Update case status to QUOTED if still in earlier phase
    if (repairCase.status === CaseStatus.REGISTERED || repairCase.status === CaseStatus.DIAGNOSING) {
      await this.prisma.repairCase.update({
        where: { id: caseId },
        data: { status: CaseStatus.QUOTED },
      });
    }

    return quotation;
  }

  async sendToCustomer(caseId: string, quoteId: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quoteId, caseId },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    await this.prisma.quotation.update({
      where: { id: quoteId },
      data: { status: QuotationStatus.SENT },
    });

    // Transition case to AWAITING_APPROVAL
    await this.prisma.repairCase.update({
      where: { id: caseId },
      data: { status: CaseStatus.AWAITING_APPROVAL },
    });

    return { success: true, message: 'Quotation sent to customer for authorization' };
  }

  async findByCase(caseId: string) {
    return this.prisma.quotation.findMany({
      where: { caseId, deletedAt: null },
      include: { items: true },
      orderBy: { version: 'desc' },
    });
  }
}
