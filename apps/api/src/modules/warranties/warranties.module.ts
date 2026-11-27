import { Module } from '@nestjs/common';
import { WarrantiesController } from './warranties.controller';
import { WarrantiesService } from './warranties.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
@Module({
  imports: [NotificationsModule, AnalyticsModule, FeatureFlagsModule],
  controllers: [WarrantiesController],
  providers: [WarrantiesService],
  exports: [WarrantiesService],
})
export class WarrantiesModule {}
