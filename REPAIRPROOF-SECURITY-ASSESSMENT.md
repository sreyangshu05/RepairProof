# RepairProof Security Assessment

**Assessment date:** 2026-11-22  
**Scope:** Static, defensive review of the current repository: NestJS API, React web client, Prisma schema/migrations, Docker Compose, and invoice OCR service. No live system was probed. No destructive test was run.  
**Status:** Initial code review, not a penetration test, secure-code certification, or proof that the deployed system is secure.

## Executive summary

The code has useful controls: the API validates DTOs globally, authenticates through Supabase on protected routes, derives organization context from the authenticated profile, uses Prisma parameterized queries, uses Redis-backed throttling in production, stores evidence in private object storage, inspects MIME from bytes, requires malware scanning in production, and records important workflow/audit events.

However, this review found several release-blocking or high-priority risks:

1. **Critical if reachable in any deployed build:** the frontend seeds an authenticated development technician and, after any login error, stores a fake `dev-technician-token`. This creates a false-authentication UI state and encourages insecure fallback behavior; assess whether any API accepts it and remove the path from production builds.
2. **High:** authorization links are bearer credentials in URL paths; public responses include broad related records and the token itself through full-record serialization. URLs can leak through browser history, logs, referrers, copied links, and support tooling. The 14-day lifetime and token-based mutations increase impact.
3. **High:** technicians can list and modify devices within the organization without assignment-specific authorization. Several case-child controllers similarly pass `shopId` but not actor identity/role into list/read methods. A technician may access other technicians’ tenant records.
4. **High:** the invoice OCR correction service trusts `X-RepairProof-Reviewer-Id` as an identity assertion once the shared internal token is known. It does not authenticate that profile or validate the caller is a platform reviewer. It is not currently wired into the Nest API, which limits current exposure, but it is unsafe if enabled behind only the shared token.
5. **High:** local Docker Compose binds API and web ports to all host interfaces, includes fixed CORS for localhost, and Nginx sets no security headers. Compose is a development topology, not a safe internet-facing production ingress.
6. **Medium:** database-backed audit events are application-level append-only only. The same application/database credentials can mutate or delete rows; no immutable export, restricted writer role, or tamper-evident chain is visible.
7. **Medium:** the product stores staff tokens in `localStorage`, which makes any script execution in the origin an account-token theft path. No CSP, frame protection, or general security headers were found in the web Nginx config/API bootstrap.
8. **Medium:** Redis throttling is shared and required in production, but a Redis outage throws from the rate-limit store; operational behavior and bypass resistance behind proxies need explicit tests. Authentication uses an external Supabase `getUser` call on requests, so availability and abuse pressure should be measured.

No SQL injection sink was found in the reviewed API search: database access uses Prisma model APIs and the email worker’s raw SQL uses `Prisma.sql` tagged parameters. This is a source-level observation, not a guarantee about unreviewed code or dependencies.

## Severity classification

| Severity | Meaning |
|---|---|
| Critical | Likely broad compromise or authentication bypass; fix before production exposure. |
| High | Serious access-control, privacy, or integrity impact; fix before broad customer rollout. |
| Medium | Exploitable under a narrower condition or creates meaningful defense-in-depth/operational risk; prioritize before scale. |
| Low | Limited impact or hardening improvement. |
| Informational | Operational validation or design note without a confirmed vulnerability. |

## Threat model

### Assets

- Customer identity/contact data, device identifiers, symptoms, diagnostics, repair history, quotations, approvals, disputes, warranty claims, invoices, photos, and signed download URLs.
- Shop staff profiles, organization membership, inventory, case assignments, repair actions, verification records, and business analytics.
- Platform administrator powers, verification decisions, global dispute/user data, price observations, and reference-price indexes.
- Supabase access tokens, service-role storage key, Resend key, database credentials, Redis credentials, OCR shared token/signing secret, and deployment secrets.
- Audit events and evidence hashes used to support accountability and later disputes.

### Trust boundaries and data flows

```mermaid
flowchart LR
  Consumer[Consumer browser] -->|Authorization bearer URL or API token| Edge[Web host / ingress]
  Tech[Technician browser] -->|Supabase bearer token| Edge
  Owner[Shop administrator browser] -->|Supabase bearer token| Edge
  Platform[Platform administrator browser] -->|Supabase bearer token| Edge
  Edge --> Web[React static app]
  Edge --> API[NestJS API]
  API --> Auth[Supabase Auth]
  API --> DB[(PostgreSQL / Prisma)]
  API --> Storage[Private object storage]
  API --> Redis[(Redis rate limit]
  API --> Mail[Resend email]
  API --> OCR[Private invoice OCR service]
  API --> AV[ClamAV]
  Consumer -. temporary signed object URL .-> Storage
  Tech -. temporary signed object URL .-> Storage
```

The main security boundary is NestJS: client-supplied role, shop ID, and profile ID must never grant access. The OCR service is a second internal boundary and must trust authenticated NestJS identity only after the API has authorized the human and tenant.

### Adversaries and abuse cases

- Unauthenticated internet user enumerates authorization links, OTP endpoints, case IDs, or certificate endpoints; uploads oversized/malformed documents to consume CPU/storage; abuses public routes for denial of service.
- Malicious consumer reuses a forwarded/expired authorization link, changes approval payloads, or accesses another evidence ID.
- Malicious technician changes case/device/evidence IDs to access another shop employee’s records, edits shared devices, fabricates repair evidence, or attempts self-verification.
- Malicious shop owner accesses another tenant’s records, exfiltrates customer information, changes staff access, or disputes/manipulates business records.
- Compromised platform administrator performs high-impact global actions and alters or suppresses audit history.
- Malicious uploaded document contains parser exploits, polyglot content, decompression bombs, active content, or malware.
- Supply-chain attacker targets dependencies, container images, CI variables, package lifecycle scripts, or build outputs.

## Attack-surface inventory

| Surface | Exposure / trust | Key controls observed | Security concern / follow-up |
|---|---|---|---|
| Web app and static host | Public browser origin | React escaping; no `dangerouslySetInnerHTML` or direct `innerHTML` found | No CSP/security headers in `docker/nginx.conf`; localStorage bearer token; fake dev login fallback; confirm no production dev fixtures. |
| Nest API | Authenticated and public endpoints | Global validation, Supabase guard, role guard, throttler, CORS allowlist | API is directly port-bound in Compose; per-resource authorization is inconsistent; health/docs exposure policy needs deployment decision. |
| Supabase Auth | External identity provider | `getUser` validates access token; DB profile active check | Review provider MFA, password policy, session lifetime/revocation, email confirmation, refresh-token storage, and project-level rate limits. These are deployment settings. |
| Public authorization route | Bearer token in URL path | Random 24-byte token, expiry, throttles, idempotent decision flow | Token serialization/leakage, referrer/log/history exposure, broad customer response include; token is also an approval/dispute capability. |
| Evidence upload/download | Signed object URLs and service-role storage adapter | Size/type/signature validation, malware scan, quarantine, short-lived download URLs, private bucket check | Validate bucket policy in production; ensure signed upload token can only write its exact quarantine key and cannot overwrite; test races, cleanup and archive behavior. |
| Invoice OCR service | Private Docker network with shared bearer token | Strong production secret check, bounded bytes/pages/pixels, timeout, concurrency gate, signature for extraction result | Reviewer ID header not authenticated/authorized; health/docs/OpenAPI may be reachable inside network; verify ingress and caller identity controls. |
| PostgreSQL | Private data plane | Prisma, foreign keys, tenant fields, audit rows | Need DB role separation, RLS or equivalent defense in depth, backups/encryption/restore tests, migration review, audit immutability. |
| Redis | Internal | Production startup requires Redis; atomic Lua limiter | TLS/auth/ACL, network isolation, outage mode, key namespace, client-IP trust configuration need validation. |
| Email delivery | Third-party processor | Adapter, retries, idempotency, generic previews | Confirm sender domain/authentication, secrets rotation, recipient validation, email link/URL leak policy, suppression/unsubscribe requirements. |
| ClamAV | Internal scanner | Production requires scanner and rejects unscanned files | Scanner protocol is unauthenticated; keep network private, pin image by digest, patch signatures/images, cap queued bytes/concurrency. |
| Docker and package supply chain | Build/deploy | Multi-stage Dockerfiles; Node/Python runtimes | Base images use mutable tags, no non-root API runtime visible, no SBOM/signature policy or automated vulnerability scan evidence in repo. |
| Audit endpoints | Tenant/platform privileged | Separate platform/tenant audit records | Read events are not universally audited; application DB credentials can rewrite records; some metadata includes user notes/free text. |

## Findings and remediation plan

### F-01 — Fake development authentication fallback

**Severity: Critical if shipped in a reachable production build; otherwise High as a release-control defect.**  
**Evidence:** `apps/web/src/stores/auth.store.ts` initializes a hardcoded technician and development token, sets `isAuthenticated: true`, and catches all login errors by storing `dev-technician-token`. `apps/web/src/lib/api.ts` attaches the localStorage token to API requests.  
**Impact:** A production UI can present unauthenticated users as signed in and may send a predictable bearer value to backend routes. Even if the current API rejects it, it masks real auth failures and is an unsafe future trust assumption.  
**Mitigation:** Remove all dev identities/tokens and catch fallback. Make demo mode a separate local-only build guarded at compile time and ensure production build fails if demo auth is enabled. Start unauthenticated; only accept returned provider sessions.  
**Verification:** Production build grep for `dev-technician-token`, seeded account, and fallback branch; login with invalid credentials must remain unauthenticated and send no protected request.

### F-02 — Authorization bearer secret exposure and overbroad response

**Severity: High.**  
**Evidence:** `RepairCase.authorizationToken` is stored as unique plaintext. Public routes use it in the URL path. `AuthorizationService.getCaseByToken()` returns a full `RepairCase` include tree, including all non-deleted evidence metadata, device data, shop details, quotations, approvals, and change requests; it does not project a public DTO or remove `authorizationToken`. Customer evidence download also accepts this token. The token expires after 14 days.  
**Impact:** Any leaked token grants access to sensitive case details, temporary evidence URLs, and quotation decision/dispute actions. URL path tokens can enter browser history, server/proxy logs, observability traces, copied links, and referrer headers.  
**Mitigation:** Store a hash of the authorization secret, return only a narrow response DTO, omit the token from all response fields, and use short-lived, single-purpose, revocable capabilities (view, approve, dispute) with explicit expiration and rotation. Put the capability in a URL fragment or exchange it for a short-lived HttpOnly/Secure/SameSite session token, then redirect to a clean URL. Set `Referrer-Policy: no-referrer` on authorization pages; redact token paths in all ingress/API logs and traces. Require customer re-authentication for sensitive dispute/evidence actions where feasible.  
**Verification:** Public response schema must not contain any token/hash, internal IDs, unrelated PII, or evidence outside customer-visible purpose. Revoke/expire and replay tests must reject old links. Confirm URL/path redaction in proxy logs.

### F-03 — Technician access exceeds assignment boundary

**Severity: High.**  
**Evidence:** `DeviceController` allows any authenticated role to list/read/update/delete organization devices and passes only `shopId`; no `@Roles` restrictions or technician assignment predicate exist. Case child reads such as approvals, diagnostics, test results, verification, components/replacements, warranties, and analytics commonly scope by shop but not assigned technician/profile. `CaseService.findAll()` forces technician assignment filtering, but `findOne()` is assigned-only only when controller passes the technician ID; child service methods do not consistently do so.  
**Impact:** A technician may view/change another technician’s device/customer data and may read case-linked business or customer records within the same tenant. This is a broken object-level authorization risk even without cross-tenant access.  
**Mitigation:** Centralize case authorization (`canReadCase`, `canEditCase`) requiring tenant + active membership + assigned technician or explicit shop-owner authority. Pass actor ID/role into every case child service and enforce predicates in the same database query/transaction. Restrict device mutations to shop owners or authorized staff and define device assignment/ownership rules. Review all controllers lacking explicit role metadata.  
**Verification:** Build a two-technician, two-tenant matrix. Attempt every read/write with wrong tenant, same-tenant unassigned technician, revoked member, inactive user, shop owner, platform admin, and valid assignee.

### F-04 — Invoice OCR reviewer identity is caller-asserted

**Severity: High when OCR correction endpoint is network-reachable; Medium while unwired.**  
**Evidence:** `services/ai/invoice-intelligence/app/main.py` authenticates corrections using a shared bearer token, then accepts `X-RepairProof-Reviewer-Id` as a string and records it as reviewer identity. Its own README says this value must come from authenticated NestJS context, but the service itself cannot distinguish a trusted backend header from a spoofed one. No NestJS integration currently calls this service.  
**Impact:** A caller with the internal token can attribute a correction receipt to any profile and create a misleading review trail. Shared-token compromise gives broad service access.  
**Mitigation:** Keep OCR on a private network and add service-to-service identity (mTLS/workload identity) plus signed, short-lived reviewer claims bound to the request/body, tenant, extraction ID, and allowed action. The Nest API must authorize the user and build the reviewer claim itself; do not trust a browser-supplied profile header. Do not treat a receipt as persisted audit evidence until the API stores it transactionally with the human identity.  
**Verification:** Spoofed reviewer ID, non-admin reviewer, wrong-tenant extraction, expired/replayed assertion, and modified request must be rejected. Confirm OCR port is not published and network policy allows only API callers.

### F-05 — Local Compose is unsafe as public deployment topology

**Severity: High if exposed to untrusted networks; Medium for local-only use.**  
**Evidence:** `docker/docker-compose.yml` publishes API `3001:3001` and web `5173:80` on all interfaces, has no TLS ingress, and fixes CORS to localhost. `docker/nginx.conf` has no CSP, HSTS, frame, MIME-sniffing, or referrer-policy headers. Compose also runs Redis without visible password/ACL and exposes ClamAV on the default Compose network.  
**Impact:** Direct API exposure bypasses planned ingress controls/TLS; cross-origin deployments may fail or require unsafe overrides; browsers lack defense-in-depth headers. A misconfigured external deployment may expose unauthenticated docs/health and internal service topology.  
**Mitigation:** Label Compose as local development only; bind published ports to `127.0.0.1` for local use. For production, deploy behind TLS ingress/WAF with explicit host allowlists, request/body limits, security headers, private subnets, Redis ACL/TLS, and no public OCR/ClamAV endpoints. Configure exact trusted proxy hops and per-environment CORS. Add startup checks for production `PUBLIC_APP_URL`/CORS origin.  
**Verification:** Inspect rendered production topology and firewall/security-group rules; curl only local/staging endpoints to confirm headers, TLS redirects, and origin policy.

### F-06 — Audit trail can be rewritten by application/database principals

**Severity: Medium (High for regulated or disputed-evidence use).**  
**Evidence:** Audit events are ordinary PostgreSQL tables written with the same application Prisma client. No database trigger denying update/delete, append-only role separation, WORM export, signed hash chain, or immutable external sink is visible. Platform dispute list reads sensitive records without an audit-read event. Some audit metadata includes free-text notes, diagnosis, or dispute resolution.  
**Impact:** Compromised API/database credentials or privileged insider can alter historical accountability records. Audit metadata may itself leak unnecessary personal/repair data.  
**Mitigation:** Add a dedicated insert-only DB role or trigger policy for audit tables, separate migration/admin credentials from runtime, record privileged reads and exports, minimize metadata to IDs/codes/hashes, and periodically export signed batches to immutable storage or an external audit sink. Define retention/access policy and alert on audit gaps.  
**Verification:** Runtime DB role cannot UPDATE/DELETE audit rows; tampering in staging is denied and generates a security alert; each privileged data read is recorded without logging sensitive payloads.

### F-07 — Bearer access tokens are stored in localStorage

**Severity: Medium.**  
**Evidence:** `apps/web/src/stores/auth.store.ts` persists `rp_auth_token` in localStorage; `apps/web/src/lib/api.ts` reads it to set `Authorization`.  
**Impact:** Any successful same-origin script injection or compromised dependency can exfiltrate the token; localStorage tokens are also available to browser extensions and persist across restarts.  
**Mitigation:** Prefer a BFF/session-cookie model using Secure, HttpOnly, SameSite cookies with CSRF protection. If Supabase browser tokens remain necessary, minimize lifetime, use provider-supported refresh/token rotation, never place tokens in URL/storage logs, add strict CSP and dependency controls, and implement logout/revocation behavior.  
**Verification:** XSS regression test must not access a bearer token; cookie-based state-changing requests require CSRF defenses; logout invalidates/clears server session state.

### F-08 — Privileged platform dispute reads lack read auditing

**Severity: Medium.**  
**Evidence:** `PlatformAdministrationController` protects routes with `PLATFORM_ADMIN`, but `PlatformAdministrationService.disputes()` returns customer name, case number, shop, and device details and emits no `PlatformAdminAuditEvent`. Similar list endpoints should be reviewed for sensitive read auditing.  
**Impact:** Misuse of a valid platform admin account is difficult to investigate; broad data browsing has limited accountability.  
**Mitigation:** Audit sensitive list/detail/download reads with actor, purpose, scoped record count/IDs, and request ID; enforce least privilege and require step-up authentication for global exports. Do not store dispute content in audit metadata.  
**Verification:** Platform list/download access creates an append-only audit event; unauthorized or revoked admin calls fail.

### F-09 — Device data mutability and cross-tenant reference constraints need hardening

**Severity: Medium.**  
**Evidence:** Device update uses `findOne(id, shopId)` followed by `update({where:{id}})` and accepts `intakePhotos` as arbitrary client strings. Device ownership is shop-based; there is no tenant composite FK between a case’s `deviceId` and `shopId` in the shown schema, while `RepairCase` has its own `shopId` and device relation.  
**Impact:** Concurrent changes may weaken the intended scope check; arbitrary photo URLs may become a stored unsafe reference; inconsistent/malicious data relationships could attach a case to a device from another tenant if the service path is bypassed or future code regresses.  
**Mitigation:** Use atomic scoped update predicates (`id AND shopId AND deletedAt IS NULL`), record device changes in audit history, replace `intakePhotos` URL strings with managed Evidence foreign keys, and enforce composite `(deviceId, shopId)` referential integrity at the database layer.  
**Verification:** Cross-shop device IDs are rejected by create/update and database constraints; external/script URLs are not rendered or persisted as trusted media.

### F-10 — Security headers and CSRF policy are not explicit

**Severity: Medium.**  
**Evidence:** No Helmet/security-header middleware or headers in `docker/nginx.conf` were found. The API currently uses Authorization bearer headers and CORS credentials; if deployment switches to cookies, no CSRF token/origin checking is present in the reviewed bootstrap.  
**Impact:** Missing CSP/frame/referrer protections increase XSS clickjacking and token-referrer impact. Cookie migration without CSRF controls would introduce state-changing cross-site requests.  
**Mitigation:** Add a tested CSP (start with report-only), `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` or strict origin policy, HSTS at TLS ingress, and safe cache rules for sensitive pages. Define CSRF tokens and strict Origin checks before any cookie-authenticated mutation.  
**Verification:** Automated header checks on production-like routes; CSP violation reports reviewed; state-changing cross-origin requests rejected.

### F-11 — Resource-consumption and rate-limit resilience need verification

**Severity: Medium.**  
**Evidence:** Global Redis throttling is configured at 120/minute, with stricter auth and authorization route limits. `RedisThrottlerStorage` throws if not configured; production requires Redis. The OCR service has a semaphore and document limits but public liveness/readiness/docs are enabled in the service app.  
**Impact:** Attackers can target password/OTP/authorization routes, force expensive Supabase token checks, consume OCR CPU/memory, or cause request failures during Redis outage. IP limits may be bypassed if `trust proxy` is misconfigured; shared NAT can also cause collateral blocking.  
**Mitigation:** Add account/email and IP/device layered limits for login/OTP, progressive delay and provider abuse controls, quotas for upload/OCR bytes and concurrency, bounded queueing, Redis failure policy (fail closed for sensitive auth endpoints, documented behavior elsewhere), and trusted-proxy validation. Restrict OCR docs/health to private monitoring or sanitize readiness data.  
**Verification:** Test burst, distributed-IP, shared-NAT, Redis outage/reconnect, spoofed forwarded headers, and upload/OCR saturation in isolated staging.

### F-12 — Dependency/image supply-chain posture is not evidenced

**Severity: Medium pending scans.**  
**Evidence:** Repository uses pnpm lockfile and Dockerfiles, but base images include mutable `node:22-alpine`, `nginx:alpine`, `redis:7-alpine`, `clamav/clamav:1.4`, `ollama/ollama:latest`, and `python:3.14-slim`. No CI dependency/container scan, SBOM, image-signing, or provenance workflow was found. This assessment did not query vulnerability databases or run a package audit.  
**Impact:** A compromised or vulnerable dependency/base image can undermine auth, parsing, storage, or deployment secrets. Mutable tags make builds non-reproducible.  
**Mitigation:** Add scheduled and PR dependency scanning (pnpm audit plus a vetted scanner), Python dependency scanning, container image scanning, SBOM generation, image digest pinning, signed build provenance, renovate/update review, and a documented emergency patch SLA. Do not use `latest` for production.  
**Verification:** CI produces SBOM and fails on defined critical/high thresholds; images are digest-pinned and signed; dependency exceptions have owner/expiry.

### F-13 — OCR and diagnostic input may contain prompt/parser injection data

**Severity: Medium if optional local LLM is enabled.**  
**Evidence:** OCR parses untrusted PDF/image content; diagnostic explanation uses structured recorded evidence and local Ollama with an explicit instruction that text is untrusted, omits customer symptom content, limits evidence detail, constrains citation IDs, and pins hostnames to localhost/ollama. LLM is disabled by default.  
**Impact:** Malicious OCR/document or repair notes could influence model output if later included, create misleading text, or consume resources. A misconfigured local model endpoint may expose data if hostname restrictions are relaxed.  
**Mitigation:** Keep LLM disabled until threat review; preserve output as untrusted escaped text; never use output to authorize transitions; validate citations against supplied evidence; enforce exact endpoint allowlist, egress policy, request/response size and timeout; test adversarial instructions in OCR/notes.  
**Verification:** Prompt-injection corpus yields only bounded advisory text, no action/tool use, and no model-driven workflow state changes.

## OWASP Top 10 (2021) mapping

| Category | Review result |
|---|---|
| A01 Broken Access Control | **Confirmed risk:** technician assignment boundary gaps; platform global reads; public bearer authorization capability. Add centralized object authorization and role matrix tests. |
| A02 Cryptographic Failures | TLS/encryption-at-rest are deployment-dependent and unverified. Tokens in localStorage and URL capabilities increase exposure. Verify DB/storage encryption, TLS, key rotation, hashed authorization secrets. |
| A03 Injection | No raw unparameterized SQL sink found in source search; Prisma is used. Review stored XSS paths and OCR/parser/PDF/image libraries with security tests. |
| A04 Insecure Design | Fake dev auth fallback, long-lived broad capability link, broad response serialization, and insufficient per-object policy are design issues. |
| A05 Security Misconfiguration | Missing web security headers; public port bindings in Compose; mutable image tags; document/health exposure policies unclear. |
| A06 Vulnerable and Outdated Components | Not assessed by a vulnerability database scan. Add CI and scheduled scans. |
| A07 Identification and Authentication Failures | Supabase guard checks current provider identity and active DB profile. LocalStorage token and fake fallback are serious weaknesses. MFA/session/revocation config not verified. |
| A08 Software and Data Integrity Failures | Prisma parameterization and evidence hashes help integrity, but hash does not prove evidence truth; audit rows are mutable; no build provenance evidence. |
| A09 Security Logging and Monitoring Failures | Structured logs redact exception details and token route paths in API exception logs, but privileged read coverage and immutable retention are incomplete. Verify proxy/provider logs too. |
| A10 SSRF | No user-supplied fetch target found in primary API paths; Ollama URL is constrained to local hostnames and HTTP with redirects disabled. Test future URL ingestion and uploaded document remote references; validate deployment egress. |

## Authentication, session, and authorization notes

- Protected requests call Supabase `getUser` and look up the local active profile and current membership. This is stronger than trusting an unverified JWT role claim.
- Effective role is derived from `OrganizationMembership` or a provisioned active `PlatformAdmin` row. Client role is not used as authority.
- Profile has a single `shopId`; membership schema supports multiple organizations, but request context currently resolves one profile shop. Confirm product requirements before adding multi-organization switching.
- Roles are controller-level in some areas and service predicates in others. Missing controller `@Roles` is not necessarily authorization bypass where service checks apply, but it requires an explicit matrix review.
- Cookie CSRF is not currently the main model because API auth uses bearer headers. If the browser moves to cookies, add CSRF tokens and Origin checks before rollout.
- Authorization token entropy is 192 bits from `randomBytes(24)`, which makes brute-force guessing impractical; leakage and overbroad capability are the main issue, not token entropy.
- Rate limits are keyed at global throttler level and public sensitive routes have method-specific stricter limits. Verify exact key derivation and `trust proxy` chain in the deployed ingress.

## Security test cases

These are proposed, **non-destructive** test cases. Use unit/integration tests or an isolated staging environment with synthetic data only. Do not send exploit traffic to production or third-party systems.

### Authentication and sessions

1. Invalid credentials leave app unauthenticated; no fake token or seeded user is stored.
2. Missing, malformed, expired, revoked, wrong-audience, and wrong-issuer bearer tokens fail closed.
3. Disabled/deleted profile, revoked membership, deleted shop, and inactive platform-admin grant cannot access protected routes.
4. Login/OTP error messages do not reveal account existence; brute-force and resend limits work by IP and normalized account key.
5. Logout/refresh behavior cannot resurrect a revoked session; browser token/session is not present in URLs, logs, or error reports.

### Object and tenant authorization

6. Tenant A token with Tenant B IDs cannot read, update, delete, upload, annotate, or issue download URLs for B’s device, case, quote, evidence, warranty, dispute, or price observation.
7. Technician A cannot access Technician B’s case or child records in the same shop without explicit delegation.
8. Revoked technician cannot access existing signed-upload intent completion or evidence download.
9. Shop owner can access only their organization; platform admin receives only documented platform routes.
10. Customer token for case A cannot download evidence from case B, request changes to an old quote, approve twice, or create duplicate disputes.
11. Case/device shop mismatch is rejected by both API validation and database foreign key.
12. Device `intakePhotos` cannot store unsafe external/script URLs as trusted objects.

### Injection, browser, and request handling

13. Stored notes, names, diagnostics, annotation text, dispute descriptions, OCR values, and filenames render as text; payloads such as `<img src=x onerror=...>` do not execute.
14. DTOs reject unexpected properties, oversized nested arrays, malformed enums, invalid IDs, and non-finite numeric values.
15. SQL metacharacters in search/filter fields do not alter query behavior; raw-query test strings return ordinary no-match results.
16. CORS allows only configured exact origins; untrusted origin cannot read credentialed responses.
17. If cookie auth is introduced: cross-site form and fetch requests cannot change state without valid CSRF token and Origin.
18. CSP, frame-ancestors, nosniff, referrer, and HSTS headers are present in the production web/edge response.

### Evidence and SSRF

19. Fake MIME, polyglot, truncated, malformed, encrypted, oversized, excessive-page, and decompression-bomb files are rejected within bounded memory/time.
20. Upload signature cannot overwrite an existing evidence object or write outside the exact quarantine key; expired/replayed intent fails.
21. No evidence receives `CLEAN` status if ClamAV is unavailable, malformed, times out, or returns an unexpected response in production.
22. Infected/quarantined/expired/rejected objects are removed or remain inaccessible until cleanup; cleanup failure emits an alert.
23. Cross-tenant and unassigned users cannot get signed URLs; URL lifetime and cache/referrer handling match policy.
24. User-controlled URLs cannot trigger server-side outbound fetches; Ollama config rejects external, credentialed, HTTPS downgrade, and redirect targets.

### API abuse and resilience

25. Login, OTP, public authorization reads/mutations, evidence issuance, OCR, and expensive analytics limits work across multiple API replicas using Redis.
26. Spoofed `X-Forwarded-For` does not bypass limits when API is directly reachable or behind configured proxy hops.
27. Redis outage produces the documented fail behavior and never silently falls back to per-process counters in production.
28. OCR concurrency, CPU/memory, document bytes/pages/pixels, and timeout remain bounded under concurrent valid and invalid inputs.
29. Idempotency keys cannot replay a different body, actor, tenant, or operation; concurrent duplicate requests create one state transition/approval.

### Audit, roles, and operations

30. Runtime DB role cannot update/delete audit rows; migration role is separate and tightly scoped.
31. Platform admin global data reads, evidence downloads, user disablement, organization verification, dispute decisions, and price reviews are auditable.
32. Tampering with audit export/hash batches is detectable; missing event sequences trigger an alert.
33. Secrets are absent from Git history, web bundles, Docker layers, logs, crash dumps, and API error bodies; rotate sample credentials in an isolated environment.
34. CI reports JavaScript and Python dependency vulnerabilities, container CVEs, SBOM, and signed artifact provenance.

## Remediation checklist (ordered)

### P0 — Before any production exposure

- [ ] Remove dev user/token initialization and login fallback from production code/build.
- [ ] Replace broad public authorization response with explicit DTO; exclude capability token and internal/customer-irrelevant fields.
- [ ] Reduce and scope authorization capabilities; implement revoke/rotate and clear URL/referrer/log leaks.
- [ ] Add assigned-technician checks to all case child resources; limit device access and mutation by role/assignment.
- [ ] Keep OCR correction endpoint private and add cryptographically verifiable service/reviewer identity before integrating it.
- [ ] Do not publish Compose API/OCR/Redis/ClamAV ports in production. Require TLS ingress and security headers.

### P1 — Before broad customer onboarding

- [ ] Add shared authorization policy helpers and a full route-by-role/tenant matrix test suite.
- [ ] Move browser auth to safer session handling or document and harden localStorage token lifecycle.
- [ ] Add CSP/security headers and regression tests; sanitize customer authorization page referrers/cache.
- [ ] Add DB-enforced same-tenant foreign keys for case/device/evidence links and atomic scoped updates.
- [ ] Separate runtime and migration DB roles; make audit storage append-only and externally retained.
- [ ] Audit sensitive platform reads, especially dispute and invoice-review endpoints.
- [ ] Enforce network ACL/TLS/ACLs for Redis and private internal services; document outage behavior.
- [ ] Configure auth MFA/session TTL/revocation and identity-provider abuse policies.
- [ ] Add file-upload adversarial tests and alert on scanner/storage cleanup failures.

### P2 — Ongoing security operations

- [ ] Add dependency/container scanning, SBOMs, pinned image digests, signed builds, and patch SLAs.
- [ ] Review logs/telemetry for PII/token redaction across ingress, Supabase, Resend, Sentry, and backups.
- [ ] Run independent penetration testing against an authorized staging environment before major launches.
- [ ] Test backup restore, data deletion/retention, incident response, credential rotation, and tenant breach procedures.
- [ ] Review role changes, platform administrator grants, and access every quarter; alert on unusual exports/download patterns.

## Out of scope / unverified

- No live cloud, DNS, firewall, TLS, Supabase, storage bucket, Redis, email, OCR, or production environment was accessed.
- No dependency CVE audit, container scanner, DAST, fuzzing, penetration test, or external authorization test was run.
- Provider configuration for MFA, token TTL/revocation, object encryption, backups, network restrictions, rate-limit rules, and log retention cannot be inferred from repository code.
- OWASP mapping is a code-review prioritization, not a claim that every category was exhaustively tested.
