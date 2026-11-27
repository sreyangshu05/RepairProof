import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  controllers: [CertificateController],
  imports: [NotificationsModule, AnalyticsModule],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificateModule {}
