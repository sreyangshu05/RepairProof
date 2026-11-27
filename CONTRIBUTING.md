# Contributing

## Before editing

Read [architecture](docs/architecture-overview.md), [authorization](docs/authorization-model.md), [database workflow](docs/database.md), and the relevant domain notes. Keep the modular monolith; introduce a separately operated service only for a concrete requirement and documented decision.

## Development conventions

- Use pnpm 10.19.0 workspace commands; commit `pnpm-lock.yaml` changes with dependency edits.
- Keep Nest controllers thin. Put validation in DTOs, business invariants in services and durable changes in Prisma transactions.
- Scope every tenant query from authenticated context. Add denial tests for cross-tenant and wrong-role access.
- Preserve repair history and auditability. Do not silently overwrite approved quotations or treat hashes as proof that a source document is truthful.
- Keep external providers behind replaceable adapters. Make failure/retry behavior explicit and avoid secrets in logs.
- In the web app, use the shared API client and design tokens; fixture data must stay clearly labeled and must not masquerade as verified records.
- Update docs when behavior changes; identify disabled, optional and unverified capabilities accurately.

## Change workflow

1. Create a focused branch and change.
2. Add or update unit/integration/API/UI/accessibility tests appropriate to the change. Never point destructive tests at shared/live data.
3. Run relevant commands and report actual outcomes, including failures. Don't claim passing checks that were not run.
4. For schema edits, commit Prisma schema and reviewed migration together. Avoid production `db push`.
5. Review security, privacy, localization, mobile, keyboard, reduced motion and error states.
6. Open a PR with purpose, behavior, data/security impact, migration/rollback notes and verification evidence.

## Contribution limitations

Do not add fake reviews, performance claims, certifications, public business details, customer data or secret values. No contributor license, public support SLA or production release process beyond repository workflows is asserted here; maintainers must establish those before accepting external contributions or launch.
