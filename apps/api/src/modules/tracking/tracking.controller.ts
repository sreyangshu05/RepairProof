import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { CreateRepairStepDto, UpdateRepairStepDto } from './tracking.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('cases/:caseId/steps')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post()
  async addStep(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRepairStepDto,
  ) {
    const performedById = user.profile?.id || 'dev-tech-id';
    return this.trackingService.addStep(caseId, performedById, dto);
  }

  @Get()
  async findByCase(@Param('caseId') caseId: string) {
    return this.trackingService.findByCase(caseId);
  }

  @Patch(':stepId')
  async updateStep(
    @Param('stepId') stepId: string,
    @Body() dto: UpdateRepairStepDto,
  ) {
    return this.trackingService.updateStep(stepId, dto);
  }
}
