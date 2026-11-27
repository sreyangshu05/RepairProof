import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class RepairProofAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      const user = this.authService.verifyAccessToken(token);

      // Fetch or sync the profile from database
      const profile = await this.prisma.profile.findUnique({
        where: { userId: user.id },
      });
      if (!profile || profile.deletedAt || !profile.isActive)
        throw new ForbiddenException('Account is not provisioned for RepairProof');
      const platformAdmin = await this.prisma.platformAdmin.findFirst({
        where: { profileId: profile.id, active: true },
        select: { id: true },
      });
      let effectiveRole = platformAdmin ? 'PLATFORM_ADMIN' : profile.role;
      if (!platformAdmin && profile.role === 'PLATFORM_ADMIN')
        throw new ForbiddenException('Platform administrator grant is inactive');
      if (!platformAdmin && profile.shopId) {
        const membership = await this.prisma.organizationMembership.findFirst({
          where: {
            shopId: profile.shopId,
            profileId: profile.id,
            revokedAt: null,
            shop: { deletedAt: null },
          },
          select: { id: true, role: true },
        });
        if (!membership) throw new ForbiddenException('Active organization membership is required');
        effectiveRole = membership.role;
      }
      if (!platformAdmin && !profile.shopId)
        throw new ForbiddenException('Active organization membership is required');

      request.user = {
        userId: user.id,
        email: user.email,
        role: effectiveRole,
        // Platform scope has no implicit shop context. Their access must go
        // through the explicit platform administration API surface.
        profile: platformAdmin ? { ...profile, shopId: null } : profile,
      };

      return true;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new UnauthorizedException('Failed to authenticate request');
    }
  }
}
