# Security policy

## Status

RepairProof is a developing platform, not an independently certified or launch-approved service. Read the current [security assessment](REPAIRPROOF-SECURITY-ASSESSMENT.md) and [release readiness report](docs/release-readiness-2026-11-23.md). Authentication and security code do not, by themselves, establish that the complete system is secure.

## Reporting a vulnerability

Do not publish exploit details or include customer evidence, credentials, bearer tokens or device serials in a public issue. No monitored security mailbox or guaranteed response SLA is established in this repository; until an owner/channel is formally published, report privately to the repository owner through the private channel they provide. If no private channel is available, do not upload live data or run destructive tests; provide a minimal description and request a secure channel.

Include affected commit/version, component, impact, minimal reproduction, and suggested mitigation when known. Coordinate disclosure with the maintainer before public disclosure.

## Research rules

Only test local disposable environments or systems where you have explicit authorization. Do not scan production, enumerate real users, access other tenants' data, upload malware to shared storage, or alter/delete evidence. Use synthetic accounts and isolated databases. Respect provider terms.

## Secret handling

Never commit secrets. Treat `SUPABASE_SERVICE_ROLE_KEY`, database URLs, Redis credentials, signing/HMAC keys, provider tokens, and evidence links as sensitive. If exposed, revoke/rotate promptly, inspect access logs, and follow [incident response](docs/incident-response.md). Browser `VITE_*` variables are public by design.
