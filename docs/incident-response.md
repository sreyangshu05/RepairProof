# Incident response

## Readiness caveat

This is a response runbook template. The repository does not establish a staffed on-call rotation, named incident commander, legal counsel, support queue, tested backup restoration or customer notification SLA. Assign those owners and rehearse this process before production launch.

## Severity

- **SEV-1:** suspected customer/evidence exposure, cross-tenant access, active credential compromise, integrity corruption, or broad service outage.
- **SEV-2:** material degradation of a core workflow, database/storage unavailable, repeated failed deployments, or notification backlog with customer impact.
- **SEV-3:** isolated non-sensitive feature failure or limited integration outage with safe workaround.

Escalate severity when impact is uncertain and sensitive data may be involved.

## First response

1. Alert the designated incident lead through the approved private channel; record UTC start time and impacted environments.
2. Preserve relevant logs, deployment/image digest, request IDs, audit events and provider status. Do not copy evidence or secrets into the incident doc.
3. Establish scope: users/orgs, records, time window, data types, availability and integrity impact. Separate confirmed facts from hypotheses.
4. Contain safely: disable affected feature via server-side flag, revoke/rotate credentials, block compromised access, pause risky worker or deployment. Preserve forensic evidence and repair audit history.
5. Restore service using rollback/forward fix or provider recovery. Coordinate schema changes and do not replay non-idempotent jobs blindly.
6. Verify access controls, data consistency, queued jobs, evidence hashes/objects and monitoring before declaring recovery.
7. Incident lead coordinates legally required and customer communications with qualified privacy/legal owner. Do not speculate, expose another user's data, or promise unsupported recovery.
8. Record timeline, decisions, impact, root cause, remediation owner and due dates; conduct a blameless review.

## Scenario playbooks

### Suspected unauthorized access or secret exposure

Restrict/disable affected credentials and sessions, rotate secrets at provider and deployment layers, preserve access/audit records, identify accessed tenant data and affected evidence, close the path with a tested fix, and follow the privacy/breach assessment with the responsible legal authority. Do not delete audit trails.

### PostgreSQL unavailable or integrity issue

Check provider health and connection saturation. Stop unsafe writes or retry loops. For corruption, preserve a snapshot before repair. Restore only from verified backup under an approved RPO/RTO decision; reconcile subsequent records and associated object storage before reopening mutations.

### Object storage or malware scanner outage

Do not expose buckets or mark uploads finalized without checks. Retain upload intent state, retry safely, and surface a clear pending/error state. Resume scanning/finalization after recovery; reconcile orphan objects with a reviewed job.

### Email/provider or AI outage

Keep committed repair state intact. Leave notifications queued with bounded retry/dead-letter visibility. Disable optional AI; never substitute unreviewed extraction as a verified fact.

## Recovery and communications

Use [deployment guide](deployment-guide.md) rollback steps. Communications must state affected service/time and confirmed data impact, not disclose private records. Keep an incident record with access restricted to responders; publish a sanitized post-incident summary only after security/privacy review.
