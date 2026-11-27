import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserProfileDto } from './users.dto';
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        email: true,
        displayName: true,
        phone: true,
        role: true,
        shopId: true,
        createdAt: true,
        locale: true,
      },
    });
    if (!profile) throw new NotFoundException('User profile not found');
    return profile;
  }
  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    const current = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('User profile not found');
    return this.prisma.profile.update({
      where: { userId },
      data: {
        ...(dto.displayName ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.locale ? { locale: dto.locale } : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        phone: true,
        role: true,
        shopId: true,
        updatedAt: true,
        locale: true,
      },
    });
  }
}
