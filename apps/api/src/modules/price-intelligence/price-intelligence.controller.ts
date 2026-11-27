import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@repairproof/shared';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreatePriceTransactionDto,
  PriceBenchmarkQueryDto,
  ReviewPriceObservationDto,
  UpsertRepairPriceIndexDto,
} from './price-intelligence.dto';
import { PriceIntelligenceService } from './price-intelligence.service';
import { EvidenceService } from '../evidence/evidence.service';

@Controller()
@ApiTags('price intelligence')
export class PriceIntelligenceController {
  constructor(
    private readonly service: PriceIntelligenceService,
    private readonly evidenceService: EvidenceService,
  ) {}

  @Get('price-intelligence/benchmark')
  @ApiOperation({
    summary: 'Get an anonymized repair price comparison',
    description:
      'Uses only accepted invoice-backed reports. Returns no range below minimum sample and independent-business thresholds. Above-range amounts are not fraud findings.',
  })
  benchmark(@Query() query: PriceBenchmarkQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.benchmark(query, user.profile?.shopId ?? undefined);
  }

  @Post('cases/:caseId/price-transactions')
  @Roles(UserRole.SHOP_OWNER)
  @ApiOperation({
    summary: 'Submit a completed repair invoice report for review',
    description:
      'The report remains ineligible for benchmarks until a platform reviewer compares it with the clean original invoice. Submission is not independent verification.',
  })
  record(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string,
    @Body() dto: CreatePriceTransactionDto,
  ) {
    return this.service.recordReportedTransaction(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      key,
      dto,
    );
  }

  @Patch('platform/admin/price-transactions/:id/review')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({
    summary: 'Accept or reject a pending price observation',
    description:
      'Acceptance permits anonymized statistical use; it does not certify the repair or invoice as true.',
  })
  review(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewPriceObservationDto,
  ) {
    return this.service.reviewReportedTransaction(id, requireProfileId(user), dto);
  }

  @Get('platform/admin/price-transactions/pending')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'List reported price observations awaiting review' })
  pending(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.service.pendingReviews(limit);
  }

  @Get('platform/admin/price-transactions/:id/invoice')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Issue a short-lived audited invoice review URL' })
  async invoice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const evidenceId = await this.service.pendingInvoiceEvidenceId(id);
    return this.evidenceService.createPriceObservationReviewDownloadUrl(
      evidenceId,
      requireProfileId(user),
    );
  }

  @Post('platform/admin/price-index')
  @Roles(UserRole.PLATFORM_ADMIN)
  @ApiOperation({
    summary: 'Upsert a sourced monthly regional price index for inflation adjustment',
  })
  upsertIndex(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertRepairPriceIndexDto) {
    return this.service.upsertIndex(requireProfileId(user), dto);
  }
}
