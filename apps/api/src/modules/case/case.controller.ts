import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CaseService } from './case.service';
import { CreateCaseDto, UpdateCaseStatusDto, AssignTechnicianDto } from './case.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CaseStatus } from '@repairproof/shared';

@Controller('cases')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCaseDto) {
    const shopId = user.profile?.shopId || 'default-shop';
    return this.caseService.create(shopId, user.profile?.id || null, dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: CaseStatus,
    @Query('technicianId') technicianId?: string,
  ) {
    const shopId = user.profile?.shopId || 'default-shop';
    return this.caseService.findAll(shopId, status, technicianId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const shopId = user.profile?.shopId || 'default-shop';
    return this.caseService.findOne(id, shopId);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCaseStatusDto,
  ) {
    const shopId = user.profile?.shopId || 'default-shop';
    return this.caseService.updateStatus(id, shopId, dto);
  }

  @Post(':id/assign')
  async assignTechnician(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignTechnicianDto,
  ) {
    const shopId = user.profile?.shopId || 'default-shop';
    return this.caseService.assignTechnician(id, shopId, dto.technicianId);
  }
}
