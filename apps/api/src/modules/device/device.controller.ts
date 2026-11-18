import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { DeviceService } from './device.service';
import { CreateDeviceDto, UpdateDeviceDto } from './device.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDeviceDto) {
    const shopId = user.profile?.shopId || 'default-shop';
    return this.deviceService.create(shopId, user.userId, dto);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const shopId = user.profile?.shopId || 'default-shop';
    return this.deviceService.findAll(shopId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const shopId = user.profile?.shopId || 'default-shop';
    return this.deviceService.findOne(id, shopId);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    const shopId = user.profile?.shopId || 'default-shop';
    return this.deviceService.update(id, shopId, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const shopId = user.profile?.shopId || 'default-shop';
    return this.deviceService.softDelete(id, shopId);
  }
}
