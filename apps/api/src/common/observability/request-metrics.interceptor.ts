import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, finalize } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      method: string;
      route?: { path?: string };
      baseUrl?: string;
    }>();
    const response = http.getResponse<{ statusCode: number }>();
    const started = process.hrtime.bigint();
    this.metrics.beginRequest();
    return next.handle().pipe(
      finalize(() => {
        const seconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
        const route = request.route?.path
          ? `${request.baseUrl ?? ''}${request.route.path}`
          : 'unmatched';
        this.metrics.endRequest(request.method, route, response.statusCode, seconds);
      }),
    );
  }
}
