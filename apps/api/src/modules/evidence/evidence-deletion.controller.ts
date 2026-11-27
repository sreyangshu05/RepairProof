import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '@repairproof/shared';
import { EvidenceService } from './evidence.service';
import { EvidenceDeletionReviewDto } from './evidence.dto';

@Controller('evidence-deletion-requests')
export class EvidenceDeletionController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get()
  @Roles(UserRole.SHOP_OWNER)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.evidence.listDeletionRequests(requireShopId(user), requireProfileId(user));
  }

  @Patch(':requestId')
  @Roles(UserRole.SHOP_OWNER)
  review(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EvidenceDeletionReviewDto,
  ) {
    return this.evidence.reviewDeletion(
      requestId,
      requireShopId(user),
      requireProfileId(user),
      dto.status,
      dto.reviewNotes,
    );
  }
}
