import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { CreateEvidenceDto, AddAnnotationDto } from './evidence.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('cases/:caseId/evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post()
  async create(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEvidenceDto,
  ) {
    const authorProfileId = user.profile?.id || 'dev-profile-id';
    return this.evidenceService.create(caseId, authorProfileId, dto);
  }

  @Get()
  async findByCase(@Param('caseId') caseId: string) {
    return this.evidenceService.findByCase(caseId);
  }

  @Post(':evidenceId/annotate')
  async addAnnotation(
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddAnnotationDto,
  ) {
    const authorName = user.profile?.displayName || 'Technician';
    return this.evidenceService.addAnnotation(evidenceId, authorName, dto);
  }
}
