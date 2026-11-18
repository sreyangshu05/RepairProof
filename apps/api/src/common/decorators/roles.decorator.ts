import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@repairproof/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
