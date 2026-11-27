import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { UserRole } from '@repairproof/shared';
import {
  AuthenticatedUser,
  CurrentUser,
  requireProfileId,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ConfigureExperimentDto,
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
} from './feature-flags.dto';
import { FeatureFlagsService } from './feature-flags.service';

@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly service: FeatureFlagsService) {}

  @Get('effective')
  evaluate(@CurrentUser() user: AuthenticatedUser) {
    return this.service.evaluate(
      requireProfileId(user),
      user.profile?.shopId ?? null,
      user.role,
    );
  }
}

@Controller('platform/admin/feature-flags')
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminFeatureFlagsController {
  constructor(private readonly service: FeatureFlagsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFeatureFlagDto) {
    return this.service.create(requireProfileId(user), dto);
  }

  @Patch(':key')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    return this.service.update(requireProfileId(user), key, dto);
  }

  @Post(':key/emergency-disable')
  emergencyDisable(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    return this.service.emergencyDisable(requireProfileId(user), key, true);
  }

  @Post(':key/restore')
  restore(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    return this.service.emergencyDisable(requireProfileId(user), key, false);
  }

  @Put(':key/experiment')
  configureExperiment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: ConfigureExperimentDto,
  ) {
    return this.service.configureExperiment(requireProfileId(user), key, dto);
  }

  @Get(':key/experiment/metrics')
  metrics(@Param('key') flagKey: string) {
    return this.service.metrics(flagKey);
  }
}
