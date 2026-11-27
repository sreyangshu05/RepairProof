import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import {
  AddAnnotationDto,
  CreateEvidenceUploadDto,
  EvidenceDeletionRequestDto,
} from './evidence.dto';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@repairproof/shared';

@Controller('cases/:caseId/evidence')
@Roles(UserRole.TECHNICIAN, UserRole.SHOP_OWNER)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post('upload-intents')
  async createUploadIntent(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateEvidenceUploadDto,
  ) {
    return this.evidenceService.createUploadIntent(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
      idempotencyKey,
      dto,
    );
  }

  @Post('upload-intents/:uploadId/complete')
  async completeUpload(
    @Param('caseId') caseId: string,
    @Param('uploadId') uploadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evidenceService.completeUpload(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      uploadId,
    );
  }

  @Get()
  async findByCase(@Param('caseId') caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.evidenceService.findByCase(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
    );
  }

  @Get(':evidenceId/download')
  async createDownloadUrl(
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evidenceService.createDownloadUrl(
      evidenceId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
    );
  }

  @Post(':evidenceId/deletion-requests')
  async requestDeletion(
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EvidenceDeletionRequestDto,
  ) {
    return this.evidenceService.requestDeletion(
      evidenceId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
      dto.reason,
    );
  }

  @Post(':evidenceId/annotate')
  async addAnnotation(
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddAnnotationDto,
  ) {
    return this.evidenceService.addAnnotation(
      evidenceId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
      user.profile?.displayName || 'Technician',
      dto,
    );
  }
}
