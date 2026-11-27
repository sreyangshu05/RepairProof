import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEmailWorker } from './notification-email.worker';
import { ResendEmailProvider, EmailDeliveryProvider } from './email-delivery.provider';
import { WarrantyExpirationWorker } from './warranty-expiration.worker';
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationEmailWorker,
    WarrantyExpirationWorker,
    ResendEmailProvider,
    { provide: EmailDeliveryProvider, useExisting: ResendEmailProvider },
  ],
  exports: [NotificationsService, EmailDeliveryProvider],
})
export class NotificationsModule {}
