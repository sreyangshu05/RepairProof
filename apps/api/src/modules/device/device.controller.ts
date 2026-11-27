import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { DeviceService } from './device.service';
import { CreateDeviceDto, UpdateDeviceDto } from './device.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@repairproof/shared';
import {
  CurrentUser,
  AuthenticatedUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';

@Controller('devices')
@Roles(UserRole.TECHNICIAN, UserRole.SHOP_OWNER)
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDeviceDto) {
    const shopId = requireShopId(user);
    return this.deviceService.create(shopId, requireProfileId(user), dto, user.role);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const shopId = requireShopId(user);
    return this.deviceService.findAll(shopId, requireProfileId(user), user.role);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const shopId = requireShopId(user);
    return this.deviceService.findOne(id, shopId, requireProfileId(user), user.role);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    const shopId = requireShopId(user);
    return this.deviceService.update(id, shopId, requireProfileId(user), user.role, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const shopId = requireShopId(user);
    return this.deviceService.softDelete(id, shopId, requireProfileId(user), user.role);
  }
}
