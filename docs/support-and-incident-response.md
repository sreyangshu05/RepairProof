# RepairProof support and incident response runbook

**Operational status: NOT READY FOR CUSTOMER LAUNCH.** This runbook is usable only after the named roles, contact details, schedules, provider credentials, escalation paths, and legal decision owners below are filled and tested. A document without an available responder is not an operational control.

## Required owners before launch

| Role | Accountable person/team | Contact | Backup |
|---|---|---|---|
| Incident commander | [assign] | [monitored channel/phone] | [assign] |
| Security lead | [assign] | [monitored channel/phone] | [assign] |
| Privacy/legal decision owner | [assign] | [monitored channel/phone] | [assign] |
| Database/recovery owner | [assign] | [monitored channel/phone] | [assign] |
| Customer support lead | [assign] | [published support address] | [assign] |
| Hosting/provider owner | [assign] | [provider access/contact] | [assign] |

## Customer support intake

Publish only a tested, monitored channel: [support URL/email]. Ask for case reference, account email, shop, device model, and a concise issue description. Do not ask customers to send passwords, OTPs, full serial/IMEI, payment data, or unredacted identity documents. Acknowledge receipt using the actual published commitment: [hours, time zone, response target]. Triage authorization, safety, privacy, evidence, warranty, and dispute matters to the named owner. Record the minimum necessary case metadata in a restricted ticket system; do not copy private evidence into email or chat.

## Severity and response

- **SEV-1:** confirmed or strongly suspected cross-tenant exposure, authorization-token leakage, evidence disclosure/tampering, broad outage, or unrecoverable data loss. Incident commander immediately coordinates containment, security/privacy/legal review, evidence preservation, provider escalation, and customer/regulator notification decision.
- **SEV-2:** material workflow integrity failure, sustained service unavailability, compromised privileged account, or repeated failed backups. Assign owner and restoration plan; pause affected workflows if records could become inconsistent.
- **SEV-3:** isolated recoverable defect with no known confidentiality/integrity impact. Track owner, workaround, and release fix.
- **SEV-4:** low-impact request or cosmetic defect. Route through normal support.

Actual acknowledgement and resolution commitments: [approve staffing-backed service targets before publication]. Do not promise 24/7 response unless staffed 24/7.

## First-response checklist

1. Open a restricted incident record; note UTC/local time, reporter, affected systems/tenants, observed symptoms, and incident lead.
2. Preserve relevant logs, request IDs, audit events, object versions/hashes, and provider incident data; restrict access and retain chain-of-custody notes.
3. Contain without destroying evidence: disable affected public links/uploads/AI/notifications, revoke credentials or tokens, or pause writes when authorized and needed to prevent further harm.
4. Check cross-tenant scope, records exposed/changed, duration, downstream processors, backup availability, and whether customer workflows can safely continue.
5. Engage privacy/legal owner to determine applicable notification obligations, recipients, deadlines, and approved message. Do not speculate or send unreviewed mass notices.
6. Restore service only after integrity checks, credential rotation, authorization tests, monitoring, and owner approval.
7. Record decisions and timeline; complete a blameless review with corrective owners/dates and update tests/runbooks.

## Scenario playbooks

### Authorization token or private case data exposed

Disable affected link endpoint or affected tokens; preserve access logs; rotate/revoke tokens; verify no serial, contact, internal note, or evidence URL appears in public payloads/logs; identify affected recipients and seek privacy/legal advice promptly; reissue safe links only after regression tests.

### Evidence exposure, tampering, or storage outage

Pause signed URL issuance/uploads as appropriate; preserve object metadata, scan status, hashes and provider version history; isolate affected paths; compare restored/downloaded bytes to recorded hashes; separately review authenticity claims (hash match is not proof of truth); notify owners and affected customers as approved.

### Database outage or suspected corruption

Stop writes if atomicity/integrity is uncertain; capture provider status and database metrics; do not repeatedly replay non-idempotent requests; restore to an isolated instance first; validate migrations, tenant boundaries, critical transitions, audit records, and object references before cutover.

### Email, AI, or queue failure

Keep repair state commits independent from optional provider delivery. Retry through deduplicated durable jobs; dead-letter repeated failures; show an in-app status and staff follow-up queue. Disable optional AI while preserving manual diagnostic and repair documentation.

## Readiness exercises and records

- [ ] Assign and test all named contacts, backups, on-call schedule, support inbox access, and provider access.
- [ ] Run a tabletop for leaked customer link and evidence-storage outage; record actual response times and unresolved actions.
- [ ] Run a credential-revocation/rotation rehearsal.
- [ ] Complete an isolated database plus object-storage restore drill and attach measured RPO/RTO evidence.
- [ ] Test support requests without leaking personal data in tickets, logs, or notifications.
- [ ] Review and approve public support and incident statements with counsel/privacy owner.
