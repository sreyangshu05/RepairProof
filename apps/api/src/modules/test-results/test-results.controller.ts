import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { CreateTestResultDto } from './test-results.dto';
import { TestResultsService } from './test-results.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@repairproof/shared';
@Controller('cases/:caseId/tests')
@Roles(UserRole.TECHNICIAN, UserRole.SHOP_OWNER)
export class TestResultsController {
  constructor(private readonly service: TestResultsService) {}
  @Post() create(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTestResultDto,
  ) {
    return this.service.create(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
      dto,
    );
  }
  @Get() list(@Param('caseId') caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(caseId, requireShopId(user), requireProfileId(user), user.role);
  }
}
