# Environment setup

Copy `.env.example` (host tools) or `.env.docker.example` (Compose) to a local ignored `.env`. `.env.hosted.example` and `.env.production.example` are templates, not live provider configuration. Never commit credentials. `VITE_*` variables are embedded in a public browser bundle and must contain public values only.

| Variable | Required when | Purpose / handling |
|---|---|---|
| `DATABASE_URL` | API | PostgreSQL runtime connection, normally pooled where provider supports it |
| `DIRECT_URL` | Prisma migration | Direct PostgreSQL connection used by Prisma CLI |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Auth/browser flows | Public project endpoint/key; anon key is not an admin credential |
| `SUPABASE_SERVICE_ROLE_KEY` | API private evidence operations | Highly privileged server-only key; never expose as `VITE_*` |
| `EVIDENCE_STORAGE_BUCKET` | Evidence enabled | Private Supabase Storage bucket name |
| `EVIDENCE_MAX_FILE_BYTES` | Evidence enabled | Upload size cap, default in example: 25 MiB |
| `EVIDENCE_RETENTION_DAYS`, `EVIDENCE_RETENTION_WORKER_ENABLED` | Retention worker | Retention duration and worker activation; validate policy before production |
| `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS` | Scanning | Private scanner endpoint and timeout |
| `REDIS_URL`, `RATE_LIMIT_KEY_PREFIX` | Production API | Shared throttling store; production startup expects Redis |
| `API_TRUST_PROXY_HOPS` | Behind ingress/proxy | Exact trusted proxy count, integer 0–10; misconfiguration affects client IP rate limits |
| `API_CORS_ORIGIN` | API | Comma-separated allowlisted browser origins |
| `API_PORT` / `PORT` | API | Local/container port; hosted runtimes commonly provide `PORT` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email delivery | Optional Resend adapter; without it email remains queued/not delivered |
| `SENTRY_DSN` | Error monitoring | Optional Sentry reporting; structured logs remain available without it |
| `METRICS_ENABLED`, `METRICS_BEARER_TOKEN` | Metrics scrape | Keep endpoint private; use a strong token and network policy |
| `PRODUCT_ANALYTICS_ENABLED`, `ANALYTICS_PSEUDONYM_SECRET` | Analytics | First-party event capture; disabled by default and requires consent path |
| `FEATURE_FLAG_ASSIGNMENT_SECRET` | Stable experiment assignment | HMAC secret; preserve while experiment assignments are active |
| `DIAGNOSTIC_LLM_ENABLED`, `DIAGNOSTIC_LLM_BASE_URL`, `DIAGNOSTIC_LLM_MODEL` | Local explanation | Optional local model only; disabled by default |
| `CUSTOMER_AUTHORIZATION_ENABLED` | Bearer authorization routes | Defaults false; enabling requires security review and scoped short-lived links |
| `PLATFORM_ADMIN_USER_ID`, `PLATFORM_ADMIN_ACTION`, `PLATFORM_ADMIN_REASON` | Admin provisioning CLI | Explicit grant/revoke operation; audit reason required |
| `INVOICE_AI_INTERNAL_TOKEN`, `INVOICE_AI_SIGNING_SECRET` | Optional OCR service | Independent internal authentication/signing secrets; never reuse API secrets |
| `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Web build/runtime | Public browser configuration; no service keys or private secrets |
| `VITE_APP_URL`, `PUBLIC_APP_URL`, `CERTIFICATE_BASE_URL` | Links/SEO/certificates | Public canonical origins; use HTTPS production domain |
| `TEST_DATABASE_URL` | API integration test | Disposable, isolated test database only |

Exact names are source-of-truth in `.env.example`, Compose files and `apps/api/src`. Optional integration flags should stay off until provider setup and failure behavior have been verified. Rotate exposed credentials immediately; do not paste secrets into issues or logs.
