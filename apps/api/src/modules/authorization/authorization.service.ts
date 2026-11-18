import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerAuthorizationResponseDto } from './authorization.dto';
import { CaseStatus, QuotationStatus } from '@repairproof/shared';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getCaseByToken(token: string) {
    const repairCase = await this.prisma.repairCase.findUnique({
      where: { authorizationToken: token },
      include: {
        shop: {
          select: {
            name: true,
            phone: true,
            email: true,
            logoUrl: true,
            address: true,
          },
        },
        device: true,
        evidence: {
          where: { deletedAt: null },
          include: { annotations: true },
          orderBy: { capturedAt: 'desc' },
        },
        quotations: {
          where: { status: { in: [QuotationStatus.SENT, QuotationStatus.APPROVED, QuotationStatus.REJECTED] } },
          include: { items: true },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!repairCase) {
      throw new NotFoundException('Invalid or expired authorization link');
    }

    if (new Date() > new Date(repairCase.authorizationExpiresAt)) {
      throw new BadRequestException('This authorization link has expired');
    }

    return repairCase;
  }

  async respondToQuotation(token: string, dto: CustomerAuthorizationResponseDto) {
    const repairCase = await this.getCaseByToken(token);

    const latestQuote = repairCase.quotations[0];
    if (!latestQuote) {
      throw new BadRequestException('No active quotation found for this repair case');
    }

    const newQuoteStatus = dto.approved ? QuotationStatus.APPROVED : QuotationStatus.REJECTED;
    const newCaseStatus = dto.approved ? CaseStatus.APPROVED : CaseStatus.REJECTED;

    const [updatedQuote, updatedCase] = await this.prisma.$transaction([
      this.prisma.quotation.update({
        where: { id: latestQuote.id },
        data: {
          status: newQuoteStatus,
          customerResponseNote: dto.notes
            ? `${dto.notes} (Signed: ${dto.customerSignatureName})`
            : `Signed: ${dto.customerSignatureName}`,
          respondedAt: new Date(),
        },
        include: { items: true },
      }),
      this.prisma.repairCase.update({
        where: { id: repairCase.id },
        data: {
          status: newCaseStatus,
        },
      }),
    ]);

    return {
      success: true,
      approved: dto.approved,
      status: updatedCase.status,
      quotation: updatedQuote,
    };
  }
}
