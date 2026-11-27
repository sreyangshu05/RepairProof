import { Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
@Module({
  controllers: [DiagnosticsController],
  imports: [AnalyticsModule, FeatureFlagsModule],
  providers: [DiagnosticsService],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
