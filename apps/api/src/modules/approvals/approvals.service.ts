import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}
  pending(shopId: string) {
    return this.prisma.approval.findMany({
      where: { status: 'PENDING', quotation: { repairCase: { shopId, deletedAt: null } } },
      include: {
        quotation: {
          include: {
            items: true,
            repairCase: {
              select: {
                id: true,
                caseNumber: true,
                customerName: true,
                device: { select: { make: true, model: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
