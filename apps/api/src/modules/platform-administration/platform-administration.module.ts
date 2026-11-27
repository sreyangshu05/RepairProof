import { Module } from '@nestjs/common';
import { PlatformAdministrationController } from './platform-administration.controller';
import { PlatformAdministrationService } from './platform-administration.service';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  imports: [NotificationsModule],
  controllers: [PlatformAdministrationController],
  providers: [PlatformAdministrationService],
  exports: [PlatformAdministrationService],
})
export class PlatformAdministrationModule {}
