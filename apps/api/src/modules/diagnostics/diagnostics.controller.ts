import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { CompleteDiagnosisDto, CreateDiagnosticDto } from './diagnostics.dto';
import { DiagnosticsService } from './diagnostics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@repairproof/shared';

@Controller('cases/:caseId/diagnostics')
@Roles(UserRole.TECHNICIAN, UserRole.SHOP_OWNER)
export class DiagnosticsController {
  constructor(private readonly service: DiagnosticsService) {}
  @Post() create(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDiagnosticDto,
  ) {
    return this.service.create(caseId, requireShopId(user), requireProfileId(user), dto, user.role);
  }
  @Post('complete') complete(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string,
    @Body() body: CompleteDiagnosisDto,
  ) {
    return this.service.complete(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
      key,
      body.notes,
    );
  }
  @Get() list(@Param('caseId') caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findByCase(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
    );
  }
}
