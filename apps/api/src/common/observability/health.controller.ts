import { Controller, Get, Header, HttpException, HttpStatus, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Public } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisThrottlerStorage } from '../rate-limit/redis-throttler-storage';
import { MetricsService } from './metrics.service';
import { ObjectStorageService } from '../../modules/evidence/object-storage.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisThrottlerStorage,
    private readonly metrics: MetricsService,
    private readonly storage: ObjectStorageService,
  ) {}

  @Public()
  @Get('live')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async readiness() {
    const checks: Record<string, 'ok' | 'unavailable' | 'optional'> = {
      postgres: 'unavailable',
      redis: 'optional',
      evidence_storage: 'optional',
    };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = 'ok';
    } catch {
      checks.postgres = 'unavailable';
    }
    this.metrics.setDependency('db', checks.postgres === 'ok');
    if (this.redis.isConfigured) {
      try {
        await this.redis.checkHealth();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'unavailable';
      }
    }
    const redisRequired =
      process.env.NODE_ENV === 'production' || process.env.REQUIRE_REDIS_RATE_LIMIT === 'true';
    this.metrics.setDependency('redis', checks.redis === 'ok');
    if (process.env.EVIDENCE_STORAGE_DISABLED !== 'true') {
      try {
        await this.storage.checkHealth();
        checks.evidence_storage = 'ok';
      } catch {
        checks.evidence_storage = 'unavailable';
      }
    }
    this.metrics.setDependency('storage', checks.evidence_storage !== 'unavailable');
    const ready = checks.postgres === 'ok' && (!redisRequired || checks.redis === 'ok');
    if (!ready)
      throw new HttpException({ status: 'not_ready', checks }, HttpStatus.SERVICE_UNAVAILABLE);
    return { status: 'ready', checks, timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metricsEndpoint(@Req() request: Request, @Res() response: Response) {
    const token = process.env.METRICS_BEARER_TOKEN;
    if (process.env.METRICS_ENABLED !== 'true')
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    if (!token)
      throw new HttpException('Metrics endpoint is not configured', HttpStatus.SERVICE_UNAVAILABLE);
    const auth = request.headers.authorization;
    const supplied = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '') : '';
    const expectedHash = createHash('sha256').update(token).digest();
    const actualHash = createHash('sha256').update(supplied).digest();
    if (!timingSafeEqual(expectedHash, actualHash) || !supplied)
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    try {
      const [queue] = await this.prisma.$queryRaw<
        Array<{ count: bigint; oldestSeconds: number | null }>
      >`
        SELECT COUNT(*)::bigint AS count,
          EXTRACT(EPOCH FROM (NOW() - MIN("createdAt")))::float8 AS "oldestSeconds"
        FROM "Notification" WHERE "emailStatus" = 'QUEUED'
      `;
      this.metrics.setEmailQueue(Number(queue?.count ?? 0), Number(queue?.oldestSeconds ?? 0));
    } catch {
      this.metrics.setEmailQueue(0, 0);
    }
    return response.status(200).send(this.metrics.renderPrometheus());
  }
}
