import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ErrorMonitor } from '../integrations/error-monitor';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly errorMonitor: ErrorMonitor) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let details: unknown = null;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const respObj = exceptionResponse as Record<string, unknown>;
      const rawMessage = respObj['message'];
      message =
        typeof rawMessage === 'string'
          ? rawMessage
          : Array.isArray(rawMessage)
            ? 'Request validation failed'
            : message;
      details = Array.isArray(rawMessage) ? rawMessage : (respObj['details'] ?? null);
    }

    const requestId = request.headers['x-request-id']?.toString() || undefined;
    const safePath = request.route?.path
      ? `${request.baseUrl ?? ''}${request.route.path}`
      : 'unmatched';
    const route = typeof request.route?.path === 'string' ? request.route.path : undefined;
    if (status >= 500 && !String(route ?? '').startsWith('/health/'))
      this.errorMonitor.capture(exception, { requestId, route, method: request.method, status });
    this.logger.error(
      JSON.stringify({
        event: 'http.exception',
        method: request.method,
        path: safePath,
        status,
        requestId,
        error: status >= 500 ? 'Unhandled server exception' : message,
        timestamp: new Date().toISOString(),
      }),
    );

    response.status(status).json({
      success: false,
      error: {
        code: `HTTP_${status}`,
        message,
        details,
        path: safePath,
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
