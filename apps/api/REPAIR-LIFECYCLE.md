# Repair case lifecycle

The API is the sole writer of `RepairCase.status`. Every state change runs through `RepairLifecycleService` inside the caller's Prisma transaction. The service checks the edge and actor, enforces prerequisites, performs a compare-and-set update, appends an immutable `RepairCaseTransition`, and writes an `AuditEvent`. A duplicate `Idempotency-Key` with the same actor, target state, and request hash returns the recorded transition; reusing a key for a different request conflicts.

Each transition stores its timestamp, source and destination state, actor profile and effective role, reason, supporting evidence/workflow record IDs, and idempotency metadata. A case's transition history restricts hard deletion; normal retention uses the case's soft-delete field. Independent verification submissions are append-only `VerificationAttempt` rows; `Verification` is the current summary.

## Permitted transitions

| From → To | Authorized actor | Prerequisites and recorded support |
| --- | --- | --- |
| `DRAFT → SUBMITTED` | Assigned technician or shop owner | Repair case has required intake fields and a registered device; caller may attach intake evidence IDs. |
| `DRAFT → CANCELLED` | Shop owner | Non-empty cancellation reason. |
| `SUBMITTED → UNDER_DIAGNOSIS` | Assigned technician or shop owner | Case remains assigned to the organization. Starting the first submitted diagnostic also performs this transition. |
| `SUBMITTED → CANCELLED` | Shop owner | Non-empty cancellation reason. |
| `UNDER_DIAGNOSIS → DIAGNOSIS_COMPLETED` | Assigned technician or shop owner | At least one submitted diagnostic; diagnostic IDs are recorded. |
| `UNDER_DIAGNOSIS → CANCELLED` | Shop owner | Non-empty cancellation reason. |
| `DIAGNOSIS_COMPLETED → QUOTATION_PENDING` | Assigned technician or shop owner | A submitted diagnostic and a draft quotation exist; quotation and diagnostic IDs are recorded. Quote creation performs this transition atomically. |
| `DIAGNOSIS_COMPLETED → CANCELLED` | Shop owner | Non-empty cancellation reason. |
| `QUOTATION_PENDING → AWAITING_CUSTOMER_APPROVAL` | Assigned technician or shop owner | A sent quotation and pending approval exist. Quote ID and approval ID are recorded. |
| `QUOTATION_PENDING → CANCELLED` | Shop owner | Non-empty cancellation reason. |
| `AWAITING_CUSTOMER_APPROVAL → APPROVED` | Customer using the case authorization token | Token is valid and unexpired; a current sent quote exists; a signed decision is saved atomically with the transition. |
| `AWAITING_CUSTOMER_APPROVAL → REJECTED` | Customer using the case authorization token | Same token and signature requirements as approval; the rejection is retained against its quotation. |
| `AWAITING_CUSTOMER_APPROVAL → CANCELLED` | Shop owner | Non-empty cancellation reason. |
| `APPROVED → IN_REPAIR` | Assigned technician or shop owner | At least one repair action is created in the same transaction. |
| `APPROVED → CANCELLED` | Shop owner | Non-empty cancellation reason. |
| `REJECTED → QUOTATION_PENDING` | Assigned technician or shop owner | A new draft quotation and submitted diagnostic exist. |
| `REJECTED → CANCELLED` | Shop owner | Non-empty cancellation reason. |
| `IN_REPAIR → AWAITING_VERIFICATION` | Assigned technician or shop owner | At least one repair action exists and every action is completed; latest test result per test name passes; post-repair evidence is attached. The evidence and test IDs are recorded. This is a request for independent review, not a verification result. |
| `AWAITING_VERIFICATION → COMPLETED` | Shop owner or technician other than the assigned repair technician | A separate verifier submits the full device checklist, every item passes, technician test and evidence prerequisites remain satisfied, and the verification record is committed in the same transaction. |
| `AWAITING_VERIFICATION → IN_REPAIR` | Shop owner or technician other than the assigned repair technician | A failed independent verification exists; its attempt ID is recorded. |
| `COMPLETED → DISPUTED` | Customer using the authorization token or shop owner | An open dispute is created atomically and recorded as supporting data. |
| `DISPUTED → COMPLETED` | Shop owner | No dispute remains open or under review; the dispute resolution is recorded. |
| Any other edge | Nobody | Rejected as an invalid transition. `CANCELLED` is terminal. |

Technicians must be assigned to the case for ordinary technician transitions. A verifier must be a different profile from the assigned technician; a technician cannot transition their own work to `COMPLETED`. Certificate issuance requires an already completed case and a passing independent verification. It never changes a case to completed.

## API requirements

Write operations that change lifecycle state, submit a customer decision, create a quotation, create a repair action, submit verification, or open/resolve a dispute require an `Idempotency-Key` header (1–128 characters). Browser API clients generate one for each write request; integrations should supply and reuse a key when retrying the same logical operation. `PATCH /cases/:id/status` is not a bypass: it delegates to the same policy and rejects transitions whose domain prerequisites have not been committed.

The state migration maps legacy values without deleting cases: `REGISTERED → SUBMITTED`, `DIAGNOSING → UNDER_DIAGNOSIS`, `QUOTED → QUOTATION_PENDING`, `AWAITING_APPROVAL → AWAITING_CUSTOMER_APPROVAL`, `VERIFYING → AWAITING_VERIFICATION`, and `CERTIFIED → AWAITING_VERIFICATION`. A former `CERTIFIED` state is not proof of independent verification; public certificates remain inaccessible unless the current case has a passing independent verification. It seeds one migration baseline transition for every existing case; prior detailed audit events remain intact.
