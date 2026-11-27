import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@repairproof/shared';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdministrationService } from './administration.service';
import { CreateDisputeDto, UpdateDisputeDto } from './administration.dto';
@Controller('administration')
@Roles(UserRole.SHOP_OWNER)
export class AdministrationController {
  constructor(private readonly service: AdministrationService) {}
  @Get('overview') overview(@CurrentUser() user: AuthenticatedUser) {
    return this.service.organizationOverview(requireShopId(user));
  }
  @Get('audit-events') audit(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = Number(limit ?? 50);
    return this.service.auditLog(
      requireShopId(user),
      Number.isInteger(parsed) ? Math.max(1, Math.min(parsed, 100)) : 50,
    );
  }
  @Get('disputes') disputes(@CurrentUser() user: AuthenticatedUser) {
    return this.service.disputes(requireShopId(user));
  }
  @Post('cases/:caseId/disputes') createDispute(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.service.createDispute(
      requireShopId(user),
      requireProfileId(user),
      caseId,
      key,
      dto,
    );
  }
  @Patch('disputes/:id') updateDispute(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string,
    @Body() dto: UpdateDisputeDto,
  ) {
    return this.service.updateDispute(
      requireShopId(user),
      requireProfileId(user),
      id,
      key,
      dto.status,
      dto.resolution,
    );
  }
}
