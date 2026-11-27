# Feature flags and controlled experiments

## Safety model

Feature flags are for presentation changes and reversible, non-critical product experiences. They must never decide authentication, authorization, tenant isolation, evidence access, customer approval validity, repair lifecycle transitions, billing, retention, or whether a transaction is committed. Backend policy checks and database constraints remain authoritative regardless of a flag result. Flag evaluation fails closed when the database or assignment secret is unavailable.

The server evaluates flags using the authenticated profile, role, and organization from the API session. It does not accept targeting identity or role from request parameters. Role and organization restrictions are combined as an intersection. An empty role list means shop roles; platform administrators are excluded unless explicitly targeted. Percentage rollout uses a stable HMAC bucket, either per profile or per organization. Emergency disablement is checked against PostgreSQL on each evaluation; there is no long-lived in-process cache.

Frontend presentation can use `useFeatureFlag(key)` from `apps/web/src/features/feature-flags/useFeatureFlag.ts`. It fails closed while loading or if evaluation errors. It must not hide or enable API authorization paths; all protected endpoints still enforce policy independently. Re-evaluate on mount or focus after an administrative disable. Server calls to `FeatureFlagsService.isEnabled` likewise fail closed.

Experiment assignments require the user's explicit RepairProof product analytics consent. The experiment system only runs profile-scoped experiments, so withdrawal can remove one participant's assignments and associated metrics without changing other users' allocations. Organization targeting and organization-stable rollout are supported for ordinary flags; organization-level experiments are rejected. Experiment metric events are recorded only by trusted server services, never by a public client endpoint.

Assignment, metric source, and rollout bucket identities are HMAC pseudonyms. The secret is `FEATURE_FLAG_ASSIGNMENT_SECRET`, unique per environment and at least 32 characters. Keep it stable while experiments run; rotating it changes rollout cohorts and prevents unlinking prior assignments on withdrawal. Do not log it. Experiment assignment and metric records are removed 90 days after a paused or completed experiment; metric events older than 90 days are also purged daily. Experiment assignments require both product analytics collection configuration and the person's current explicit consent.

## Operations

The platform administrator console is `/admin/config`. It supports creating flags disabled, activation, percentage rollout, profile/organization scope, role targeting, organization allowlists, experiment setup, metrics review, and an emergency kill switch. The REST surface is:

| Method and path | Purpose |
|---|---|
| `GET /feature-flags/effective` | Authenticated user's evaluated flag map. The backend derives identity, role, and organization. |
| `GET /platform/admin/feature-flags` | Platform administrator list, experiment state, and assignment secret readiness. |
| `POST /platform/admin/feature-flags` | Create a flag. New flags default off. |
| `PATCH /platform/admin/feature-flags/:key` | Change activation, targeting, percentage, or rollout scope. |
| `POST /platform/admin/feature-flags/:key/emergency-disable` | Immediately force the feature off for all API instances. |
| `POST /platform/admin/feature-flags/:key/restore` | Clear the emergency override. This does not activate the flag. |
| `PUT /platform/admin/feature-flags/:key/experiment` | Create or update a weighted experiment. Variant weights must total 100. |
| `GET /platform/admin/feature-flags/:key/experiment/metrics` | Aggregate exposures and configured outcome metrics. Cells below 20 are suppressed. |

All administrative changes are recorded in `PlatformAdminAuditEvent`. No flag or experiment rows are hard-deleted through the API.

Supported server-confirmed experiment metric keys are `device_registered`, `repair_case_created`, `diagnostic_submitted`, `quotation_delivered`, `repair_documented`, and `warranty_claim_submitted`. Domain events only count after the relevant database transaction commits. Metrics are deduplicated by assignment, metric, and HMAC source key. Do not configure a metric name that is not emitted by backend code.

## Rollback without redeployment

1. In `/admin/config`, choose **Emergency disable** on the affected flag. This persists the kill switch in PostgreSQL and the API evaluates it on the next request across all replicas. The change is audit-logged.
2. Confirm the evaluated flag is `false` through `GET /feature-flags/effective` using representative affected roles and organizations. The kill switch is global, so it overrides all allowlists, percentages, and experiment variants.
3. For a normal planned retirement, use **Deactivate** or set rollout to `0%`. This preserves the emergency override as a separate incident control.
4. Investigate via the application error monitor and admin audit log. Do not turn the flag back on until the cause is understood. **Restore kill switch** only clears the override; the flag must still be explicitly activated and targeted.
5. If the database is unavailable, evaluations fail closed. If the bad behavior is not truly optional/non-critical, use the regular incident rollback/release process; flags are not a substitute for a deployment rollback or data repair.

## Experiment configuration

An experiment contains a stable key, a percentage of eligible/consented users assigned to it, and 2–8 variants with integer weights totaling 100. Each variant has an `enabled` value used only for the optional feature path. A typical control/treatment setup is:

```json
[
  { "key": "control", "weight": 50, "enabled": false },
  { "key": "treatment", "weight": 50, "enabled": true }
]
```

The baseline flag still needs ordinary role/organization/percentage targeting. Users outside the experiment allocation receive the baseline flag result. Assignment is stable for the experiment key and profile while the HMAC secret remains unchanged. Variant keys, weights, and metric definitions cannot be changed after participants are assigned; pause first, and create a new experiment when its treatment design changes. A completed experiment is immutable.

Metrics are usage signals, not proof of customer value, repair quality, technician performance, or causal impact. Review cohort size, exposure coverage, outcome definitions, and privacy before interpreting results. The platform summary suppresses cells below 20 and does not expose participant keys.

## Deployment

The migration is `20261124030000_feature_flags_experiments`. Set `FEATURE_FLAG_ASSIGNMENT_SECRET` in the runtime secret manager before enabling any percentage rollout or experiment. Percentage rollouts fail closed if this secret is missing; experiments additionally require `PRODUCT_ANALYTICS_ENABLED=true`, a valid `ANALYTICS_PSEUDONYM_SECRET`, and participant consent. Apply the migration before starting a release that uses the module.
