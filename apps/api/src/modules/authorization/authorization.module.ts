import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { AuthorizationController } from './authorization.controller';
import { EvidenceModule } from '../evidence/evidence.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  controllers: [AuthorizationController],
  imports: [ConfigModule, EvidenceModule, NotificationsModule],
  providers: [AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
