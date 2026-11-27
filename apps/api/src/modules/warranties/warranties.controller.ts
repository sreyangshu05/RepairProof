import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';
import {
  CreateWarrantyClaimDto,
  CreateWarrantyDto,
  UpdateWarrantyClaimDto,
} from './warranties.dto';
import { WarrantiesService } from './warranties.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@repairproof/shared';
@Controller()
export class WarrantiesController {
  constructor(private readonly service: WarrantiesService) {}
  @Get('warranties') list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(requireShopId(user));
  }
  @Post('cases/:caseId/warranty')
  @Roles(UserRole.TECHNICIAN, UserRole.SHOP_OWNER)
  createForCase(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWarrantyDto,
  ) {
    return this.service.createForCase(caseId, requireShopId(user), requireProfileId(user), dto);
  }
  @Post('warranties/:warrantyId/claims') createClaim(
    @Param('warrantyId') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWarrantyClaimDto,
  ) {
    return this.service.createClaim(id, requireShopId(user), requireProfileId(user), dto, user.role);
  }
  @Patch('warranty-claims/:claimId') updateClaim(
    @Param('claimId') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateWarrantyClaimDto,
  ) {
    return this.service.updateClaim(
      id,
      requireShopId(user),
      requireProfileId(user),
      body.status,
      body.resolution,
    );
  }
}
