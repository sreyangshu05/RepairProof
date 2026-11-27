import { Controller, Get, Post, Patch, Body, Param, Query, Headers } from '@nestjs/common';
import { CaseService } from './case.service';
import {
  CreateCaseDto,
  CreateCaseIntakeDto,
  UpdateCaseStatusDto,
  AssignTechnicianDto,
  ListCasesQueryDto,
} from './case.dto';
import {
  CurrentUser,
  AuthenticatedUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '@repairproof/shared';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('cases')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Post()
  @Roles(UserRole.TECHNICIAN, UserRole.SHOP_OWNER)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCaseDto) {
    const shopId = requireShopId(user);
    return this.caseService.create(shopId, requireProfileId(user), dto, user.role);
  }

  @Post('intake')
  @Roles(UserRole.TECHNICIAN, UserRole.SHOP_OWNER)
  async createIntake(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCaseIntakeDto) {
    return this.caseService.createFromIntake(
      requireShopId(user),
      requireProfileId(user),
      user.role,
      dto,
    );
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCasesQueryDto) {
    const shopId = requireShopId(user);
    const assignedTech =
      user.role === UserRole.TECHNICIAN ? requireProfileId(user) : query.technicianId;
    return this.caseService.findAll(shopId, query.status, assignedTech, query.limit, query.cursor, query.search);
  }

  @Get('workspace')
  @Roles(UserRole.TECHNICIAN, UserRole.SHOP_OWNER)
  async technicianWorkspace(@CurrentUser() user: AuthenticatedUser) {
    return this.caseService.technicianWorkspace(
      requireShopId(user),
      requireProfileId(user),
      user.role,
    );
  }

  @Get('summary')
  async summary(@CurrentUser() user: AuthenticatedUser) {
    const technicianId = user.role === UserRole.TECHNICIAN ? requireProfileId(user) : undefined;
    return this.caseService.summary(requireShopId(user), technicianId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const shopId = requireShopId(user);
    return this.caseService.findOne(
      id,
      shopId,
      user.role === UserRole.TECHNICIAN ? requireProfileId(user) : undefined,
      requireProfileId(user),
    );
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCaseStatusDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    const shopId = requireShopId(user);
    return this.caseService.updateStatus(
      id,
      shopId,
      requireProfileId(user),
      user.role,
      idempotencyKey,
      dto,
    );
  }

  @Post(':id/assign')
  @Roles(UserRole.SHOP_OWNER)
  async assignTechnician(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignTechnicianDto,
  ) {
    const shopId = requireShopId(user);
    return this.caseService.assignTechnician(id, shopId, requireProfileId(user), dto.technicianId);
  }
}
