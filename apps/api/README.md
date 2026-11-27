# RepairProof API

NestJS modular monolith backed by PostgreSQL and Prisma. Domain modules share one Prisma client and call one another through application services where a workflow needs an atomic database transaction.

## Configure and run

1. Copy the repository `.env.example` to `.env` and set `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `CERTIFICATE_BASE_URL`. Set `REDIS_URL` for local development; Docker Compose starts a shared Redis instance and configures the API to use it.
2. Run `pnpm --filter @repairproof/api db:generate`.
3. Apply checked-in migrations with `pnpm --filter @repairproof/api db:migrate:deploy`.
4. Start the API with `pnpm --filter @repairproof/api dev`.

The API documents its routes at `/api/docs`. Resource URLs use the `X-API-Version: 1` header; version 1 is the default for existing clients. Successful responses are wrapped as `{ success: true, data }`; errors include a stable code, message, path, request ID, and timestamp.

## Domain modules

- `auth`, `users`, `organizations`: Supabase identity verification, user profiles, shop organization scope, and explicit organization memberships.
- `device`, `case`, `diagnostics`, `quotation`, `approvals`, `authorization`: repair intake, diagnostic submissions, quote revisions, and token-scoped customer decisions.
- `evidence`, `components`, `tracking`, `test-results`, `verification`, `certificate`, `warranties`: evidence records, inventory consumption, repair steps, verification, issuance, warranty and claim records.
- `notifications`, `analytics`, `administration`: in-app notification records, tenant-scoped aggregate views, organization owner operations, and audit events.
- `platform-administration`: platform-only organization verification, user access, dispute review, overview metrics, and global audit events. Platform admins have no implicit shop context.

All tenant-facing queries include the authenticated profile's active organization. Status transitions, quote decisions, inventory decrement, certificate issuance, warranty creation, and audit records use guarded updates and Prisma transactions. Case lifecycle transitions that must go through a business workflow are rejected by the generic status endpoint.

## Tests

- `pnpm --filter @repairproof/api exec jest --runInBand` runs unit tests. The PostgreSQL workflow integration suite is skipped unless `TEST_DATABASE_URL` points to a disposable, migrated test database.
- `pnpm --filter @repairproof/api test:integration` runs that suite. Never set `TEST_DATABASE_URL` to production or a shared development database; the suite inserts and deletes fixture records.
- `pnpm --filter @repairproof/api typecheck` and `pnpm --filter @repairproof/api build` validate the TypeScript app.

## Operations notes

Rate limiting uses the shared Redis-backed Nest throttler store when `REDIS_URL` is configured. Production startup fails if Redis is not configured; use the same Redis endpoint and `RATE_LIMIT_KEY_PREFIX` across API replicas. Set `API_TRUST_PROXY_HOPS` to the exact number of trusted ingress proxies so per-IP limits use the client address safely. Docker Compose provides a single-node Redis instance for local/small deployments; production should use a managed or suitably operated Redis service with persistence and network access restricted to the API.

Notifications are inserted into a PostgreSQL-backed transactional outbox with in-app visibility, per-category email preferences, and a unique event/recipient deduplication key. Repair workflows never call a delivery provider inline: a worker claims email jobs with `FOR UPDATE SKIP LOCKED` after commit. Retries use bounded exponential backoff, honor provider `Retry-After`, cap at five attempts, and are idempotency-keyed by notification ID. Delivery errors update notification state only; they cannot reverse a repair transition. If email is not configured, jobs stay durably queued. The API supports `/notifications/preferences` (GET/PATCH) and `/:id/delivery`; notification previews use fixed, non-sensitive copy and exclude prices, symptoms, technician notes, and evidence. Warranty reminders run on a six-hour sweep and deduplicate at 30, 7, and 1 day windows. SMS preference is disabled and cannot be enabled until verified phone numbers, explicit consent, and a configured provider exist; current customer phone fields are not sufficient evidence of SMS consent. The API also supports non-enumerating email OTP request/verification at `/auth/otp/request` and `/auth/otp/verify` using Supabase Auth; configure custom SMTP in the Supabase dashboard for actual user delivery.

Evidence storage is behind `ObjectStorageService` and currently uses the Supabase Storage adapter. Optional Sentry error monitoring is disabled unless `SENTRY_DSN` is configured; request bodies and user identifiers are stripped before reporting. See [external integration decisions, limits, and configuration](./EXTERNAL-INTEGRATIONS.md).

Platform administrator grants are provisioned explicitly, not through public signup or tenant UI. After applying migrations, set `PLATFORM_ADMIN_USER_ID` to the existing Supabase Auth user ID and `PLATFORM_ADMIN_REASON`, then run `pnpm --filter @repairproof/api platform-admin:manage` with `PLATFORM_ADMIN_ACTION=grant`. Use `PLATFORM_ADMIN_ACTION=revoke` to revoke. The command writes a platform audit event; the platform admin API cannot grant additional administrators. API startup fails on database connection errors in production. Supabase service-role credentials are not used by request authentication; bearer tokens are validated through Supabase Auth.
