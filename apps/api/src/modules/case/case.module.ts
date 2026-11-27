import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { EvidenceModule } from '../evidence/evidence.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  controllers: [CaseController],
  imports: [EvidenceModule, NotificationsModule, AnalyticsModule, FeatureFlagsModule],
  providers: [CaseService],
  exports: [CaseService],
})
export class CaseModule {}
