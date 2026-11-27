import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { HealthController } from '../src/common/observability/health.controller';
import { MetricsService } from '../src/common/observability/metrics.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisThrottlerStorage } from '../src/common/rate-limit/redis-throttler-storage';
import { ObjectStorageService } from '../src/modules/evidence/object-storage.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('HTTP API contracts (Supertest)', () => {
  let app: INestApplication;
  let dbAvailable = true;
  const previousMetricsEnabled = process.env.METRICS_ENABLED;
  const previousMetricsToken = process.env.METRICS_BEARER_TOKEN;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        MetricsService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(() =>
              dbAvailable
                ? Promise.resolve([{ '?column?': 1 }])
                : Promise.reject(new Error('database unavailable')),
            ),
          },
        },
        {
          provide: RedisThrottlerStorage,
          useValue: { isConfigured: false, checkHealth: jest.fn() },
        },
        { provide: ObjectStorageService, useValue: { checkHealth: jest.fn() } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.enableVersioning({
      type: VersioningType.HEADER,
      header: 'X-API-Version',
      defaultVersion: '1',
    });
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousMetricsEnabled === undefined) delete process.env.METRICS_ENABLED;
    else process.env.METRICS_ENABLED = previousMetricsEnabled;
    if (previousMetricsToken === undefined) delete process.env.METRICS_BEARER_TOKEN;
    else process.env.METRICS_BEARER_TOKEN = previousMetricsToken;
  });

  it('returns the stable success envelope on the versioned liveness endpoint', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .set('X-API-Version', '1')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ success: true, data: { status: 'ok' } });
        expect(body.data.timestamp).toEqual(expect.any(String));
      });
  });

  it('returns readiness 503 when PostgreSQL is unavailable', async () => {
    dbAvailable = false;
    await request(app.getHttpServer())
      .get('/health/ready')
      .set('X-API-Version', '1')
      .expect(503)
      .expect(({ body }) =>
        expect(body).toMatchObject({ status: 'not_ready', checks: { postgres: 'unavailable' } }),
      );
    dbAvailable = true;
  });

  it('keeps metrics disabled unless configured and requires the bearer secret when enabled', async () => {
    process.env.METRICS_ENABLED = 'false';
    await request(app.getHttpServer()).get('/health/metrics').set('X-API-Version', '1').expect(404);
    process.env.METRICS_ENABLED = 'true';
    process.env.METRICS_BEARER_TOKEN = 'test-only-secret';
    await request(app.getHttpServer()).get('/health/metrics').set('X-API-Version', '1').expect(401);
    await request(app.getHttpServer())
      .get('/health/metrics')
      .set('X-API-Version', '1')
      .set('Authorization', 'Bearer test-only-secret')
      .expect(200)
      .expect(({ text }) => expect(text).toContain('repairproof_http_request_duration_seconds'));
  });
});
