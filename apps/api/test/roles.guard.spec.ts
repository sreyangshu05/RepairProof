import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { UserRole } from '@repairproof/shared';

describe('RolesGuard role matrix', () => {
  const roles: string[] = [
    'CONSUMER',
    UserRole.TECHNICIAN,
    UserRole.SHOP_OWNER,
    UserRole.PLATFORM_ADMIN,
  ];
  const contextFor = (role?: string) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => (role ? { user: { role } } : { user: undefined }) }),
    }) as unknown as ExecutionContext;

  it.each(roles)('allows only shop owners on shop-owner-only assignment actions (%s)', (role) => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([UserRole.SHOP_OWNER]) };
    const guard = new RolesGuard(reflector as any);
    if (role === UserRole.SHOP_OWNER) expect(guard.canActivate(contextFor(role))).toBe(true);
    else expect(() => guard.canActivate(contextFor(role))).toThrow(ForbiddenException);
  });

  it('denies requests with no authenticated role', () => {
    const guard = new RolesGuard({ getAllAndOverride: () => [UserRole.SHOP_OWNER] } as any);
    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });
});
