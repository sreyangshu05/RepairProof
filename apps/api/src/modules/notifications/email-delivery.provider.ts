import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailDeliveryRequest {
  idempotencyKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}

export class EmailProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

/** Port used by the durable outbox worker. Implementations must not log email bodies or credentials. */
export abstract class EmailDeliveryProvider {
  abstract get isConfigured(): boolean;
  abstract send(request: EmailDeliveryRequest): Promise<void>;
}

@Injectable()
export class ResendEmailProvider extends EmailDeliveryProvider {
  private readonly apiKey?: string;
  private readonly from?: string;
  private readonly endpoint = 'https://api.resend.com/emails';

  constructor(config: ConfigService) {
    super();
    this.apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('EMAIL_FROM');
  }

  get isConfigured() {
    return Boolean(this.apiKey && this.from);
  }

  async send(request: EmailDeliveryRequest) {
    if (!this.apiKey || !this.from)
      throw new EmailProviderError('Email provider is not configured', false);
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': request.idempotencyKey,
        },
        body: JSON.stringify({
          from: request.from || this.from,
          to: request.to,
          subject: request.subject,
          text: request.text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new EmailProviderError(
        error instanceof Error ? error.name : 'Email provider network failure',
        true,
      );
    }
    if (response.ok) return;
    const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
    let providerCode = '';
    try {
      const body = (await response.clone().json()) as {
        name?: string;
        code?: string;
        error?: { name?: string; code?: string };
      };
      providerCode = body.name ?? body.code ?? body.error?.name ?? body.error?.code ?? '';
    } catch {
      /* status remains sufficient for ordinary retry classification */
    }
    const retryable =
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500 ||
      (response.status === 409 && providerCode === 'concurrent_idempotent_requests');
    throw new EmailProviderError(
      `Resend returned HTTP ${response.status}`,
      retryable,
      retryAfterMs,
    );
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 3_600_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 3_600_000)) : undefined;
}
