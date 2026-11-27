import { Module } from '@nestjs/common';
import { QuotationService } from './quotation.service';
import { QuotationController } from './quotation.controller';
import { EvidenceModule } from '../evidence/evidence.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  controllers: [QuotationController],
  imports: [EvidenceModule, NotificationsModule, AnalyticsModule, FeatureFlagsModule],
  providers: [QuotationService],
  exports: [QuotationService],
})
export class QuotationModule {}
