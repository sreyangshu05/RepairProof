import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { SubmitVerificationDto } from './verification.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('cases/:caseId/verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  async getVerification(@Param('caseId') caseId: string) {
    return this.verificationService.getVerification(caseId);
  }

  @Post()
  async submitVerification(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitVerificationDto,
  ) {
    const verifiedById = user.profile?.id || 'dev-tech-id';
    return this.verificationService.submitVerification(caseId, verifiedById, dto);
  }
}
