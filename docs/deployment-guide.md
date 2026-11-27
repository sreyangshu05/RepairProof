# Deployment guide

## What is present

The repository contains Docker build definitions, Compose configurations, and a GitHub Actions CI/CD workflow. CI performs checks/build/security/container steps as configured. The current deployment workflow publishes GHCR images and deploys to configured SSH/Compose hosts for development/staging; production is a separately dispatched, gated path. A rollback workflow is checked in. These files do not prove a host, domain, secret set, backup, or deployment is live.

The Vercel/Render/Neon materials in [`hosted-deployment.md`](hosted-deployment.md) are a hosting option/plan; they are not confirmation of a working hosted deployment. The Docker production Compose topology is a single-host starting point, not high availability.

## Environment separation

Use distinct Supabase projects, databases, storage buckets, Redis namespaces, domains, credentials, and monitoring projects for development, staging and production. GitHub Environments should have scoped secrets; production requires reviewed changes and the configured independent approval. Do not put secrets in workflow files, image layers, build args, committed `.env` files, or frontend `VITE_*` values.

Configure HTTPS termination at a managed ingress/reverse proxy and redirect HTTP to HTTPS. Restrict database, Redis, ClamAV, and metrics endpoints to private networks. DNS records and certificates are provider-specific and must be confirmed after provisioning.

## Release procedure

1. Merge reviewed code to the protected branch; require green workflow checks.
2. Review Prisma migration SQL and compatibility. Prefer expand/contract changes: add nullable/additive structures first, deploy compatible application code, backfill, then constrain/remove in a later release.
3. Create/verify a recoverable database backup and object-storage recovery plan before risky changes.
4. Deploy to staging using the workflow and run the smoke checks below with staging credentials only.
5. Confirm release approval and dispatch production workflow. The deployment operator records commit SHA, image digest, migration IDs, approver and start/end times.
6. Verify `/health/live`, `/health/ready`, authenticated smoke paths, logs, metrics and provider health. Do not claim success until the target host reports the expected image and health.

## Migration safeguards

Run `prisma migrate deploy` from the release artifact before routing application traffic as defined by the workflow. Do not run `db push` in production. Review lock/data-loss risks; use a forward corrective migration for already-applied changes. Application rollback does not reverse database schema changes. For destructive migrations, a tested restore/forward-compatible plan is a release prerequisite.

## Smoke checks

- `GET /health/live` responds while process is running.
- `GET /health/ready` confirms required database readiness.
- `GET /api/docs` is available only as intended by deployment policy.
- Authenticate a dedicated staging account; verify its own profile and organization-scoped records only.
- Create a disposable device/case in staging, record a diagnostic/quote, verify a denied cross-tenant read, and clean up through supported retention-safe process.
- Verify private evidence upload/download authorization, malware scanning path, notification enqueue/delivery state, and Redis-backed rate limiting.
- Check application error rate, DB connections, outbox backlog, storage errors, migration status and request IDs.

These are procedures, not reported execution results. Do not execute destructive smoke tests in production.

## Rollback

Use the checked-in rollback workflow for the prior known-good immutable image digest after release lead approval. Stop/disable problematic behavior with a server-side feature flag when suitable. Confirm old application compatibility with the current schema first. Restore data only when approved recovery criteria are met; restoring a database can lose subsequent writes and requires coordinated object-store recovery. Re-run health and core read-only smoke checks and record the incident. Never roll back by resetting migrations or deleting audit rows.

## Disaster recovery prerequisites

Before launch, name accountable owners, set realistic RPO/RTO, configure encrypted automated PostgreSQL backups and independent object retention/backup, monitor success, and perform a restore exercise in an isolated environment. The repository does not establish a verified restore time or live backup status. See [incident response](incident-response.md) and [release readiness](release-readiness-2026-11-23.md).
