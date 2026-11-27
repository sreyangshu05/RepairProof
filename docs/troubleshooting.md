# Troubleshooting

## Dependency install or workspace command fails

Check Node.js `>=20` (API package requires `>=20.19`), Corepack and pnpm `10.19.0`; run `pnpm install --frozen-lockfile`. Do not delete the lockfile to work around resolution errors. If a package script is missing, inspect that package's `package.json`.

## API will not start

- Verify `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` are present and match the same environment.
- Check PostgreSQL reachability and `pnpm --filter @repairproof/api db:migrate:status`.
- Production startup requires Redis for shared throttling. Check `REDIS_URL`, credentials, TLS settings and `RATE_LIMIT_KEY_PREFIX`.
- Check port collisions (`API_PORT`/`PORT`) and `API_TRUST_PROXY_HOPS` range.
- Review structured logs using `X-Request-ID`; redact tokens, PII and signed URLs before sharing.

## Browser cannot call API

Check `VITE_API_URL`, `API_CORS_ORIGIN`, browser console/network status, API health and exact Supabase public configuration. Vite values are compiled into the client; restart/rebuild after changing them. Do not add a service-role secret to a `VITE_*` key.

## Authenticated endpoint returns unauthorized/forbidden

Confirm token is fresh and issued by the configured Supabase project. Then inspect local profile, active organization membership, role and resource/case assignment. A UI route appearing does not imply access. Do not work around a denial by changing tenant IDs or querying the database directly.

## Migration/client mismatch

Run `pnpm db:generate`; check migration status and that the target database is the intended local/test environment. Use committed migrations, not `db push`, for shared environments. Never reset a non-disposable database to fix a local schema mismatch.

## Evidence upload or download fails

Check private bucket existence and permissions, service-role credential on API only, size/MIME limits, signed URL expiry, API completion call, ClamAV reachability and stored evidence status. A completed browser upload is not a finalized API evidence record until completion succeeds. Do not make the bucket public as a workaround.

## Notifications remain queued

In-app persistence is separate from email delivery. Check outbox worker, notification preference, `RESEND_API_KEY`, sender verification and provider responses. A provider outage should not roll back repair state. SMS is disabled.

## Optional AI unavailable

Core repair documentation should continue. OCR and diagnostic explanation are optional, and must not be described as verified output. Check service profile/config only in an isolated environment; don't put uploaded invoices into an untrusted hosted endpoint.

## Compose cleanup

`docker compose ... down` stops containers but preserves named volumes. `down -v` removes volumes and local database/object state; use only when intentionally discarding all local data.
