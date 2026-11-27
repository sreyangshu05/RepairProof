import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}
  async current(shopId: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { id: shopId, deletedAt: null },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        createdAt: true,
      },
    });
    if (!shop) throw new NotFoundException('Organization not found');
    return shop;
  }
  async members(shopId: string) {
    return this.prisma.profile.findMany({
      where: { shopId, deletedAt: null },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
