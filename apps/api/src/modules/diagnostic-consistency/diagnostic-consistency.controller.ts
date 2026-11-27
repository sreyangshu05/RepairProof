import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@repairproof/shared';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DiagnosticConsistencyService } from './diagnostic-consistency.service';

@Controller('cases/:caseId/diagnostic-consistency')
@Roles(UserRole.TECHNICIAN, UserRole.SHOP_OWNER)
@ApiTags('diagnostic consistency')
export class DiagnosticConsistencyController {
  constructor(private readonly service: DiagnosticConsistencyService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a diagnostic consistency assessment snapshot',
    description:
      'Compares recorded symptoms, findings, measurements, proposed work, replacements, and post-repair tests. Results are advisory and never determine honesty or a definitive diagnosis.',
  })
  assess(@Param('caseId') caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.assessCase(caseId, requireShopId(user), requireProfileId(user));
  }

  @Get('history')
  @ApiOperation({
    summary: 'List prior diagnostic consistency assessment snapshots for this shop case',
  })
  history(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 20;
    return this.service.listAssessmentHistory(
      caseId,
      requireShopId(user),
      Number.isFinite(parsed) ? parsed : 20,
    );
  }
}
