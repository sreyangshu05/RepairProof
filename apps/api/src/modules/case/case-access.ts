import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserRole } from '@repairproof/shared';

/** Build the tenant and assignment predicate used by case-scoped staff domains. */
export function caseAccessWhere(
  caseId: string,
  shopId: string,
  profileId: string,
  role: string,
): Prisma.RepairCaseWhereInput {
  if (role !== UserRole.TECHNICIAN && role !== UserRole.SHOP_OWNER) {
    throw new ForbiddenException('Only repair shop staff can access repair cases');
  }
  return {
    id: caseId,
    shopId,
    deletedAt: null,
    ...(role === UserRole.TECHNICIAN ? { technicianId: profileId } : {}),
  };
}
