import { Controller, Get } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { ApprovalsService } from './approvals.service';
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}
  @Get('pending') pending(@CurrentUser() user: AuthenticatedUser) {
    return this.service.pending(requireShopId(user));
  }
}
