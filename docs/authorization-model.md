# Authorization model

## Enforcement layers

1. Global Supabase auth guard rejects missing/invalid bearer credentials unless a route is explicitly public.
2. Role guard applies route-level role requirements.
3. Current-user context resolves local profile, active organization and membership; clients cannot choose the tenant by sending an organization identifier.
4. Domain services scope each read/write to accessible organization, case, device, assignment, or recipient and validate workflow prerequisites.
5. Prisma transactions and constraints protect atomic decisions and relationships; audit events preserve sensitive actions.

Frontend navigation/layouts are usability boundaries only. They never replace server checks.

## Roles and scopes

- **Consumer/customer:** own devices and relevant cases; may review/decide quotations only through supported authenticated or explicitly enabled authorization paths.
- **Technician:** organization-scoped work and cases permitted by assignment/access policy; device and case visibility must be enforced server-side.
- **Shop owner/admin:** organization management, staff and scoped business administration.
- **Platform administrator:** separately provisioned global operations capability. A platform administrator has no automatic shop membership and must not receive implicit tenant context.

Exact enum names and guarded endpoints are source-controlled in shared enums, DTO decorators, guards and services. Where the release assessment identifies incomplete role/resource coverage, do not infer stronger protection than tested.

## Sensitive scopes

Evidence download, deletion, annotation, quotation approval/revision, device serial data, customer authorization tokens, disputes, user access changes, organization verification, audit events and admin transactions require explicit access checks. Public certificate retrieval must return a limited projection. Authorization tokens are secrets: never include token values in routine response bodies, logs, analytics or audit metadata.

## Tests and review

Add positive and negative tests for every new route: unauthenticated, wrong role, wrong organization, wrong owner/assignment, stale state, replay/duplicate, and direct object ID guessing. Test the service and route layer; selected cross-tenant tests do not constitute exhaustive coverage. See [security assessment](../REPAIRPROOF-SECURITY-ASSESSMENT.md) and [QA strategy](../REPAIRPROOF-QA-STRATEGY.md).
