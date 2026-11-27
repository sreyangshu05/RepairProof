# Database and migrations

## System of record

PostgreSQL is the authoritative store for profiles, organizations/memberships, devices, repair cases and lifecycle history, diagnostics, quotation versions/decisions, evidence metadata, components/replacements, tests, verification/certificates, warranties/claims, notifications/outbox, disputes, audit events, consent and feature configuration. Private evidence bytes live in private object storage; PostgreSQL stores object keys, hashes and metadata rather than embedding file bytes.

The API Prisma schema is `apps/api/prisma/schema.prisma`. Its synchronized source-tree copy is `apps/api/src/prisma/schema.prisma`; keep both aligned when changing the data model. Committed migration SQL lives under `apps/api/prisma/migrations/`.

## Integrity and tenancy

Domain rows carry organization/case relationships and services scope queries from the authenticated profile and active membership. The application layer, not a caller-supplied `organizationId`, determines tenant context. Cross-tenant authorization tests exist for selected services/routes; they are not proof that every role/resource combination has exhaustive coverage. Keep foreign keys and unique constraints in the schema, use transactions for multi-record workflow changes, and preserve history instead of deleting approved quotes, evidence history, or audit records.

Review `REPAIRPROOF-DATABASE-DESIGN.md` for the intended full entity model and `apps/api/prisma/schema.prisma` for what is actually persisted. Any difference should be documented and resolved against migrations before claiming the design fully shipped.

## Migration procedure

1. Make schema changes in the API Prisma schema.
2. For local development, run `pnpm --filter @repairproof/api db:migrate`; review generated SQL and migration name.
3. Run `pnpm db:generate`, API typecheck, and relevant database-backed tests against a disposable database.
4. Commit schema and migration together. Do not use `prisma db push` to evolve shared/production schemas.
5. Deployment applies committed SQL using `pnpm --filter @repairproof/api db:migrate:deploy` before new API traffic is switched on, as encoded in the production workflow/compose path. Review backward compatibility and lock duration for large changes.
6. Verify migration status and application readiness. Never roll back by manually editing production data; use a forward fix unless the migration has a reviewed, safe down procedure.

## Connection configuration

`DATABASE_URL` is for application traffic and may use a provider pooler. `DIRECT_URL` is intended for Prisma migration operations and should reach PostgreSQL directly. Keep credentials separate by environment. TLS and provider firewall/network restrictions must be configured at the database provider/deployment layer.

## Backups and retention

Backups are a deployment/provider responsibility and are not demonstrated merely by Compose persistence. Production readiness requires documented backup frequency, retention, encrypted offsite copy, restore test, RPO/RTO owner, and storage-object retention alignment. See [release readiness](release-readiness-2026-11-23.md) and [incident response](incident-response.md). Never delete rows with cascading behavior without understanding audit, certificate, legal hold, and evidence retention consequences.

## Safe local data

Seed/fixture data is development-only, fictional, and must never be exported into production. Keep test DB separate (`TEST_DATABASE_URL`), disposable, and migrated. Do not run destructive integration suites against any shared or live database.
