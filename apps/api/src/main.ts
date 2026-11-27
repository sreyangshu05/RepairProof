import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { StructuredLogger } from './common/logging/structured-logger';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const structuredLogger = new StructuredLogger();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(structuredLogger);
  const trustProxyHops = Number(process.env.API_TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
    throw new Error('API_TRUST_PROXY_HOPS must be an integer between 0 and 10');
  }
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-ID', requestId);
    const started = process.hrtime.bigint();
    response.once('finish', () => {
      const route = request.route?.path
        ? `${request.baseUrl ?? ''}${request.route.path}`
        : 'unmatched';
      structuredLogger.event('http.request.complete', {
        requestId,
        method: request.method,
        route,
        status: response.statusCode,
        durationMs: Number(process.hrtime.bigint() - started) / 1_000_000,
      });
    });
    next();
  });

  // Header-based versioning preserves the existing resource URLs while making
  // clients declare the API contract they target (X-API-Version: 1).
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: 'X-API-Version',
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Enable CORS
  const corsOrigins = (process.env.API_CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-API-Version',
      'X-Request-ID',
      'Idempotency-Key',
    ],
  });

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('RepairProof API')
    .setDescription('Evidence-driven repair verification and intelligence infrastructure API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Version' }, 'api-version')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  document.info.version = '1';
  document.info.description += '\n\nSend `X-API-Version: 1` to select this contract.';
  SwaggerModule.setup('api/docs', app, document);

  // Render and other managed web hosts provide PORT at runtime. Keep API_PORT
  // as the local/container override for the existing Docker topology.
  const port = process.env.PORT || process.env.API_PORT || 3001;
  await app.listen(port);
  structuredLogger.log(`RepairProof API is listening on port ${port}`, 'Bootstrap');
  structuredLogger.log(
    `API Documentation available at http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
}

bootstrap();
