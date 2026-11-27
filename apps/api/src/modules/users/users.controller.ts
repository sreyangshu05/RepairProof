import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UpdateUserProfileDto } from './users.dto';
import { UsersService } from './users.service';
@Controller('users/me')
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Get() get(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getProfile(user.userId);
  }
  @Patch() update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserProfileDto) {
    return this.service.updateProfile(user.userId, dto);
  }
}
