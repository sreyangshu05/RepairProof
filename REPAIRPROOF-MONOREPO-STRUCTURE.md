# RepairProof Monorepo Structure

**Status:** Proposed repository convention  
**Architecture:** pnpm TypeScript monorepo; React web app; NestJS modular monolith; PostgreSQL/Prisma; optional Python AI worker; Docker deployment.  
**Principle:** Organize by deployable application and domain ownership. Create a package or service only when it has a real consumer and a stable contract.

This document describes a target layout, not a mandate to create every placeholder now. The current repository already contains `apps/web` (Vite React), `apps/api` (NestJS), `packages/shared`, and `docker/`. Keep those working boundaries and migrate incrementally. In particular, do not add a FastAPI application until an approved AI use case exists.

## 1. Target repository tree

```text
repairproof/
├── apps/
│   ├── web/                         # React + TypeScript user-facing app
│   └── api/                         # NestJS modular monolith (HTTP + worker entrypoints)
├── services/
│   └── ai/                          # Optional Python/FastAPI AI adapter/worker (later)
├── packages/
│   ├── contracts/                   # Public transport types and versioned API contracts
│   ├── validation/                  # Shared runtime schemas for boundary validation
│   ├── config-typescript/           # Shared TS compiler presets, if duplication warrants it
│   └── config-eslint/               # Shared lint config, if duplication warrants it
├── database/
│   ├── prisma/                      # Canonical schema, migrations, seed entrypoints
│   └── scripts/                     # Backup/restore/check utilities (no credentials)
├── tests/
│   ├── e2e/                         # Cross-app black-box journeys
│   ├── contract/                    # API contract compatibility tests
│   └── fixtures/                    # Synthetic, non-PII test data and builders
├── docs/
│   ├── architecture/                # Architecture and ADRs
│   ├── api/                         # API usage and generated OpenAPI artifacts, if checked in
│   ├── operations/                  # Deploy, backup, recovery, incident runbooks
│   ├── security/                    # Threat model, data classification, retention
│   └── product/                     # Product requirements and research
├── infra/
│   ├── docker/                      # Dockerfiles, Compose for local development
│   ├── proxy/                       # Local reverse proxy config, only if needed
│   └── deploy/                      # Small provider-neutral deployment templates/scripts
├── scripts/                         # Root developer/CI helpers with no domain logic
├── .github/workflows/               # CI automation (or equivalent CI provider)
├── .env.example                     # Safe variable names and local defaults only
├── .gitignore
├── .npmrc
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── turbo.json                       # Optional task cache; add only if repo task time warrants it
```

The tree intentionally separates `apps` (user-facing deployables) and `services` (optional runtime with a different language/runtime). An alternative is `apps/ai`; choose one convention and keep it consistent. Here `services/ai` signals that it is a separately deployed optional capability, while the core business backend remains one modular monolith.

## 2. Major directory responsibilities and boundaries

### `apps/web/` — frontend application

**Responsibility:** Technician/shop workspace and public customer authorization/certificate pages. React and TypeScript, responsive/mobile-first.

**Belongs here:** Route/page composition; feature UI; browser state; API client; session integration; image resize and upload UX; design-system components used only by this app; frontend assets and app-specific config. Suggested feature shape:

```text
apps/web/src/
├── app/ or routes/                  # Route composition (framework-dependent)
├── features/
│   ├── auth/
│   ├── devices/
│   ├── cases/
│   ├── evidence/
│   ├── quotations/
│   ├── repair-tracking/
│   ├── verification/
│   └── public-certificate/
├── components/                      # Generic UI primitives and layout
├── lib/                             # API client, session, formatting
└── styles/
```

**Must not belong here:** Prisma/database access, authorization enforcement, service secrets, business-critical state transition rules, direct object-store admin credentials, or AI provider credentials. Client checks are usability only.

**Communication:** Calls the versioned Nest REST API using generated/shared contracts. Uploads bytes only to narrowly scoped signed object URLs returned by the API. Imports `@repairproof/contracts` and `@repairproof/validation` only for browser-safe schemas/types.

**Framework note:** The current app is Vite + React Router. Keep it for the MVP unless Next.js provides a clear need (server-rendered public pages, BFF cookie boundary, etc.). A Next.js move changes the route/config files, not module ownership.

### `apps/api/` — backend application

**Responsibility:** NestJS modular monolith; owns business rules, identity mapping, tenant authorization, transactional database changes, public projections, and integration adapters.

**Belongs here:** HTTP controllers, DTO mapping, module composition, guards/policies, domain/application services, Prisma repository adapters, worker bootstrap and job handlers, email/storage/PDF provider adapters, config validation, health endpoints.

```text
apps/api/src/
├── main.ts                          # HTTP bootstrap
├── worker.main.ts                   # Background worker bootstrap
├── app.module.ts                    # HTTP composition root
├── worker.module.ts                 # Worker composition root
├── modules/
│   ├── identity-shop/
│   ├── devices/
│   ├── cases/
│   ├── evidence/
│   ├── quotations/
│   ├── customer-authorization/
│   ├── repair-tracking/
│   ├── verification/
│   ├── certificates/
│   ├── notifications/
│   ├── files/
│   ├── audit/
│   └── outbox/
├── platform/                        # cross-cutting logging, config, HTTP errors
└── config/                          # environment schema and typed config
```

Within a business module, use a consistent pattern only as the module grows:

```text
cases/
├── cases.module.ts
├── http/                            # Nest controllers and transport mapping
├── application/                     # use cases and transaction orchestration
├── domain/                           # invariants, state machine, domain types
└── infrastructure/                  # Prisma repository / provider adapters
```

Small modules need not create empty layers. Do not use generic folders like `helpers`, `misc`, or `common` as dumping grounds.

**Must not belong here:** React components; shared UI state; unrelated AI model training code; provider credentials committed to source; direct cross-module writes that bypass the owning module; giant `AppService`/single repository with all feature behavior.

**Communication:** REST at the application boundary; internal Nest module ports/application services and versioned domain events/outbox for cross-module effects. All database writes go through the owning module's repository and transaction boundary. The HTTP and worker processes use the same application code and database, not a network call between them.

### `services/ai/` — optional AI/ML service

**Responsibility:** Later, provide a bounded, asynchronous inference capability using Python/FastAPI. It is not part of the MVP and must not become a second owner of RepairProof business state.

**Belongs here if activated:** FastAPI routes for internal inference/job health; model/provider adapters; preprocessing; model version metadata; Pydantic request/response schemas; isolated Python dependencies; Dockerfile; unit tests and model cards/evaluation notes.

**Must not belong here:** Case lifecycle, quotes, authorization, certificate issuance, customer account source of truth, or independent write access to the production business database. No autonomous mutation of core records.

**Communication:** Nest outbox worker submits minimal, consented, redacted job data over authenticated internal HTTPS or a queue adapter and stores returned advisory results in PostgreSQL. Use explicit schemas, timeouts, idempotency, size limits, and a kill switch. The FastAPI app may be absent from the tree until there is a validated use case.

### `packages/contracts/` — shared API/transport contracts

**Responsibility:** Browser-safe API request/response shapes, enums that are truly shared, OpenAPI-derived client types, and contract versioning.

**Belongs here:** Stable public API DTO schemas/types; generated API client types; shared enum string values where drift would be harmful; compatibility notes.

**Must not belong here:** Prisma model exports, Nest decorators, database entities, provider SDKs, React components, secrets, or rules that should be enforced only by the server. A shared type does not grant authorization.

**Communication:** Imported by web and API at compile time. The API remains runtime authority; CI contract tests ensure actual OpenAPI output matches published contracts. Avoid a dependency from contracts back to either application.

### `packages/validation/` — shared runtime schemas

**Responsibility:** Browser-safe runtime validation for transport inputs and forms, using one selected schema library (for example Zod), with server revalidation.

**Belongs here:** Reusable shape/format constraints, parse helpers, schema exports aligned to API contract versions.

**Must not belong here:** Tenant authorization, database lookups, file content verification, business-state transition permission, duplicated service logic, Prisma/Nest imports, or provider secrets. Schema validation cannot prove a user may access a resource.

**Communication:** Web uses schemas for early feedback; Nest parses/validates at trust boundaries. API performs contextual/domain checks after schema parsing. If packages become coupled or schemas cause bundle bloat, keep server-only schemas inside the relevant API module instead.

### `database/prisma/` — persistence schema and migrations

**Responsibility:** Canonical Prisma schema, generated migration history, and controlled seed tooling.

**Belongs here:** `schema.prisma` (or a Prisma-supported multi-file schema organized by domain), `migrations/`, development-only seed scripts, schema documentation. Generated client output belongs in ignored build output/node_modules.

**Must not belong here:** API business services, hand-edited generated Prisma client, production data dumps, credentials, routine runtime scripts that bypass module authorization.

**Communication:** `apps/api` consumes generated Prisma client through its persistence adapter. CI checks migrations and schema/client generation. One release migration job applies migrations before compatible app rollout; API replicas never race to migrate.

**Current repo migration:** The Prisma schema currently appears in both `apps/api/prisma/schema.prisma` and `apps/api/src/prisma/schema.prisma`. Establish one canonical file, update Prisma config/scripts, compare content, and remove the duplicate only as an explicit migration after confirming no differing schema changes. Do not keep two editable sources.

### `docs/` — product and engineering documentation

**Responsibility:** Human-readable source of truth for architecture, product scope, interfaces, operations, and security decisions.

**Belongs here:** `architecture/` (including this architecture and ADRs), `product/` (PRD, MVP, research), `api/`, `operations/`, `security/`, diagrams and runbooks. Keep docs close to code only for focused package-level usage.

**Must not belong here:** Secrets, real customer records, unreviewed generated noise, or a second implementation of executable rules.

**Communication:** Links from PR descriptions and package READMEs; CI can check links/diagram syntax if tooling is added. Architecture decisions should be updated when implementation materially differs.

### `infra/` — Docker and deployment infrastructure

**Responsibility:** Reproducible local infrastructure and deployment definitions, separate from business code.

**Belongs here:** `docker/` Dockerfiles and Compose; local proxy config if needed; provider-neutral deploy templates, deployment scripts, health/secret wiring documentation.

**Must not belong here:** Runtime business logic, checked-in `.env` secrets, production data, unexplained one-off manual console instructions as the only deployment path. Avoid adding Kubernetes/Terraform solely for appearance at a small pilot scale.

**Communication:** Builds app packages from the monorepo, injects validated config at runtime, connects to managed Postgres/object store/identity/email. Local Compose should work without cloud credentials where practical.

### `tests/` — cross-boundary automated tests

**Responsibility:** Verify externally observable multi-package behavior and contract compatibility.

**Belongs here:** `e2e/` proof-chain journeys; `contract/` OpenAPI/consumer compatibility; `fixtures/` synthetic builders and test uploads. Keep focused unit tests beside the module they exercise (`*.spec.ts`, `*.test.ts`).

**Must not belong here:** Production implementation, shared mutable real-world data, tests that depend on developer secrets, or snapshots that encode private data. Avoid duplicating unit suites in root tests.

**Communication:** Tests start app containers or a test app harness, use isolated disposable PostgreSQL and fake storage/mail adapters, then verify API/UI behavior. CI runs unit/type/lint checks first and heavier integration/e2e checks in a separate job.

### Root and supporting directories

- `scripts/`: cross-package developer/CI automation only (codegen orchestration, local environment checks); no feature logic.
- `.github/workflows/`: CI pipelines; use protected secrets and least privileges. Other CI providers can replace this directory without changing source ownership.
- `node_modules`, `dist`, `.next`, `.turbo`, coverage and generated output: disposable artifacts, ignored and never hand-edited.
- `docker/`: current location; move to `infra/docker/` only when touching deployment layout, and update docs/CI references atomically.

## 3. Domain module ownership and communication

| Module | Owns | May depend on | Must not own |
|---|---|---|---|
| `identity-shop` | Profile, shop, membership, roles | identity provider adapter | case workflow |
| `devices` | device data and intake facts | shop policy, file intent port | evidence bytes |
| `cases` | case aggregate, status machine, assignment | device/shop ports, outbox | quote internals |
| `evidence` | evidence metadata, annotations, integrity status | file port, case access policy | raw object credentials |
| `quotations` | versioned quote and line items | case transition port, outbox | customer token lifecycle |
| `customer-authorization` | hashed token, expiry, response record | quote/case application ports | login/session credentials |
| `repair-tracking` | ordered steps and parts used | case policy, evidence reference | inventory/POS |
| `verification` | QC run and checklist facts | case policy | certificate mutation |
| `certificates` | sealed disclosure snapshot and public projection | verification read port, file/PDF port | changing sealed facts |
| `files` | storage provider and signed URL policy | object-store SDK | case business rules |
| `notifications` | templates, preferences, delivery state | email adapter, outbox | synchronous transaction delivery |
| `audit` / `outbox` | append-only audit and durable work intent | PostgreSQL | being a generic event bus for every internal method call |

Prefer explicit application-service interfaces to importing another module's Prisma model/repository. Use a domain event when another module must react after a committed change; keep simple same-transaction invariants in one owning use case. Avoid circular module imports.

## 4. Package management and workspace configuration

Use pnpm workspaces with a single root lockfile and pinned package manager version. All internal packages use `workspace:*`; package names are scoped `@repairproof/<name>`. Do not use npm/yarn lockfiles alongside `pnpm-lock.yaml`.

Example `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
```

Keep Python dependency management separate (for example `pyproject.toml` plus a committed lock file) within `services/ai`; Node package installation must not attempt to manage Python packages. Pin the Python runtime/container base independently.

Root `package.json` should be private and provide orchestration, not runtime dependencies for all applications. Recommended scripts (adapt names to actual package scripts):

```json
{
  "private": true,
  "packageManager": "pnpm@10.19.0",
  "scripts": {
    "dev": "pnpm -r --parallel --if-present dev",
    "build": "pnpm -r --if-present build",
    "lint": "pnpm -r --if-present lint",
    "typecheck": "pnpm -r --if-present typecheck",
    "test": "pnpm -r --if-present test",
    "test:e2e": "pnpm --filter @repairproof/e2e test",
    "db:generate": "pnpm --filter @repairproof/api db:generate",
    "db:migrate:dev": "pnpm --filter @repairproof/api db:migrate:dev",
    "db:migrate:deploy": "pnpm --filter @repairproof/api db:migrate:deploy",
    "db:seed": "pnpm --filter @repairproof/api db:seed",
    "clean": "pnpm -r --if-present clean"
  }
}
```

The root lockfile and Node version are authoritative. Add a task runner such as Turborepo only when builds/checks are slow enough to benefit from dependency-aware caching; pnpm recursive scripts are enough at current scale.

Suggested `.npmrc`:

```ini
shared-workspace-lockfile=true
save-exact=false
strict-peer-dependencies=true
```

Use each app/package's own `package.json` for direct dependencies. Do not rely on accidental hoisting; import a dependency only if the importing package declares it.

## 5. Environment configuration and secrets

Commit `.env.example` with variable names, safe local defaults, and descriptions only. Ignore `.env`, `.env.*` except `.env.example`, certificates, private keys, service-role tokens, and database dumps. Validate required variables at application startup with a typed schema and fail fast with a redacted error.

Suggested config separation:

```text
apps/api/.env.example       # API runtime variable documentation if app-specific
apps/web/.env.example       # browser-exposed values only; public prefix required
services/ai/.env.example    # only after AI service exists
```

For the current single local setup, keeping one root `.env.example` is simpler. Names should communicate exposure:

- `DATABASE_URL`, `DIRECT_URL`: server/migration only; never `NEXT_PUBLIC_` or `VITE_`.
- `SUPABASE_URL`, public anon key: may be browser-visible if intentionally designed; service-role key and JWT secret are API-only.
- `API_BASE_URL`: browser/public API address; do not confuse with internal service URL.
- `OBJECT_STORAGE_*`, email credentials, signing secrets: server-only.
- `NEXT_PUBLIC_*` or `VITE_*`: treated as public build-time values; never put secrets there.

Local Docker Compose may read an untracked root `.env`. Production values belong in the host/platform secret manager or protected deployment secrets. Rotate credentials, use separate development/staging/production projects, and avoid copying production PII to developer machines.

## 6. Naming conventions

- Directories: lowercase `kebab-case` (`customer-authorization`, `repair-tracking`). Avoid mixed singular/plural; use plural for collections/features (`devices`, `cases`, `certificates`).
- Nest modules: `<feature>.module.ts`; controller/service names pluralized consistently (`CasesController`, `CasesService`); one module per domain boundary, not per table.
- React feature folders: lowercase `kebab-case`; components `PascalCase.tsx`; hooks `useThing.ts`; tests colocated as `Thing.test.tsx`.
- Contracts/schemas: `<resource>.contract.ts` and `<resource>.schema.ts`; export public names with explicit version or namespace when breaking shapes (`CaseSummaryV1`).
- Database: Prisma model names singular PascalCase, fields camelCase, enum values uppercase; SQL identifiers generated consistently. Use migrations for all persisted changes.
- Python: package/module names `snake_case`; classes `PascalCase`; type annotations required at service boundaries.
- Environment variables: uppercase `SCREAMING_SNAKE_CASE`; prefix by service only when needed to prevent collisions.
- Avoid vague names (`common`, `utils`, `helpers`, `types`) unless tightly scoped (for example `cases/domain/case-types.ts`).

## 7. Testing layout and pyramid

```text
apps/web/src/features/cases/*.test.tsx        # UI/component and client behavior
apps/api/src/modules/cases/**/*.spec.ts       # domain/application unit tests
apps/api/test/**/*.e2e-spec.ts                # Nest HTTP + test DB integration
tests/contract/**/*.test.ts                   # OpenAPI/consumer compatibility
tests/e2e/**/*.spec.ts                        # intake-to-certificate journey
services/ai/tests/                            # Python tests only when service exists
```

Use fast unit tests for state-machine, tenant policy, token lifecycle, quote math, and certificate immutability. Integration tests use disposable Postgres and test adapters. E2E tests cover a small number of complete user journeys. Never make tests rely on the free-tier cloud database or email/storage provider.

## 8. CI and release scripts

Minimum pull request pipeline: frozen lockfile install; formatting/lint; typecheck; unit tests; Prisma schema/client validation; contract generation/diff; build all changed packages. A protected release pipeline builds immutable Docker images, runs migration compatibility checks, applies migrations as a one-shot job, deploys API/web/worker, then checks health. Integration/e2e can run on PRs with disposable local services or on a scheduled job if resource constrained.

Suggested local scripts:

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm lint && pnpm typecheck && pnpm test
pnpm db:generate
pnpm db:migrate:dev
docker compose -f infra/docker/compose.yaml up --build
```

Migration rule: expand schema -> deploy code compatible with old/new columns -> backfill -> contract in a later release. Do not rename/drop a field in the same release that first deploys code no longer using it if rollback is expected.

## 9. Incremental adoption from current repository

1. Keep current `apps/web`, `apps/api`, `packages/shared`, root pnpm workspace and lockfile.
2. Split `packages/shared` into `packages/contracts` and `packages/validation` only when schema ownership is ready; keep a temporary compatibility export to avoid a broad one-shot rewrite.
3. Choose one Prisma schema location, update scripts and Docker build context, and remove the duplicate after verifying no differences.
4. Move product, architecture, research, and MVP markdown into `docs/product/` and `docs/architecture/` as a separate doc-only change, or leave root links during transition.
5. Move `docker/` to `infra/docker/` only with all Compose/CI/document links updated.
6. Keep current app as React SPA; Next.js is a framework decision, not a prerequisite for the target monorepo boundaries.
7. Add `services/ai/` only when product research approves a bounded human-reviewed AI capability. Do not add Redis or a message broker just to populate the tree.

## 10. Architecture rules to keep the monorepo maintainable

1. Apps may depend on shared packages; shared packages may not depend on apps.
2. The API owns authorization and persistence. The frontend never imports Prisma.
3. Domain modules own their tables and write paths; cross-module reads/writes use explicit application interfaces.
4. External systems are hidden behind adapters so a free-tier provider can be replaced.
5. API and worker are two entrypoints of the same Nest application code until an independently owned scaling/deployment requirement appears.
6. No microservices, broker, Redis, Kubernetes, or AI runtime without a specific requirement and an ADR describing the operational cost.
7. Generated artifacts are reproducible, ignored where appropriate, and never manually edited.
