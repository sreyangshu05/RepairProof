import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { IssueCertificateDto } from './certificate.dto';
import {
  CurrentUser,
  AuthenticatedUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller()
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Post('cases/:caseId/certificate')
  async issueCertificate(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: IssueCertificateDto,
  ) {
    return this.certificateService.issueCertificate(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      dto,
    );
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('certificates/:certificateNumber')
  async verifyCertificate(@Param('certificateNumber') certificateNumber: string) {
    return this.certificateService.verifyCertificate(certificateNumber);
  }
}
