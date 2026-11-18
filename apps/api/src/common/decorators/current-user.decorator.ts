import { createParamDecorator, ExecutionContext } from '@nestjs/common';
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
