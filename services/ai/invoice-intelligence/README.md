# RepairProof Invoice Intelligence

Private FastAPI service that reads an authorized invoice document and returns field-level **suggestions**. It is an OCR and parsing assistant, not an invoice verifier, evidence authority, quotation engine, or approval service.

## Data flow and trust boundary

1. The NestJS API authenticates the user, checks tenant/case access, obtains the original from private evidence storage, and only sends an evidence item that has passed the existing malware-scanning gate.
2. NestJS calls this service over a private network using `Authorization: Bearer …`. The service validates the document bytes and MIME, preprocesses/scans it, and responds with candidate values, source spans, confidence metadata, SHA-256, and an HMAC signature.
3. NestJS displays each field as unconfirmed and persists the extraction with its original evidence reference, model/service version, and review history. The AI service does not have database or object-storage credentials and does not persist invoice files.
4. A user correction is submitted by NestJS with a trusted reviewer profile header and an idempotency key. This endpoint returns a correction receipt; NestJS must persist it transactionally using `(tenant, extraction, idempotency key)` uniqueness before updating its own review state.
5. Quotation approval remains a separate explicit customer action in the NestJS quotation workflow. Neither OCR output nor human correction approves a quote or establishes invoice authenticity.

The internal bearer token is service authentication, not end-user authorization. Only the trusted NestJS backend may call this API, and only after its own user/tenant authorization. Do not publish port 8090 to the internet. Use a private network policy, TLS between hosts, secret rotation, and request-size limits at ingress.

## Extract endpoint

`POST /v1/invoices/extract` as `multipart/form-data` field `file`.

Supported formats: PDF, JPEG, PNG, WebP. Defaults: 10 MiB, 5 PDF pages, 18 MP per page, 25 second OCR timeout, 2 concurrent extractions. Configure `INVOICE_AI_*` bounds to suit the host. The reverse proxy must also enforce a request body limit because multipart parsing occurs before the route reads the uploaded file.

Response fields include `merchant`, `invoice_number`, `invoice_date`, `device_model`, `labour_charge`, `tax`, `total_amount`, and `currency`; line items include `component_description`, `quantity`, and `unit_price`. Every field has `value`, `confidence`, `confidence_kind`, `status`, and source text/page/bounding box where available.

`confidence` is an uncalibrated heuristic combining OCR word confidence and parser pattern strength. It is not a probability. `SUGGESTED` only means a parser candidate exceeded a configurable display threshold; it remains subject to human review. Missing fields are `NOT_FOUND`; lower-scoring ones are `NEEDS_REVIEW`. Arithmetic consistency may be added as a separate advisory later; it must never promote fields to verified.

## Human correction endpoint

`POST /v1/invoices/corrections` accepts a signed extraction, a map of allowed field paths to human-entered text (or `null`), optional note, `X-RepairProof-Reviewer-Id`, and `Idempotency-Key`. Reviewer identity must come from the authenticated NestJS context, never directly from a browser-provided value. The endpoint validates the HMAC and path set, then returns entries labeled `HUMAN_CORRECTED`, with no confidence and `independently_verified: false`.

This service is intentionally stateless. It requires an idempotency key and includes it in audit logs, but durable deduplication belongs in NestJS’s transaction and database unique constraint. Retries may produce a new receipt ID; callers must deduplicate before persisting. The signed extraction detects accidental/tampered review payload changes while the signing secret remains protected; it does not prove document truth or authorship.

## Local development

Python 3.11+ is supported by the dependency ranges. For actual OCR, install Tesseract with the language packs configured in `INVOICE_AI_OCR_LANGUAGES`. PDF support uses PyMuPDF.

```powershell
cd services/ai/invoice-intelligence
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
$env:INVOICE_AI_INTERNAL_TOKEN = "local-development-internal-token"
$env:INVOICE_AI_SIGNING_SECRET = "local-development-signing-secret"
uvicorn app.main:app --reload --port 8090
pytest
```

OpenAPI is available at `/docs`; liveness and readiness are `/health/live` and `/health/ready`. Tests inject a deterministic OCR adapter and do not claim to validate Tesseract model quality.

## Docker

From repository root, set strong secrets and run only when the AI feature is needed:

```powershell
$env:INVOICE_AI_INTERNAL_TOKEN = "<at-least-32-random-characters>"
$env:INVOICE_AI_SIGNING_SECRET = "<different-at-least-32-random-characters>"
docker compose -f docker/docker-compose.yml --profile ai up --build invoice-ai
```

The image installs Tesseract English and PyMuPDF, runs as a non-root user, exposes the service only on the Compose network, and has CPU/memory bounds. Keep concurrency/workers low until memory and latency are measured with representative invoices. Do not scale this synchronous OCR container by adding Uvicorn workers without revisiting memory and concurrency limits.

## Operational limitations

- Parsers are deterministic heuristics for common invoice labels and line formats, not a trained extraction model. Language, layout, handwriting, OCR quality, and number/currency conventions affect results.
- Source text is returned to support human review; handle API payloads as sensitive data. Logs contain request metadata, hashes, and reviewer/extraction IDs but not invoice field values or OCR text.
- The SHA-256 identifies exact bytes; it does not establish who created a document, whether it is genuine, or whether the described repair happened.
- Malware scanning and evidence retention are owned by the NestJS evidence workflow. This service does not replace those checks.
- Production deployment should pin resolved dependency versions through the organization’s standard lock/dependency scanning process and monitor extraction latency, timeout rate, engine failures, and review corrections by field.
