# RepairProof reliability and operations

## Operating model

The initial release is a modular NestJS monolith backed by PostgreSQL. Redis is an operational dependency when shared rate limiting is enabled. Evidence object storage and outbound providers are capability dependencies: their outages must fail their own operation clearly, while repair records and lifecycle transitions remain usable. Invoice OCR and diagnostic explanations are optional decision-support features. Their timeout, error, or disabled state must be surfaced as “unavailable”; never fabricate a result or prevent ordinary repair documentation.

Run API replicas statelessly. Persist business state, idempotency keys, audit records, and notification outbox rows in PostgreSQL. Do not use process memory as a job queue or source of durable state. All state-changing API requests that can be retried must require/reuse the existing idempotency mechanism and perform state changes plus audit/outbox inserts transactionally.

## Health and telemetry

- `GET /health/live` is process liveness only; it does not call dependencies. Restart only when liveness fails repeatedly.
- `GET /health/ready` checks PostgreSQL, Redis when configured (required in production), and reports private evidence bucket availability as an optional capability. A storage outage does not mark unrelated repair state writes unready.
- `GET /health/metrics` is disabled unless `METRICS_ENABLED=true`; then `METRICS_BEARER_TOKEN` is mandatory. Restrict it to the private scraper network in ingress/firewall policy. Scrape every replica. Metrics are process-local and intentionally avoid user, case, device, and file identifiers.
- HTTP completion logs use request ID, method, route template, status, and elapsed time; do not log bodies, query strings, auth headers, file names, serial numbers, or customer contact information. Route labels are templates to bound cardinality.
- Sentry is optional via `SENTRY_DSN`; sampling/tracing is intentionally not enabled by this implementation. Keep Sentry payload scrubbing enabled and exclude request bodies, cookies, and authorization headers.
- Worker success/failure heartbeats are process-local Prometheus gauges. The email outbox remains durable in PostgreSQL; queue count and oldest queued age are queried at scrape time.

Configure alert delivery through the chosen Prometheus-compatible monitoring system’s Alertmanager or equivalent. `docker/monitoring/alert-rules.yml` contains initial rules. Route page alerts to an on-call contact and ticket alerts to the operations queue. The repo does not assume a paid hosted monitor or ship credentials.

## Initial SLI/SLO targets

Measure over rolling 30-day windows after collecting a baseline. Exclude scheduled maintenance only when announced in advance; do not exclude provider failures that RepairProof can mitigate.

| SLI | Initial objective | Measurement |
|---|---:|---|
| Core API availability | 99.5% | Non-health requests; 5xx and infrastructure 503 count unavailable, ordinary 4xx count as available; track auth/validation 4xx separately to detect abuse/usability issues |
| Repair read/write latency | p95 ≤ 750 ms, p99 ≤ 2 s | API request duration histogram; exclude file transfer and explicitly long-running exports |
| Durable repair transition integrity | 100% transitions have validated state, audit event, and idempotency outcome | Transactional integration/invariant checks plus sampled audit review |
| Evidence upload completion | ≥ 99% of accepted upload intents reach verified/available or explicit terminal failure within 15 minutes | Intent state transitions; invalid files excluded |
| Notification queue freshness | 95% of eligible emails handed to provider within 15 minutes when provider configured | Outbox queued age; provider acceptance is not inbox delivery |
| Backup recoverability | Daily backup integrity check; restore drill monthly; RPO ≤ 24 h and RTO ≤ 8 h initial | Provider backup report plus verified isolated restore timing |

These are starter targets, not guarantees. Confirm provider capabilities, real traffic, and regulatory retention obligations before treating them as contractual. The current SLI histogram has route and status class but no dedicated business-event counter, so transition integrity and upload SLOs require database/audit queries or a later bounded-cardinality business metrics addition.

## Failure handling

| Scenario | Expected behavior / response |
|---|---|
| PostgreSQL unavailable | Readiness fails (503); do not accept repair mutations. Liveness remains healthy to avoid restart loops. Restore connectivity, inspect pool saturation and DB events, then verify readiness. |
| Evidence storage outage | Evidence intent/upload/finalization fails or remains explicitly retryable; do not mark evidence verified/available. Core case, quote, approval, and repair transitions can continue if prerequisites do not require that specific evidence. Reconcile pending intents after recovery. |
| Email provider failure | Transaction persists notification in outbox; provider send retries with capped exponential delay and idempotency key. Alert on oldest queue age. Repair transaction is never rolled back for delivery failure. |
| AI/OCR/explanation failure | Return a typed unavailable/low-confidence response; preserve original input and allow manual entry/review. Never infer approval, diagnosis truth, or transition from AI output. Do not include AI in liveness/readiness. |
| Duplicate request | Require idempotency key for sensitive mutation. Enforce unique key/scope in PostgreSQL and return stored prior outcome; use a transaction for mutation, audit event, and outbox. A provider idempotency key is derived from durable notification identity. |
| Interrupted upload | Keep intent as pending/quarantined with expiry; client can resume/retry only against same authorized intent/object key. Verify size, content signature/MIME, hash, and malware scan before becoming available. Expire orphan objects/intents with retention worker and reconcile after outage. |
| Background retry/restart | Claim jobs with row locks/leases (`SKIP LOCKED`), bounded attempts, backoff, and idempotent side effects. Expired locks are reclaimable. Dead-letter/terminal failures stay inspectable; do not silently delete them. Monitor worker heartbeats and queue age. |

## Database backup verification and disaster recovery

Production deployment must use a PostgreSQL provider/tier that offers automated backups and point-in-time recovery; the chosen provider is not specified in this repository. Set daily backup retention to at least 30 days initially, encryption at rest, and restrict restore permissions. Back up object storage independently with provider versioning/retention if available; database PITR cannot recover deleted evidence bytes.

1. Alert on missed provider backup completion and backup age above 24 hours. Keep database and object storage recovery configuration/documentation under restricted operator access.
2. Download a backup into an isolated restricted environment. Run `python scripts/verify-postgres-backup.py <dump> --sha256-file <dump.sha256> --max-age-hours 36`. This checks archive readability, freshness, and checksum; it does not restore data.
3. At least monthly, restore into a new isolated database with no production app credentials. Apply/verify migrations, run read-only integrity checks (`prisma migrate status`, row counts, FK checks, audit sequence consistency), and record elapsed restore time and recovered timestamp.
4. For incident recovery, freeze writes at ingress, preserve logs/audit data, select a recovery point, restore database and evidence bucket/object versions to a new environment, validate tenant isolation and evidence references, then switch application traffic only after owner approval and integrity checks.
5. Preserve the original failed environment until recovery is accepted. Reconcile notifications/jobs only after restoring; idempotency keys and outbox status must prevent duplicate external delivery.

The verification script intentionally does not connect to or modify a database. Provider-specific backup scheduling, encryption, PITR, object versioning, and failover must be configured in the selected cloud account.

## Release and incident checklist

- Deploy migrations as a separately controlled release step; verify rollback compatibility before destructive schema changes.
- Watch readiness, 5xx rate, p95 latency, DB pool/connection limits, Redis health, worker heartbeat, outbox queue age, storage errors, and provider error rates.
- Keep application shutdown graceful and allow in-flight requests/jobs to finish before termination.
- After an incident, record timeline, customer impact, data integrity checks, and follow-up actions in the incident record; do not put sensitive case details in alert payloads.
