import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { IssueCertificateDto } from './certificate.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller()
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Post('cases/:caseId/certificate')
  async issueCertificate(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: IssueCertificateDto,
  ) {
    const issuedById = user.profile?.id || 'dev-tech-id';
    return this.certificateService.issueCertificate(caseId, issuedById, dto);
  }

  @Public()
  @Get('certificates/:certificateNumber')
  async verifyCertificate(@Param('certificateNumber') certificateNumber: string) {
    return this.certificateService.verifyCertificate(certificateNumber);
  }
}
