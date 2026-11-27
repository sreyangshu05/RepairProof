# RepairProof external integrations

Reviewed 2026-11-22. Provider pricing and quotas change; links below are the provider's current published pages. External calls are behind adapters where RepairProof sends data. Secrets belong in the deployment secret store or local `.env`, never source control or browser variables.

## Integration decisions

| Capability | Decision | Provider / interface | Why and cost posture |
|---|---|---|---|
| Transactional email | Implemented | `EmailDeliveryProvider` → Resend | Repair updates and approval notices are important. Resend's published Free plan is $0, 3,000 emails/month, 100/day; it documents a default 10 requests/sec API rate. The limit is shared with any Resend SMTP use for Supabase Auth. [Pricing](https://resend.com/pricing), [rate limits](https://resend.com/changelog/api-rate-limit). |
| OTP verification | Implemented, email only | `AuthProvider` → Supabase Auth | Passwordless sign-in and email verification use the same identity provider as sessions. Supabase Free currently includes 50,000 MAUs, but its built-in auth mail only sends to project-team addresses and is limited to 2 emails/hour; configure custom SMTP for real users. OTP send limits are configurable (default 360/hour per project and 60 seconds between messages to one address). [Supabase pricing](https://supabase.com/pricing), [Auth rate limits](https://supabase.com/docs/guides/deployment/going-into-prod). |
| SMS / WhatsApp | Deferred | No provider configured; Twilio is a future adapter candidate | In-app plus email covers current repair notifications. SMS is paid and destination-dependent; US Twilio SMS is listed at $0.0083 per segment plus carrier fees and number charges. WhatsApp adds Twilio's $0.005/message fee plus Meta template charges. Global pricing and registration vary. [SMS pricing](https://www.twilio.com/en-us/sms/pricing/us?version=published), [WhatsApp pricing](https://www.twilio.com/en-us/whatsapp/pricing). |
| Evidence object storage | Implemented | `ObjectStorageService` port → `SupabaseObjectStorageAdapter` | Evidence files are part of the repair record and need private signed access. Supabase Free lists 1 GB file storage and a 50 MB maximum upload; RepairProof caps individual evidence at 25 MiB. Free projects can pause after one week of inactivity. [Storage pricing](https://supabase.com/pricing), [upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits). |
| Payments | Not required | None | RepairProof records quotations and customer authorization; it does not collect, hold, or disburse repair payments. Add a payment provider only if RepairProof itself becomes merchant of record or needs platform billing. |
| Device specifications / repair information | No API assumed | Versioned, source-cited rule catalog | Manufacturer data is not exposed through one documented, authorized, stable cross-manufacturer API. Rules cite official documentation and require expert review. RepairProof does not scrape manufacturer portals. |
| Maps / geolocation | Deferred | None | No dispatch, routing, proximity search, or map UI exists. Shops enter region/country for pricing comparisons; no background geolocation or map API key is needed. |
| Product analytics | First-party, opt-in, service-flagged | PostgreSQL `AnalyticsConsent` and `ProductAnalyticsEvent`; authenticated `/analytics/consent`, `/analytics/product-summary`; see [`docs/product-analytics.md`](../docs/product-analytics.md) | No browser SDK, cookies, or external event vendor. Collection requires both `PRODUCT_ANALYTICS_ENABLED=true` and an environment-specific `ANALYTICS_PSEUDONYM_SECRET` (32+ characters). Consent is unchecked by default at signup and revocable from account settings. |
| Error monitoring | Implemented, optional | `ErrorMonitor` port → Sentry SDK | Production exceptions need triage. Sentry Developer lists $0 for one user, 5k errors, 5M spans, and 30-day lookback; RepairProof disables tracing, sends no default PII, and sanitizes event payloads. Team collaboration is paid. [Pricing](https://sentry.io/pricing/), [NestJS setup](https://docs.sentry.io/platforms/javascript/guides/nestjs/). |

## Notification behavior

The application stores workflow notices and email work in one PostgreSQL outbox row. The row is inserted with the repair transaction; a unique SHA-256 event/recipient key and `createMany(skipDuplicates)` make retries and replayed transitions idempotent. Provider delivery happens after commit through `EmailDeliveryProvider` (Resend by default). `QUEUED` → `SENDING` → `SENT`/`FAILED` states, attempt counts, next-attempt time, last sanitized error, and send timestamp are retained. The worker uses row locks, a five-attempt cap, exponential backoff, provider `Retry-After`, and provider idempotency keys. A provider outage cannot change a repair's database state. If the email provider is absent, jobs remain queued and in-app notices still work.

`GET /notifications/preferences` and `PATCH /notifications/preferences` manage category-specific in-app and email delivery. Email defaults on for transactional categories; in-app defaults on. `GET /notifications/:id/delivery` exposes the signed-in user's delivery state. `Notification.body` is the preview field and uses fixed, generic templates; it must never contain symptoms, diagnostic text, repair notes, line items, prices, customer names, or evidence. Secure quotation review links, when needed, are stored in the email-only `emailText` field and are excluded from in-app APIs. Existing legacy notification bodies with free-form quotation notes or token links are sanitized by the notification migration.

The supported event map covers case creation, diagnostic completion, quotation ready, customer decision, material price change, lifecycle status change, verified repair completion, warranty reminders, warranty claim changes, and dispute changes. Warranty reminders are swept every six hours for the 30/7/1-day windows and deduplicated per warranty/window.

SMS is deliberately not activated. Case phone fields are not proof of ownership, phone verification, or consent; enabling a paid sender before those controls exist would create abuse and privacy risks. `smsEnabled` defaults off, and the preference API rejects enabling it until a verified-phone and consent workflow plus a provider adapter are deployed. No SMS charges or messages can occur in the current release.

## Adapter behavior

### Email delivery

`NotificationEmailWorker` drains the PostgreSQL outbox and calls `EmailDeliveryProvider`; `ResendEmailProvider` is the current implementation. API-key bearer auth is server-side. Delivery uses a stable notification idempotency key. Resend retains idempotency keys for 24 hours, supporting safe retries after ambiguous network failures. The worker retries transient network, 408, 425, 429, 5xx failures, and Resend's explicit `concurrent_idempotent_requests` 409 response with bounded exponential delay; it honors `Retry-After`, caps at five attempts, and marks other 4xx responses or exhausted attempts `FAILED`. A process crash leaves the row locked for five minutes, after which another worker may claim it. The provider never logs message content or API keys. [Idempotency behavior](https://resend.com/changelog/idempotency-keys).

Notification delivery tests replace the HTTP response and exercise acceptance, transient retry, and permanent rejection. They make no live provider call.

### Email OTP and bearer authentication

`AuthProvider` is the boundary for Supabase Auth operations. `SupabaseAuthProvider` implements account registration, password sign-in, OTP request/verification, and access-token lookup. OTP request is non-enumerating and does not create an account. Incorrect/expired codes return a generic authentication error. Request and verify routes have shared rate limits (3 requests/minute and 5 verifications/minute per API client); Supabase also enforces project and address limits.

OTP sends are not automatically retried: an ambiguous timeout can mean a code email was already sent. OTP verification is not retried because codes are single-use. The UI may let a user request a new code after the provider's resend interval. Safe bearer-token lookup retries up to two times after transient provider/network failures; invalid-token responses are returned immediately. Provider failures become 503 without minting a local identity.

Adapter tests use a fake Supabase client. In production, configure email OTP templates and expiry in Supabase Auth; set the template to include `{{ .Token }}`. Configure custom SMTP in the Supabase project with a verified sender/domain. [Supabase OTP API](https://supabase.com/docs/reference/javascript/auth-signinwithotp), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

### Object storage

`ObjectStorageService` is the port consumed by evidence workflows. `SupabaseObjectStorageAdapter` owns the Supabase Storage SDK and server-only service-role key. Safe reads and signed-URL creation retry transient network/408/429/5xx failures up to three attempts. State-changing uploads and moves are not blindly retried: an ambiguous result can otherwise duplicate or strand evidence. Malware scanning, MIME inspection, SHA-256, private-bucket checks, and evidence audit records remain application responsibilities. The provider adapter tests cover transient retry and fail-closed public bucket configuration.

### Error monitoring

The Sentry SDK is initialized before Nest modules only when `SENTRY_DSN` is set. `ErrorMonitor` is the application boundary. The global exception filter reports 5xx errors only and tags route template, method, status, and request ID. It excludes request/user payloads, breadcrumbs, extras, and exception messages before transmission; stack traces remain for diagnosis. Tracing is disabled to control volume and avoid unnecessary performance-data transfer. Reporting is deliberately best-effort rather than retried in an API request: Sentry outage must not delay the client or change API behavior, and structured stdout/stderr logs remain the fallback. No error event is durably queued by RepairProof.

## Environment variables

| Variable | Used by | Required when | Secret? |
|---|---|---|---|
| `SUPABASE_URL` | Supabase Auth and Storage | Hosted identity/storage enabled | No |
| `SUPABASE_ANON_KEY` | Supabase Auth and request-token validation | Hosted Auth enabled | Treat as runtime config; never use service-role key here |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Storage server adapter | Evidence storage enabled | **Yes**; API runtime only |
| `EVIDENCE_STORAGE_BUCKET` | Storage adapter | Optional; defaults to `repairproof-evidence` | No |
| `RESEND_API_KEY` | Notification-email adapter | Outbound notifications enabled | **Yes** |
| `EMAIL_FROM` | Notification-email adapter | Outbound notifications enabled | No; domain must be provider-verified |
| Supabase Auth SMTP credentials | Supabase dashboard secret settings | Sending OTPs to actual users | **Yes**; do not put into frontend builds |
| `SENTRY_DSN` | Sentry error monitor | Optional monitoring enabled | Treat as project ingest credential; restrict and rotate if exposed |
| `NODE_ENV` | Sentry event environment | Optional; defaults to `development` | No |

No Twilio, payment, map, analytics, manufacturer API, or OrcaRouter credentials are defined. The OrcaRouter key pasted into the request is exposed and must be revoked/rotated; it was not copied into the repository or used. The current OrcaRouter model catalog documents an `orcarouter/free` router with capped free access, but does not show the pasted `deepseek/deepseek-v4-flash-free` model ID. Remote inference also introduces external processing of repair-record signals, so it is not enabled by this change. [Current OrcaRouter model catalog](https://www.orcarouter.ai/models), [provider terms on changing models/prices](https://www.orcarouter.ai/terms.html).

## Configuration examples

```dotenv
# Email notifications; leave blank to durably queue without sending.
RESEND_API_KEY=
EMAIL_FROM=

# Supabase Auth + private Storage (server runtime only)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
EVIDENCE_STORAGE_BUCKET=repairproof-evidence

# Optional Sentry; unset to use structured application logs only.
SENTRY_DSN=
NODE_ENV=production
```

Do not paste secret values into issues, prompts, or source files. Rotate credentials that have been exposed.
