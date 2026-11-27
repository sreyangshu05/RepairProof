# RepairProof GitHub Actions delivery

## Pipeline behavior

`.github/workflows/ci-cd.yml` runs the checks on pull requests and pushes to `development`, `staging`, and `main`. A production container build is verified in CI for every branch. The image publishing/deployment job is downstream of all required check jobs, so any failed or skipped check blocks deployment.

| Stage | Automated work | Deployment rule |
| --- | --- | --- |
| Pull request | Formatting, lint, type checks, API/web unit tests, isolated PostgreSQL migrations and integration tests, Chromium browser suite, invoice OCR tests, Node/Python dependency audits, Docker builds | No deployment or package push |
| Development | Same checks; publish immutable commit-SHA images to GHCR | Pushes to `development` deploy automatically after checks |
| Staging | Same checks; publish immutable commit-SHA images to GHCR | Pushes to `staging` deploy automatically after checks |
| Production | Run the complete pipeline from `main`, publish SHA-tagged images | Production deployment is available only by manually dispatching the workflow on `main`; the job verifies a merged PR into `main` and a non-author approval submitted after the PR's latest commit, then waits for `production` environment protection rules |

No `latest` tag is deployed. A production deployment is never triggered by a push to `main`; it requires an explicit workflow dispatch on the protected branch. Keep pull-request review and required CI checks enabled on `main` so dispatch can only select reviewed code.

## Repository and environment setup

Create GitHub Environments named exactly `development`, `staging`, and `production`. For every environment, set these variables:

- `PUBLIC_APP_URL`: that environment's public HTTPS origin.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`: public browser configuration used to build that environment's frontend image. The anon key is public; never put the service-role key in a `VITE_` variable or build argument.
- `DEPLOY_PATH`: absolute deployment directory on its Linux host, restricted to letters, digits, `/`, `_`, and `-` (for example `/opt/repairproof/staging`).
- `DEPLOY_KNOWN_HOSTS`: pinned SSH host key line(s), obtained and verified out of band.

Set these environment secrets:

- `DEPLOY_HOST`: deployment server DNS name or IP.
- `DEPLOY_USER`: restricted deployment account.
- `DEPLOY_SSH_PRIVATE_KEY`: key authorized for that account.

The server needs Docker Engine and Compose v2, a GHCR login with read-only package access, and a private `$DEPLOY_PATH/.env.production` file with database, Redis, Supabase service-role, email, observability, and retention configuration. The workflow uploads only the production Compose file and deployment script into a commit-specific release directory. It does not upload runtime secrets. Make the runtime environment file readable only by the deployment account (`chmod 600`). Keep staging and production hosts, deployment directories, databases, Supabase projects, and credentials separate.

Configure GHCR package access so the repository's `GITHUB_TOKEN` can publish packages. On each host, authenticate to GHCR with a dedicated read-only token and protect the Docker credential store. The workflow SSH account can control Docker and therefore has root-equivalent access on that host; use a dedicated host/account and network policy.

Protect `main` with pull-request-only changes, at least one independent approval, dismissal of stale approvals after new commits, and required successful checks for `Format, lint, types, unit tests`, `PostgreSQL migrations and API integration`, `Chromium browser and responsive checks`, `Invoice intelligence tests`, and `Dependency security scans`. Require every `Production container build verification` matrix entry (`api`, `migration-runner`, `web`, and `invoice-ai`) as well. Restrict the `production` environment to `main`, add required reviewers, and enable prevention of self-review where the repository plan supports it. The workflow independently verifies an approved review for production so it fails closed even if an environment reviewer feature is unavailable. GitHub documents that required environment reviewers are not available for private repositories on GitHub Free. Do not add a `push` production trigger as a workaround. [GitHub environment review and plan availability](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments).

Dependabot opens grouped weekly update PRs for GitHub Actions, the pnpm workspace, and invoice AI Python dependencies. Those PRs use the same CI gates as ordinary changes.

## Migration and release safeguards

- Production uses the separately tagged `migrate` image and `prisma migrate deploy`. It waits for healthy Postgres, Redis, and ClamAV before starting the migration runner, and starts API/web containers only after the migration command succeeds.
- Integration CI applies all checked-in migrations to a fresh disposable PostgreSQL database, then runs both lifecycle and HTTP-to-PostgreSQL integration suites. Never point `TEST_DATABASE_URL` at staging or production.
- Use expand/contract migrations for rolling deployments: add nullable columns/tables/indexes first, deploy code that can use old and new schema, backfill in a separate controlled job, then remove obsolete schema only in a later reviewed release after all old application versions are gone.
- Review generated SQL for table/column drops, enum rewrites, long locks, large-table rewrites, and non-transactional operations. Include a recovery plan in the PR and run the migration against a recent staging restore. Do not make a migration that requires old code to fail during the rolling window.
- Take and verify an off-host database backup before production migration. Compose volumes are not backups. Evidence objects in Supabase Storage need their own recovery/retention plan.
- The migration runner is forward-only. Neither deployment failure nor application rollback executes a Prisma down migration or restores the database automatically. If a migration itself fails or partially applies, stop promotion and use the reviewed database recovery plan.

## Rollback

`scripts/deploy-compose.sh` records only successful deployed SHAs. If API or web health checks fail after a successful migration, it pulls the previous application images and restores API/web while leaving the schema as migrated. This rollback is safe only when migrations are backward-compatible with the previous application image.

For a manual production rollback, dispatch `.github/workflows/rollback.yml` from `main` and provide the full commit SHA of a previously deployed release. The workflow confirms the SHA is on `main` and had a successful push CI run, then requests production environment protection and invokes the remote deploy script with `--skip-migrations`. It does not revert the database. If the target is not present in the host's successful deployment history, the script refuses the rollback.

If automatic application rollback fails, keep traffic disabled or route it to a known healthy prior deployment, preserve logs, and follow the incident/database recovery runbook. Do not guess at manual SQL reversal.

## Verification status and limits

Local verification includes frontend and API formatting checks, frontend and API lint, Python Ruff formatting and lint, shared/API/web/mypy type checks, API and web builds, 101 API unit tests (3 skipped), 3 frontend unit tests, and 9 invoice AI tests. Both development and production Compose configurations parsed successfully. The disposable PostgreSQL workflow, hosted Chromium workflow, dependency-review action, GitHub API production approval gate, GHCR publishing, remote Compose deployment, and rollback were not executed against GitHub or a deployment host. The local Docker daemon was unavailable, so image build/startup is not claimed as verified. Configure protected branches, environments, and host secrets before using deployment jobs; do not mark checks optional to get a deployment through.
