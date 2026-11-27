import { Controller, Get, Post, Body, Param, Headers } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { SubmitVerificationDto } from './verification.dto';
import {
  CurrentUser,
  AuthenticatedUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';

@Controller('cases/:caseId/verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  async getVerification(@Param('caseId') caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.verificationService.getVerification(caseId, requireShopId(user));
  }

  @Post()
  async submitVerification(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitVerificationDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.verificationService.submitVerification(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
      idempotencyKey,
      dto,
    );
  }
}
