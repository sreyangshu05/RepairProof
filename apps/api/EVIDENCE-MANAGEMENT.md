# RepairProof evidence management

Evidence enters through a case scoped upload intent. The API checks the caller, case assignment, purpose, MIME allowlist and expected byte count, creates a short lived signed upload into private quarantine, then reads the uploaded bytes itself. It verifies the byte count and file signature, computes SHA-256, scans with ClamAV, and promotes only accepted content into the originals path. Clients cannot supply an evidence URL or mark a file clean.

## Storage setup

Configure a private Supabase Storage bucket named `repairproof-evidence` (or set `EVIDENCE_STORAGE_BUCKET`). Set its size limit to no more than `EVIDENCE_MAX_FILE_BYTES` (default 25 MiB) and its MIME allowlist to include exactly the supported formats:

- `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- `application/pdf`
- `video/mp4`, `video/quicktime`

The API checks the bucket configuration before issuing upload or download links. Do not make the bucket public. Set `SUPABASE_SERVICE_ROLE_KEY` only in the API runtime secret store; never expose it in web build variables. The browser uses the Supabase anon key only to consume the one object path and token returned by the upload intent. Signed downloads expire after 60 seconds. Upload intents expire after 15 minutes.

Production requires `CLAMAV_HOST` and a reachable ClamAV `clamd` endpoint. The supplied Compose topology runs ClamAV as a private service and waits for its health check before starting the API. Scanner failures fail closed. The API rejects infected content and does not make unscanned production content available. Keep ClamAV signatures current and monitor scanner availability and signature update failures.

## Evidence record rules

The uploaded bytes are stored as an `ORIGINAL`; an original is not overwritten by image processing. A trusted processing worker may create a `THUMBNAIL` or `PROCESSED` child linked by `derivedFromId`, with its own content hash and scan result. Derived files must never be presented as the original. The worker method is internal and no client route permits arbitrary derived asset creation.

The SHA-256 digest records whether the stored bytes match the bytes inspected at upload time. It cannot establish who made the file, when the photographed event happened, whether the scene was staged, or whether any document is truthful. `malwareStatus: CLEAN` means the scanner found no known malware; it is not a trustworthiness or authenticity verdict. Quotation, component replacement, test result, and certificate references accept only clean, managed originals. Historical URL records are retained as `legacySourceUrl`/`legacyThumbnailUrl`, marked `legacyUnverified`, and are not exposed as signed or verified evidence.

## Access, audit, and retention

Upload completion, rejection, malware results, signed URL issuance, customer downloads, annotations, derived records, deletion requests, reviews, and retention purges create audit events. Access is scoped to the repair shop and case; technicians must have current membership and case assignment. Customer links can download only clean evidence for the linked case and only while the authorization token is valid.

The default retention is 2,555 days. Set `EVIDENCE_RETENTION_DAYS` to the applicable product/legal policy; the hourly worker removes expired objects and soft deletes records while retaining metadata and audit history. A shop owner can review deletion requests, but linked evidence (quotation, test, component replacement, derivative, or certificate) is not purged. Early deletion is blocked by default; `EVIDENCE_RETENTION_ALLOW_EARLY_DELETION=true` is an explicit policy override and should only be set after legal/privacy review. Object deletion happens before the database tombstone is written; failed object removals remain visible and are retried by a later retention sweep when expired.

## Local development and operational limitations

Copy the root `.env.example` into a local untracked `.env`, configure Supabase and database values, and run the API and Compose dependencies. Production deployments should use a managed private object store with lifecycle/versioning controls, a managed malware scanner or isolated ClamAV pool, and an independently monitored retention job. The current hourly worker is process local and may run on each API replica; database conditional updates make record tombstones idempotent, but production should move this work to a single scheduled worker when replicas are enabled. The upload itself and scan are synchronous in this first release, so large files consume API memory while inspecting; keep the configured size cap conservative.

Existing external legacy URLs are not downloaded or re-hashed automatically. Migrating them into private storage requires an explicit, audited migration and must preserve their legacy/unverified classification unless their provenance is independently established.
