import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  controllers: [AuthController],
  imports: [AnalyticsModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
