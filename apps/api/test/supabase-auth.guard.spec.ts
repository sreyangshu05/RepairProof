import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RepairProofAuthGuard } from '../src/common/guards/supabase-auth.guard';

describe('RepairProofAuthGuard security boundary', () => {
  const context = (authorization?: string, request: any = {}) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization }, ...request }) }),
    }) as unknown as ExecutionContext;

  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };

  it('rejects missing and malformed bearer credentials', async () => {
    const auth = { verifyAccessToken: jest.fn() };
    const guard = new RepairProofAuthGuard(reflector as any, auth as any, {} as any);
    await expect(guard.canActivate(context())).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context('Basic abc'))).rejects.toThrow(UnauthorizedException);
    expect(auth.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects inactive identities and identities without an active organization membership', async () => {
    const auth = { verifyAccessToken: jest.fn().mockReturnValue({ id: 'auth-user', email: 'tech@example.test' }) };
    const prisma: any = {
      profile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'profile-1',
          userId: 'auth-user',
          shopId: 'shop-1',
          role: 'TECHNICIAN',
          isActive: true,
        }),
      },
      platformAdmin: { findFirst: jest.fn().mockResolvedValue(null) },
      organizationMembership: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const guard = new RepairProofAuthGuard(reflector as any, auth as any, prisma);
    await expect(guard.canActivate(context('Bearer valid-token'))).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.organizationMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          shopId: 'shop-1',
          profileId: 'profile-1',
          revokedAt: null,
          shop: { deletedAt: null },
        },
      }),
    );
  });

  it('rejects an inactive platform-admin grant even when the profile role claims platform access', async () => {
    const auth = { verifyAccessToken: jest.fn().mockReturnValue({ id: 'auth-user', email: 'admin@example.test' }) };
    const prisma: any = {
      profile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'profile-1',
          userId: 'auth-user',
          shopId: null,
          role: 'PLATFORM_ADMIN',
          isActive: true,
        }),
      },
      platformAdmin: { findFirst: jest.fn().mockResolvedValue(null) },
      organizationMembership: { findFirst: jest.fn() },
    };
    const guard = new RepairProofAuthGuard(reflector as any, auth as any, prisma);
    await expect(guard.canActivate(context('Bearer valid-token'))).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.organizationMembership.findFirst).not.toHaveBeenCalled();
  });
});
