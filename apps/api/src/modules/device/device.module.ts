import { Module } from '@nestjs/common';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  controllers: [DeviceController],
  imports: [AnalyticsModule, FeatureFlagsModule],
  providers: [DeviceService],
  exports: [DeviceService],
})
export class DeviceModule {}
