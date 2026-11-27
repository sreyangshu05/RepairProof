import { Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { CreateRepairStepDto, UpdateRepairStepDto } from './tracking.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@repairproof/shared';
import {
  CurrentUser,
  AuthenticatedUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';

@Controller('cases/:caseId/steps')
@Roles(UserRole.TECHNICIAN, UserRole.SHOP_OWNER)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post()
  async addStep(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRepairStepDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.trackingService.addStep(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
      idempotencyKey,
      dto,
    );
  }

  @Get()
  async findByCase(@Param('caseId') caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.trackingService.findByCase(caseId, requireShopId(user), requireProfileId(user), user.role);
  }

  @Patch(':stepId')
  async updateStep(
    @Param('caseId') caseId: string,
    @Param('stepId') stepId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRepairStepDto,
  ) {
    return this.trackingService.updateStep(
      caseId,
      stepId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
      dto,
    );
  }
}
