import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max as MaxValue,
  Min as MinValue,
} from 'class-validator';
import { NotificationCategory } from '@prisma/client';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
} from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
class NotificationQueryDto {
  @Type(() => Number) @IsInt() @MinValue(1) @MaxValue(100) limit = 25;
}
class NotificationPreferenceDto {
  @IsEnum(NotificationCategory) category!: NotificationCategory;
  @IsOptional() @IsBoolean() inAppEnabled?: boolean;
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() smsEnabled?: boolean;
}
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser, @Query() query: NotificationQueryDto) {
    return this.service.list(requireProfileId(user), query.limit);
  }
  @Get('preferences') preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.service.preferences(requireProfileId(user));
  }
  @Patch('preferences') updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: NotificationPreferenceDto,
  ) {
    const { category, ...value } = dto;
    return this.service.updatePreference(requireProfileId(user), category, value);
  }
  @Get(':id/delivery') delivery(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deliveryStatus(id, requireProfileId(user));
  }
  @Post(':id/read') read(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.markRead(id, requireProfileId(user));
  }
}
