import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { ComponentsService } from './components.service';
import { CreateComponentDto, ReplaceComponentDto } from './components.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@repairproof/shared';
@Controller()
@Roles(UserRole.TECHNICIAN, UserRole.SHOP_OWNER)
export class ComponentsController {
  constructor(private readonly service: ComponentsService) {}
  @Get('components') list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(requireShopId(user));
  }
  @Post('components') create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateComponentDto,
  ) {
    return this.service.create(requireShopId(user), requireProfileId(user), dto);
  }
  @Post('cases/:caseId/components/replace') replace(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReplaceComponentDto,
  ) {
    return this.service.replace(caseId, requireShopId(user), requireProfileId(user), user.role, dto);
  }
  @Get('cases/:caseId/components/replacements') replacements(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.replacements(caseId, requireShopId(user), requireProfileId(user), user.role);
  }
}
