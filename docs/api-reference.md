# API reference

## Source of truth and conventions

The generated OpenAPI document at `GET /api/docs` is authoritative for deployed controller DTOs and schemas. This markdown is a domain index and can lag code; inspect controller decorators/services before relying on an operation. Routes are resource paths without a `/v1` prefix. Version selection is the `X-API-Version: 1` header (version 1 is default). Include `Authorization: Bearer <Supabase access token>` except where noted.

Successful API responses generally use `{ "success": true, "data": ... }`; errors use `{ "success": false, "error": { "code", "message", "details", "path", "requestId", "timestamp" } }`. Health metrics are Prometheus text, not this JSON envelope. Request IDs are returned via `X-Request-ID`. DTO validation transforms inputs, strips no unknown keys silently, and rejects non-whitelisted properties.

## Endpoint map

| Area | Current route families | Access |
|---|---|---|
| Health | `GET /health/live`, `/health/ready`, `/health/metrics` | Live/ready public; metrics require configured protection |
| Auth | `POST /auth/signup`, `/login`, `/otp/request`, `/otp/verify`; `GET /auth/me` | Auth provider operations; `me` bearer-authenticated |
| Profile/org | `/users/me`, `/organizations/current`, `/organizations/current/members` | Authenticated; membership/role checked |
| Devices | `GET/POST /devices`, `GET/PATCH/DELETE /devices/:id` | Authenticated; tenant and ownership/assignment policy applies |
| Repair cases | `GET/POST /cases`, `POST /cases/intake`, `GET /cases/workspace`, `GET /cases/:id`, `PATCH /cases/:id/status`, `POST /cases/:id/assign` | Authenticated; scoped role and workflow rules apply |
| Diagnostics | `/cases/:caseId/diagnostics` and `/complete` | Authenticated case access; completion prerequisites enforced server-side |
| Quotations | `/cases/:caseId/quotations` (create/list), `POST .../:quoteId/send` | Authenticated shop/case policy; customer decisions are distinct authorization flows |
| Approvals | `GET /approvals/pending` | Authenticated; current user scope |
| Evidence | `/cases/:caseId/evidence/upload-intents`, upload completion, list, `/:evidenceId/download`, deletion request, annotation | Authenticated, case-scoped; objects private |
| Repair work | `/cases/:caseId/steps`, `/components`, `/components/replace`, `/tests`, `/verification` | Authenticated; service-enforced case/role policy |
| Certificates | `POST /cases/:caseId/certificate`; `GET /certificates/:certificateNumber` | Issuance requires authorized workflow; public lookup returns only certificate-safe fields |
| Warranty/disputes | `/warranties`, `/cases/:caseId/warranty`, `/warranties/:warrantyId/claims`, `/administration/...disputes...` | Authenticated; owner/admin scope |
| Notifications | `/notifications`, `/preferences`, `/:id/delivery`, `/:id/read` | Authenticated, recipient-scoped |
| Analytics | `/analytics/consent`, `/summary`, `/product-summary` | Consent/user and platform-admin policies; data is pseudonymized where implemented |
| Price/consistency | `/price-intelligence/benchmark`, transaction and admin review routes; `/cases/:caseId/diagnostic-consistency` | Authenticated and role-specific; decision support only |
| Feature flags | `/feature-flags/effective`; `/platform/admin/feature-flags...` | Effective values user context; management platform admin |
| Platform admin | `/platform/admin/overview`, organizations, users, disputes, audit-events | Explicitly provisioned platform admin only |
| Authorization links | `/authorize/:token...` | Disabled by default; gated by `CUSTOMER_AUTHORIZATION_ENABLED` |

Exact verbs, request/response DTOs, guards and route details are visible in Swagger. The table intentionally does not invent a consumer dashboard endpoint. Some web application screens may have incomplete API wiring; the client UI is not evidence that a matching server route exists.

## Idempotency and workflow

For supported sensitive operations, follow the DTO and endpoint-specific idempotency/version fields shown in OpenAPI; a client must not assume every POST is idempotent. State transition, approval, evidence completion, and certificate creation have service-level guards. Do not use arbitrary status writes to bypass the lifecycle. Technician “complete” is not independent verification.

## Errors and retrying

Do not retry non-idempotent writes unless an endpoint accepts an idempotency key or supports a safe request identity. On `429`, respect throttling; on `5xx`, retry only boundedly with backoff for safe/idempotent operations. Preserve `X-Request-ID` when reporting failures. Never log bearer tokens, authorization-link tokens, evidence URLs, or sensitive case payloads.
