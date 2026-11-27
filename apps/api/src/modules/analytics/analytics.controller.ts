import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UserRole } from '@repairproof/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { UpdateAnalyticsConsentDto } from './analytics.dto';
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('consent')
  consent(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getConsent(requireProfileId(user));
  }

  @Patch('consent')
  updateConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAnalyticsConsentDto,
  ) {
    return this.service.setConsent(requireProfileId(user), dto.enabled, dto.noticeVersion);
  }

  @Get('summary') summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.summary(requireShopId(user));
  }

  @Get('product-summary')
  @Roles(UserRole.PLATFORM_ADMIN)
  productSummary() {
    return this.service.productSummary();
  }
}
