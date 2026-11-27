import { Global, Module } from '@nestjs/common';
import { RepairLifecycleService } from './repair-lifecycle.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Global()
@Module({
  imports: [NotificationsModule],
  providers: [RepairLifecycleService],
  exports: [RepairLifecycleService],
})
export class RepairLifecycleModule {}
