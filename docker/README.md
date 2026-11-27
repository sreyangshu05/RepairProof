# RepairProof containers

This directory contains the local development stack and a single-host production Compose deployment. Docker Compose builds images from the repository root; image build stages copy only source/manifests required for the build. Runtime credentials are supplied when containers start and are never Docker build arguments.

## Prerequisites

- Docker Desktop or Docker Engine with Compose v2.
- 8 GB RAM recommended for the full stack (ClamAV and optional invoice OCR are memory intensive).
- For local AI invoice extraction, Python is not required on the host; the container bundles its runtime and OCR engine.

## Start development

From the repository root on Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev-up.ps1
```

Or on Linux/macOS:

```sh
./scripts/dev-up.sh
```

The first run copies `.env.docker.example` to the ignored `.env` and generates two random, local-only invoice-AI tokens. The scripts preserve any existing `.env`. To start invoice OCR as well:

```sh
docker compose --project-directory . -f docker/docker-compose.yml --profile ai up --build --detach
```

Services:

| Service | Local endpoint | Notes |
| --- | --- | --- |
| React/Vite frontend | `http://localhost:5173` | Hot reload; `/api` proxies to NestJS |
| NestJS API | `http://localhost:3001` | `/health/live`, `/health/ready`, and `/api/docs` |
| PostgreSQL | `localhost:5432` | Local development credentials are fixed and must never be reused |
| Redis | `localhost:6379` | Shared rate-limit store; AOF and named volume enabled |
| ClamAV | private Compose network | Malware scanning for uploaded evidence |
| Invoice AI (optional) | private Compose network, port 8090 | Enable with Compose profile `ai` |

Postgres and Redis health checks must pass before the API starts. The API runs checked-in Prisma migrations with `prisma migrate deploy` before its watch process starts. Database, Redis, ClamAV signatures, and dependency folders use named volumes. Stop containers without deleting development data:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev-down.ps1
```

or `docker compose --project-directory . -f docker/docker-compose.yml down`. Do not add `-v` if you want to keep local database/cache data.

Authentication and private object storage use the implemented Supabase adapters. Placeholder values leave those integrations unavailable. To exercise real login or evidence uploads, supply a development Supabase project, a private evidence bucket with the MIME and size restrictions described in [the evidence design](../apps/api/EVIDENCE-MANAGEMENT.md), and its development-only keys in the ignored `.env`. No public bucket or service-role key belongs in the browser. There is no MinIO adapter in this repository, so a local MinIO container would not be usable by the application. `EVIDENCE_STORAGE_DISABLED=true` only keeps local health/readiness usable when storage credentials are absent; it does not make upload endpoints work.

The optional `VITE_ENABLE_DEMO_FIXTURES` setting defaults to false. Enable only when you want clearly labeled fictional demo records.

## Production build and single-host deployment

Prepare an ignored production environment file from the placeholder template:

```sh
cp .env.production.example .env.production
```

Replace every placeholder. Generate distinct URL-safe database/Redis passwords and independent AI service secrets, for example with `openssl rand -hex 32`. Keep `.env.production` outside version control and restrict it to the deployment operator. Supabase service-role credentials and AI signing keys are runtime secrets; never pass them as Docker build arguments or copy them into images.

Then validate and launch:

```sh
docker compose --env-file .env.production -f docker/docker-compose.prod.yml config
docker compose --env-file .env.production -f docker/docker-compose.prod.yml up --build --detach
```

For invoice OCR, add `--profile ai` to both commands and set both AI secrets. The optional AI image is network-isolated; the NestJS API does not currently call this invoice service, so starting its profile alone does not activate OCR in RepairProof workflows. The migration job runs `prisma migrate deploy` and must finish successfully before the API starts. Compose separates the public `edge` network from an internal `data` network; the web container cannot connect directly to PostgreSQL or Redis. The web Nginx container serves the frontend and proxies `/api` to the API. `WEB_PORT` defaults to 8080. Put a maintained TLS reverse proxy/load balancer in front of the web port, configure it to overwrite forwarded headers, configure trusted proxy hops to match the actual topology, and set `PUBLIC_APP_URL` to the public HTTPS origin. Do not expose PostgreSQL or Redis publicly.

The production Compose file is a single-host starter, not a substitute for managed secrets, TLS termination, monitored off-host backups, restore drills, and host hardening. Back up PostgreSQL and private evidence objects independently. Named volumes provide persistence, not backups. Pin image digests in release deployment files for byte-for-byte image reproducibility; current Compose tags track supported minor lines.

## Environment variables

| Variable | Used by | Required | Purpose |
| --- | --- | --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | production Postgres, API, migrations | production | Database credentials. Keep password URL-safe hex because Compose constructs the Prisma URL. |
| `DATABASE_URL`, `DIRECT_URL` | API/Prisma | production | In production Compose these are built from the Postgres variables; external deployments should set a pooled runtime URL and a direct migration URL. |
| `REDIS_PASSWORD` | production Redis/API | production | Redis authentication for shared rate limiting. |
| `API_PORT` | API | optional | Internal NestJS listen port (3001 in Compose). |
| `API_CORS_ORIGIN` | API | production | Exact allowed web origin. |
| `API_TRUST_PROXY_HOPS` | API | production | Exact trusted proxy count; adjust when ingress topology changes. |
| `PUBLIC_APP_URL` | API | production | Public HTTPS origin used for CORS and certificate links. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | API and browser auth | for authentication | Supabase Auth project URL and public anon key. The anon key is not a secret. |
| `SUPABASE_SERVICE_ROLE_KEY` | API only | for evidence storage | Private server-side Storage access. Never expose it to Vite/browser variables. |
| `EVIDENCE_STORAGE_BUCKET` | API | for evidence storage | Existing private Supabase Storage bucket. |
| `EVIDENCE_MAX_FILE_BYTES`, `EVIDENCE_RETENTION_DAYS` | API | optional | Evidence limits and retention configuration. |
| `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS` | API | Compose default | Malware scanner endpoint/timeout. |
| `RESEND_API_KEY`, `EMAIL_FROM` | API | optional | Email delivery credentials and verified sender. |
| `SENTRY_DSN` | API | optional | Error reporting endpoint. |
| `METRICS_ENABLED`, `METRICS_BEARER_TOKEN` | API | optional | Enable and protect the private metrics endpoint. |
| `INVOICE_AI_INTERNAL_TOKEN`, `INVOICE_AI_SIGNING_SECRET` | AI container | production AI profile | Independent random secrets, at least 32 characters each. |
| `INVOICE_AI_MAX_DOCUMENT_BYTES`, `INVOICE_AI_MAX_PDF_PAGES`, `INVOICE_AI_MAX_CONCURRENT` | AI container | optional | OCR processing resource limits. |
| `VITE_API_URL` | web build | optional | Browser API base path; production defaults to same-origin `/api`. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | web build | for browser login | Public Supabase URL and anon key are embedded in browser assets by design; never put a service-role key in a `VITE_` variable. |
| `VITE_APP_URL` | web build | optional | Public app origin used by browser auth redirects. |
| `WEB_PORT`, `API_PORT`, `POSTGRES_PORT`, `REDIS_PORT` | development Compose | optional | Local host port overrides. |

Do not put private credentials in variables prefixed with `VITE_`; Vite embeds those values into the public browser bundle.
