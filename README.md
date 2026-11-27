# RepairProof

RepairProof is a repair documentation and verification platform prototype. Its repository contains a React web client, a NestJS modular-monolith API, PostgreSQL/Prisma data model, integrations for private evidence storage and notification delivery, and optional isolated Python invoice OCR and diagnostic-assistance code. This README describes the checked-in implementation; it is not a claim that RepairProof is deployed or production launch-ready.

## Current status

- The API, web app, Prisma schema/migrations, Docker development stack, and CI workflow are present.
- Authentication is backed by Supabase Auth. Repair records and audit data are persisted in PostgreSQL.
- The API validates repair state transitions and quotation decisions in server-side services and transactions. Evidence metadata is persisted; object bytes use private Supabase Storage.
- Email is an optional outbox delivery integration; in-app notifications are persisted. SMS is disabled.
- Price intelligence and diagnostic consistency are decision-support features with explicit limitations. The reviewed device-rule catalog is empty; do not treat its results as manufacturer-grounded. LLM explanations default off.
- Invoice OCR is an optional standalone FastAPI service and is not called by the NestJS API.
- Public certificate lookup is available. Customer bearer-link authorization is disabled unless explicitly enabled and reviewed.
- The latest release assessment records unresolved blockers. Do not infer production readiness or a successful deployment from a successful local build. See [release readiness](docs/release-readiness-2026-11-23.md).

## Repository guide

- [Architecture](docs/architecture-overview.md)
- [Local development](docs/local-development.md) and [environment reference](docs/environment-setup.md)
- [Database and migrations](docs/database.md)
- [API reference](docs/api-reference.md), [authentication](docs/authentication.md), and [authorization](docs/authorization-model.md)
- [Deployment](docs/deployment-guide.md)
- [Security policy](SECURITY.md), [contribution guide](CONTRIBUTING.md)
- [Proprietary license](LICENSE.md)
- [Troubleshooting](docs/troubleshooting.md), [incident response](docs/incident-response.md)
- Product and operations documents are indexed in [`docs/`](docs/).

## Prerequisites

- Node.js 20 or newer (API package currently specifies 20.19+)
- pnpm 10.19.0 (Corepack recommended)
- Docker Desktop / Docker Engine with Compose
- Supabase project credentials for authenticated application flows; optional integrations need their own accounts

## Quick start

```powershell
corepack enable
corepack prepare pnpm@10.19.0 --activate
Copy-Item .env.docker.example .env
docker compose -f docker/docker-compose.yml up --build
```

The Compose stack exposes the web app at `http://localhost:5173` and API at `http://localhost:3001`; Swagger is at `/api/docs`. Review the sample environment and replace required Supabase/database values before testing authenticated flows. For separate local processes, see [local development](docs/local-development.md).

## Common commands

```powershell
pnpm install --frozen-lockfile
pnpm dev:api
pnpm dev:web
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Do not point migrations, integration tests, or seed commands at production data. Some checks may expose existing failures; report actual output rather than treating a command being configured as proof it passes.

## License and support

No open-source license or staffed production support commitment is established by this repository. For vulnerability reporting and incident handling, see [SECURITY.md](SECURITY.md) and [incident response](docs/incident-response.md).
