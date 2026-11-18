import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

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

import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
