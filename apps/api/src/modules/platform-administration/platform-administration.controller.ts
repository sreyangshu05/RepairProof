import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { UserRole } from '@repairproof/shared';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateDisputeDto } from '../administration/administration.dto';
import {
  UpdateOrganizationVerificationDto,
  UpdatePlatformUserAccessDto,
} from './platform-administration.dto';
import { PlatformAdministrationService } from './platform-administration.service';

@Controller('platform/admin')
@Roles(UserRole.PLATFORM_ADMIN)
export class PlatformAdministrationController {
  constructor(private readonly service: PlatformAdministrationService) {}
  @Get('overview') overview() {
    return this.service.overview();
  }
  @Get('organizations') organizations(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.organizations(Math.max(1, Math.min(limit ?? 50, 100)));
  }
  @Patch('organizations/:id/verification') verifyOrganization(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationVerificationDto,
  ) {
    return this.service.updateOrganizationVerification(requireProfileId(user), id, dto);
  }
  @Get('users') users(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.service.users(Math.max(1, Math.min(limit ?? 50, 100)));
  }
  @Patch('users/:id/access') updateUserAccess(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePlatformUserAccessDto,
  ) {
    return this.service.updateUserAccess(requireProfileId(user), id, dto.active);
  }
  @Get('audit-events') auditEvents(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.auditEvents(Math.max(1, Math.min(limit ?? 100, 200)));
  }
  @Get('disputes') disputes(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.service.disputes(Math.max(1, Math.min(limit ?? 100, 200)));
  }
  @Patch('disputes/:id') updateDispute(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDisputeDto,
  ) {
    return this.service.updateDispute(requireProfileId(user), id, dto.status, dto.resolution);
  }
}
