import { Controller, Get } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { OrganizationsService } from './organizations.service';
@Controller('organizations/current')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}
  @Get() get(@CurrentUser() user: AuthenticatedUser) {
    return this.service.current(requireShopId(user));
  }
  @Get('members') members(@CurrentUser() user: AuthenticatedUser) {
    return this.service.members(requireShopId(user));
  }
}
