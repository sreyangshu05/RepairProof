# Local development

## Requirements

Use Node.js 20 (API requires 20.19+) and pnpm 10.19.0. Docker Compose is the easiest route for PostgreSQL, Redis and ClamAV. Supabase credentials are needed to exercise real authentication and object storage. Keep all credentials in ignored local `.env` files.

## Docker Compose path

```powershell
Copy-Item .env.docker.example .env
# Edit .env; use local-only values and your own Supabase project credentials.
docker compose -f docker/docker-compose.yml up --build
```

Open `http://localhost:5173`, `http://localhost:3001/health/ready`, and `http://localhost:3001/api/docs`. Optional invoice OCR is behind the `ai` Compose profile and requires the documented internal token/signing secret. Do not expose that service publicly.

To stop while retaining local database volume: `docker compose -f docker/docker-compose.yml down`. `down -v` deletes local volumes; use only when intentionally resetting local data.

## Host process path

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env
# Configure DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_ANON_KEY and REDIS_URL.
pnpm db:generate
pnpm db:migrate
pnpm dev:api
```

In another terminal:

```powershell
pnpm dev:web
```

The web dev server defaults to port 5173 and API to 3001. Configure `VITE_API_URL` and CORS origins consistently. See [environment setup](environment-setup.md).

## Database workflow

Use `pnpm db:migrate` for local development migration creation/application. `pnpm db:migrate:deploy` applies committed migrations without creating new ones. `pnpm db:generate` refreshes Prisma Client. `pnpm db:studio` opens Prisma Studio. `pnpm db:push` is a local prototyping command; do not use it as a production migration strategy.

## Checks and tests

`pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:web:e2e`. API integration tests require a separate disposable `TEST_DATABASE_URL` and an already migrated schema. Do not run them against production or shared development data. A configured test script does not imply its suite currently passes; check command output and the release assessment.

## Mock data

Web demo fixtures, when enabled, are fictional and labeled as mock. They are not verified repair records, are not saved to the API, and should not be mixed with real customer data. Never put real PII or evidence in fixtures or screenshots.
