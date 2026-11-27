import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { DeviceModule } from './modules/device/device.module';
import { CaseModule } from './modules/case/case.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { QuotationModule } from './modules/quotation/quotation.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { VerificationModule } from './modules/verification/verification.module';
import { CertificateModule } from './modules/certificate/certificate.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { ComponentsModule } from './modules/components/components.module';
import { TestResultsModule } from './modules/test-results/test-results.module';
import { WarrantiesModule } from './modules/warranties/warranties.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { PlatformAdministrationModule } from './modules/platform-administration/platform-administration.module';
import { PriceIntelligenceModule } from './modules/price-intelligence/price-intelligence.module';
import { DiagnosticConsistencyModule } from './modules/diagnostic-consistency/diagnostic-consistency.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { RepairLifecycleModule } from './modules/case/repair-lifecycle.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { RedisThrottlerStorage } from './common/rate-limit/redis-throttler-storage';
import { ErrorMonitor, SentryErrorMonitor } from './common/integrations/error-monitor';

import { RepairProofAuthGuard } from './common/guards/supabase-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ObservabilityModule } from './common/observability/observability.module';
import { RequestMetricsInterceptor } from './common/observability/request-metrics.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    RateLimitModule,
    ThrottlerModule.forRootAsync({
      imports: [RateLimitModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        ...(storage.isConfigured ? { storage } : {}),
      }),
    }),
    PrismaModule,
    AuthModule,
    DeviceModule,
    CaseModule,
    EvidenceModule,
    QuotationModule,
    AuthorizationModule,
    TrackingModule,
    VerificationModule,
    CertificateModule,
    UsersModule,
    OrganizationsModule,
    DiagnosticsModule,
    ComponentsModule,
    TestResultsModule,
    WarrantiesModule,
    NotificationsModule,
    AnalyticsModule,
    AdministrationModule,
    ApprovalsModule,
    PlatformAdministrationModule,
    PriceIntelligenceModule,
    DiagnosticConsistencyModule,
    FeatureFlagsModule,
    RepairLifecycleModule,
    ObservabilityModule,
  ],
  providers: [
    { provide: ErrorMonitor, useClass: SentryErrorMonitor },
    {
      provide: APP_GUARD,
      useClass: RepairProofAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    { provide: APP_INTERCEPTOR, useClass: RequestMetricsInterceptor },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
