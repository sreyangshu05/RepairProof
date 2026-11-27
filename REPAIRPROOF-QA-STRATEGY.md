# RepairProof test strategy

## Test architecture

Tests are layered so fast feedback runs on every change and external infrastructure is isolated. Jest is the API unit/integration framework, Supertest is the HTTP boundary harness, Vitest is used for frontend unit tests, Playwright Python is used for browser behavior checks, and pytest is used for browser and FastAPI tests. Database integration tests must use a disposable PostgreSQL database created for CI; never point tests at shared, staging, or production data.

| Layer | Purpose and principal coverage | Tool / execution | CI gate |
|---|---|---|---|
| Unit | Business rules, DTO boundary behavior, calculations, state machine, retry/backoff, idempotency, sanitization, AI confidence handling | Jest; Vitest; pytest | Every PR |
| Integration | Prisma transactions, unique/FK/index behavior, tenant predicates, row locking, outbox + audit atomicity, object storage/scanner adapters | Jest + disposable PostgreSQL; provider fakes or local containers | Every PR on isolated DB; staging smoke after deploy |
| API contract | Versioned routes, DTO validation, response envelope/errors, auth guards, OpenAPI compatibility, idempotency headers | Supertest against Nest test app; OpenAPI diff | Every PR |
| Database | Migrations from empty and previous release, constraints, RLS/tenant predicates, concurrency, backup restore verification | Prisma CLI + PostgreSQL; backup verifier | Every schema PR; monthly restore drill |
| Authorization | Role/action matrix and cross-tenant object access for consumer, technician, shop owner, platform admin | Guard unit tests + Supertest + seeded two-tenant DB | Every PR |
| End-to-end | Consumer intake → technician diagnosis → quote → approval → repair → tests → independent verification → certificate/warranty; disputes | Playwright against local Compose/test deployment | PR smoke; nightly full flow |
| Browser compatibility | Chromium, Firefox, WebKit on supported desktop/mobile viewport profiles | Playwright projects | Nightly and release candidate |
| Responsive | 320, 360, 390, 768, 1024, 1440 px and large desktop; overflow, tables, dialogs, touch target, focus, media | Playwright viewport tests | Every UI PR |
| Accessibility | Keyboard-only workflows, semantics, focus order, dialog modality, contrast, status announcement, axe scan | Playwright + axe-core; manual assistive-tech release check | Automated on PR; manual before release |
| Performance | API p95/p99, transition contention, DB pool saturation, upload throughput, queue age under load | k6 or equivalent; staging synthetic data | Nightly baseline; release gate on regression |
| Security | Tenant isolation, IDOR, upload spoofing, XSS, CSRF, SSRF, replay/rate limits, secret leakage, dependency scan | Jest/Supertest adversarial cases; ZAP baseline on disposable deployment; dependency scanner | Every PR for deterministic checks; scheduled DAST |
| AI evaluation | Invoice field extraction and confidence calibration; diagnostic consistency evidence traceability, abstention and human review | pytest golden set + red-team fixtures; offline evaluation report | Every model/prompt/rule change; never a release substitute for human review |

## Lifecycle acceptance flows

### Core repair lifecycle

1. Customer or shop creates a `DRAFT` with tenant-owned device and complete intake.
2. Authorized shop actor submits → `SUBMITTED`; technician starts diagnosis → `UNDER_DIAGNOSIS`.
3. Submit diagnostic and complete diagnosis → `DIAGNOSIS_COMPLETED`.
4. Create versioned quotation with scoped original evidence → `QUOTATION_PENDING`; send a valid quote → `AWAITING_CUSTOMER_APPROVAL`.
5. Customer explicitly approves, rejects, or requests changes. Approval advances only via signed/recorded decision; rejected/change-request versions remain historical and revisions create new versions.
6. Approved quote permits `IN_REPAIR`; technician records repair steps, component use and post-repair tests.
7. Complete actions, passing latest tests and required original evidence → `AWAITING_VERIFICATION`.
8. A separate authorized verifier submits the checklist. A technician completion click cannot create independent verification. Passing verification allows `COMPLETED`, certificate and warranty issuance.
9. Dispute from completed case → `DISPUTED`; cancellation and terminal-state behavior are separately tested.

For each transition assert current state predicate, actor/role/tenant, preconditions, state timestamp, supporting record references, audit event, notification outbox row, and idempotent replay. Assert failed transitions write none of them. Include two concurrent calls with the same key and two with conflicting keys; exactly one state transition and one side-effect set may commit.

### Required negative scenarios

| Scenario | Expected result and invariant |
|---|---|
| Unauthorized approval/state update | 401/403 or generic not-found according to route policy; no state/audit/outbox mutation |
| Invalid lifecycle edge or missing prerequisite | 400/409; prior state and full history unchanged |
| Duplicate submission / reused idempotency key with different body | Exact retry replays stored result; changed request conflicts; one audit and one outbox event |
| Modified evidence bytes after upload | Hash mismatch or integrity check fails; asset remains quarantined/unavailable; no clean evidence record or transition prerequisite satisfied |
| Cross-organization case/device/evidence/quotation/warranty access | No object data or signed URL leaks; no writes; same behavior for guessed and nonexistent IDs where enumeration matters |
| Expired quotation/customer authorization | Cannot send/approve expired quote; an already recorded idempotent response may replay without a new write |
| Invalid warranty claim | Claim outside active period, wrong claimant/tenant, or duplicate key fails without claim/notification rows |
| Corrupted/spoofed upload | Reject wrong magic bytes, size/hash mismatch, malformed image/PDF, unsupported MIME, malware-positive/unknown scan; intent does not become verified |
| Duplicate/retried email | Provider call uses stable notification idempotency key; failed send leaves repair state committed and outbox retryable |
| Optional AI timeout, malformed response, disabled model | Core diagnosis/quote/state workflow remains available; no uncertain value is marked verified; human correction path remains available |

### Tenant and role matrix for the isolated database suite

Seed tenant Alpha and tenant Beta with distinct customers, technicians, shop owners, devices, cases, evidence, quotations, warranties, notifications, and audit events. Include a technician assigned only to one case. Run each combination as Alpha customer, Alpha technician, Alpha shop owner, Beta technician, Beta shop owner, and platform admin; customers use an unguessable authorization token rather than a general API role.

| Resource/action | Customer | Assigned technician | Shop owner | Other tenant staff | Platform admin |
|---|---|---|---|---|---|
| Case/device read | Own device or token-scoped case | Own shop and assigned cases | Own organization | Generic not-found/no data | Explicit admin API only |
| Diagnostics, quotation, actions, tests | Customer-visible records by token | Assigned cases | Own organization | No read/write | Explicit admin API only |
| Approval | Own active authorization token; one decision | Cannot impersonate customer | Cannot impersonate customer | No access | No implicit customer authority |
| Evidence list/download/upload | Permitted case evidence only; cannot upload staff evidence | Assigned case; short-lived private URL | Own organization; private URL | No metadata or URL | Audited review path only |
| Certificate/warranty/dispute | Own case record | Assigned repair work | Own organization | No access | Platform review routes only |
| Notifications, analytics, audit | Own notices only | Own scoped notices | Own organization | No access | Audited platform datasets only |

For every disallowed combination, test a real foreign object ID and a random nonexistent ID, response shape/status, absence of signed URLs, and unchanged state/audit/outbox rows. Assert tenant and technician-assignment predicates in service queries; role decorators alone are not sufficient evidence of isolation.

## API and database test design

- Build the Nest application with `Test.createTestingModule`, use Supertest, and exercise actual guards, pipes, exception filter, version header, and response transform. Keep mocks for provider boundaries but use PostgreSQL for transaction and constraint behavior.
- Seed two organizations and at least one customer, technician, shop admin, and platform admin in each applicable scope. Use opaque IDs and verify the same unauthorized outcomes for cross-tenant reads and writes.
- Integration fixtures are generated per test run and removed in `finally`/`afterAll`; use transaction rollback only where the behavior under test does not require concurrent connections. For row lock/idempotency tests use separate connections.
- Run migrations on an empty DB and from the previous released schema. Fail CI on drift, missing index/FK, unsafe destructive migration, or migration that cannot roll back during the supported rolling-deploy window.
- Use provider fakes for Resend, malware scanner, signed storage, Sentry, and local Ollama in unit tests. Run contract tests against local containers before release; no real messages, customer documents, or paid API calls in CI.

## UI and accessibility checks

Playwright should seed only explicitly labeled test fixtures, sign in using test-only auth setup, and exercise both desktop and narrow mobile. Check `document.documentElement.scrollWidth <= innerWidth`, visible and keyboard reachable actions, stable focus restoration, dialog Escape behavior, error association, accessible names, and no console/page errors. Run axe scans, but treat them as a baseline: manual keyboard and screen-reader checks are still required. Screenshot snapshots supplement assertions and must not replace behavior checks.

## Performance and AI quality gates

- Establish a baseline with a documented dataset and runtime before setting hard regression thresholds. Proposed initial release targets follow `REPAIRPROOF-SRE-OPERATIONS.md`: ordinary repair APIs p95 ≤750 ms, p99 ≤2 s; exclude file transfer and long reports. Test 1x, 2x and short burst load; inspect DB pool waits, 5xx, Redis, queue age and lock contention.
- Use synthetic tenant data with realistic skew. Include same-case mutation contention, duplicate requests, evidence upload sizes at min/median/max, and slow external provider responses.
- Invoice golden records must be legally usable/synthetic and independently labeled. Track field-level precision/recall and exact-match by field, amount/date normalization, abstention rate, calibration by confidence bucket, and reviewer correction rate. Any low-confidence field stays unverified.
- Diagnostic consistency evaluation measures rule traceability, evidence references, missing-evidence recall, contradiction precision, abstention, subgroup/device coverage, and unsafe definitive claims. No image-only truth label; clinician/technician expert adjudication is needed for gold sets.

## Current repository coverage and gaps

Implemented automated tests already cover lifecycle transition prerequisites/roles/idempotency, quotation versioning and authorization, tenant scoping in selected domains, evidence MIME/hash/malware/ownership/retention-related behavior, warranty validity, independent verification/certificate prerequisites, email retry classification, OCR service behavior, and a few frontend utilities. The integrated DB lifecycle is behind `TEST_DATABASE_URL` and is skipped when that isolated database is unavailable.

Implemented in this pass: Supertest contracts for health/readiness/metrics envelopes and authorization; role guard matrix tests; authorization-link rejection; stored-object SHA-256 re-download comparison with audit event on mismatch; Chromium Playwright smoke for role workspace navigation, keyboard focus, touch target size, and responsive overflow; a read-only performance smoke script. Cross-tenant tests remain selected service checks, not the full resource/role matrix. The integrity recheck is an explicit audit operation, not an automatic gate on every signed URL; mismatch persistence/quarantine needs a follow-up integrity state and policy before claiming continuous tamper prevention.

Still not implemented or fully run: Playwright repair lifecycle mutation flow with isolated authenticated backend fixtures, Firefox/WebKit browser runs (their binaries are unavailable here), axe-core and manual assistive-technology coverage, performance load run against a production-like API/database, migration/restore run, and an expanded adjudicated AI evaluation dataset. A guarded OWASP ZAP passive-baseline runner is provided, but it has not been executed; automated dependency scanning is not wired into CI. The current Vitest suite is only a utility test file; it is not frontend product coverage.

## Reproducible commands

From repository root (PowerShell):

```powershell
pnpm --filter @repairproof/api test --runInBand
pnpm --filter @repairproof/api run test:integration
pnpm --filter @repairproof/api typecheck
pnpm --filter @repairproof/web test
pnpm test:web:e2e
pip install -r requirements-test.txt
playwright install chromium
python -m pytest services/ai/invoice-intelligence/tests -q
pnpm perf:smoke
# Passive DAST: local target by default; remote requires explicit -AllowRemoteTarget.
./scripts/run-zap-baseline.ps1 -Target http://localhost:3001
```

Database integration requires a fresh disposable PostgreSQL database configured using `TEST_DATABASE_URL`; never supply the production `DATABASE_URL` to the integration test command. Browser, accessibility, load, DAST, and full DB migration tests are planned gates, not currently available commands.

## Execution record

Executed 22 November 2026 (Asia/Kolkata):

| Command | Actual result |
|---|---|
| `pnpm --filter @repairproof/api test --runInBand` | PASS: 20 suites passed, 1 database integration suite skipped; 99 passed, 1 skipped. Initial failures exposed stale expectations and a missing technician notification after customer decision; assertions/mocks were corrected and notification implemented transactionally. |
| `pnpm --filter @repairproof/api run test:integration` | SKIPPED: 1 suite, 1 test because `TEST_DATABASE_URL` is not configured. No database integration result is claimed. |
| `pnpm --filter @repairproof/api typecheck` | PASS. |
| `pnpm --filter @repairproof/api build` | PASS. |
| `pnpm --filter @repairproof/web test` | PASS: 1 file, 3 tests (formatting utility tests only). |
| `pnpm --filter @repairproof/web build` | PASS after workspace touch-target corrections. |
| `python -m pytest apps/web/tests/e2e/test_workspaces.py -q` | PASS: 17 Chromium tests across 320, 360, 390, 768, 1024, 1440, and 1920 px; checks role navigation, focus trap/Escape restore, touch targets, and overflow. Initial run found 36 px brand and 40 px search targets; both were raised to 44 px and the suite passed. |
| `node --check scripts/perf-smoke.mjs` | PASS: performance harness syntax check. |
| `node scripts/perf-smoke.mjs` against local Vite `http://127.0.0.1:5173/`, 1 second, concurrency 2 | 778 GETs, 0 request failures, p95 3.8 ms. This was a frontend dev-server harness smoke, not an API or production performance result. |
| `python -m pytest services/ai/invoice-intelligence/tests -q` | PASS: 9 tests; 118 deprecation warnings from the installed FastAPI/Starlette stack. |

Firefox and WebKit binaries were not installed, so browser compatibility was not tested in those engines. No axe or assistive-technology checks were run. The performance script was syntax-checked and smoke-run only against the local Vite dev server; it was not run against an API/PostgreSQL deployment. The ZAP runner was not run. Full DB integration remains skipped. No failures were hidden or marked as passing.
