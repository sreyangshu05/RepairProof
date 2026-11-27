import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Profile } from '@repairproof/shared';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  profile?: Profile;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    return data ? user?.[data] : user;
  },
);

export function requireShopId(user: AuthenticatedUser): string {
  if (!user.profile?.shopId || user.profile.deletedAt) {
    throw new ForbiddenException('An active organization membership is required');
  }
  return user.profile.shopId;
}

export function requireProfileId(user: AuthenticatedUser): string {
  if (!user.profile?.id || user.profile.deletedAt) {
    throw new ForbiddenException('An active user profile is required');
  }
  return user.profile.id;
}
