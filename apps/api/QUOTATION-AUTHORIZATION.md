# Quotation and customer authorization

## Quotation snapshot

Each quotation is a numbered, immutable version attached to one repair case. It snapshots the diagnosed issue, proposed repair, itemized parts and services, labor, additional charges, currency, tax rate and calculated amount, estimated completion hours, warranty terms, validity deadline, and same-case supporting evidence. The API computes all line totals, tax, and grand total using decimal arithmetic; client totals are informational only.

Quotation creation and sending require `Idempotency-Key`. Creation is allowed after diagnosis or a customer rejection/change request. It creates the next version, resolves open change requests against that replacement version, advances the guarded repair lifecycle, and writes an audit event in one transaction. Sending changes only a draft to sent, creates a pending approval row, advances to customer approval, records audit, and queues a customer authorization email when the case has an email address. `PUBLIC_APP_URL` configures the link host.

Approved quotation rows are never edited or superseded. A customer requested change is a signed decision against the sent version: the old quote and approval are marked rejected, a durable change-request record and audit event are created, the case enters `REJECTED`, and the technician must create and send a new numbered version. The new version always requires explicit customer approval, so both price and scope changes are consented to against the exact revised snapshot. Simple rejection also permits a new version but is retained separately from change requests.

## Customer decisions

`POST /authorize/:token/respond` accepts either the legacy `approved: boolean` or `decision: APPROVE | REJECT | REQUEST_CHANGES`, a customer signature name, and optional notes. `REQUEST_CHANGES` requires explanatory notes. The authorization token and quote validity are checked server-side. The quote response, approval status/signature/timestamp, change-request record (when applicable), lifecycle transition, notification, and audit event commit in one database transaction. Concurrent or duplicate decisions cannot overwrite the prior response; idempotent retries replay their original transition, while key reuse with a different payload conflicts.

The customer endpoint exposes the latest sent or decided quotation, its evidence and change-request history. Shop case views list all quote versions, approvals, attached evidence, and revisions. Customer decisions notify the assigned technician; quote sending queues an email to the customer when a customer email exists. Email delivery uses the durable notification worker and `RESEND_API_KEY`/`EMAIL_FROM` configuration; see [external integration notes](./EXTERNAL-INTEGRATIONS.md).

## Migration

`20261120010000_quotation_authorization_module` adds snapshot fields with explicit legacy placeholders, quote/evidence links, change-request history, and customer email notification recipients. Apply through `pnpm --filter @repairproof/api db:migrate:deploy` after setting the production `DATABASE_URL` and `DIRECT_URL`. The migration has not been applied to a live database in this workspace.
