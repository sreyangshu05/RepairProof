import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { HealthController } from './health.controller';
import { MetricsService } from './metrics.service';
import { RequestMetricsInterceptor } from './request-metrics.interceptor';
import { EvidenceModule } from '../../modules/evidence/evidence.module';

@Global()
@Module({
  imports: [PrismaModule, RateLimitModule, EvidenceModule],
  controllers: [HealthController],
  providers: [MetricsService, RequestMetricsInterceptor],
  exports: [MetricsService, RequestMetricsInterceptor],
})
export class ObservabilityModule {}
