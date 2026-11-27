import * as Sentry from '@sentry/nestjs';
import type { ErrorEvent } from '@sentry/nestjs';

type SentryEvent = ErrorEvent;

const dsn = process.env.SENTRY_DSN;
export function sanitizeSentryEvent(event: SentryEvent): SentryEvent {
  // RepairProof handles customer and device records. Send stack + route tags,
  // but discard request/user payloads and exception messages which can carry PII.
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  delete event.extra;
  if (event.message) event.message = 'Unhandled server exception';
  if (event.exception?.values)
    event.exception.values = event.exception.values.map((item) => ({
      ...item,
      value: 'Unhandled server exception',
    }));
  return event;
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
    beforeSend: sanitizeSentryEvent,
  });
}
