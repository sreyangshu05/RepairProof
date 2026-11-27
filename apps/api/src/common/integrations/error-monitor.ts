import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

export interface ErrorContext {
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
}

export abstract class ErrorMonitor {
  abstract capture(error: unknown, context: ErrorContext): void;
}

@Injectable()
export class SentryErrorMonitor extends ErrorMonitor {
  capture(error: unknown, context: ErrorContext) {
    try {
      Sentry.withScope((scope) => {
        if (context.requestId) scope.setTag('request_id', context.requestId);
        if (context.route) scope.setTag('route', context.route);
        if (context.method) scope.setTag('method', context.method);
        if (context.status) scope.setTag('http_status', String(context.status));
        Sentry.captureException(error);
      });
    } catch {
      // Monitoring must not change API response behavior.
    }
  }
}
