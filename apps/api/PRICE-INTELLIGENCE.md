# Repair price intelligence

## Purpose and trust model

Price intelligence returns a plain-language comparison for a repair scope. It does not decide whether a quotation is fair, necessary, fraudulent, or independently verified. An expensive quote is only marked as above the comparison band and accompanied by questions about scope, parts, warranty, tax, and availability.

The current repair schema did not record final invoice amounts. The new `RepairPriceTransaction` is a **reported final-invoice record for a completed repair** submitted by a shop owner. It must reference a clean, managed original invoice attached to that case. A platform administrator reviews the entered fields against a short-lived signed invoice URL. Acceptance makes it eligible for anonymized aggregation; it is not proof of invoice authenticity, payment settlement, or repair quality. The database, API responses, and UI must preserve this distinction.

Only `ACCEPTED` records contribute. Quotations, OCR suggestions, component inventory costs, pending reports, and rejected reports are excluded. The service compares final invoice amounts, not settlement records; the current system has no payment ledger.

## Data collection and review

- `POST /cases/:caseId/price-transactions` is shop-owner-only, requires an `Idempotency-Key`, requires a completed case, and validates that item subtotals plus labour, additional charges, and tax equal the invoice total within 0.02 in the same currency. Zero-cost line items are allowed but do not produce positive component price samples.
- Manufacturer and model are snapshotted from the repair case’s registered device. Fault, complexity, location, currency, line items, source, and amounts are explicitly supplied by the owner.
- The referenced invoice must be case-scoped, original, malware-clean, managed, and categorized as an invoice. No document hash is described as proof of truth.
- `GET /platform/admin/price-transactions/pending` lists the review queue. `GET /platform/admin/price-transactions/:id/invoice` gives a platform administrator a 60-second audited URL. `PATCH .../:id/review` accepts or rejects the report; reviewers cannot approve their own entry.
- `POST /platform/admin/price-index` stores sourced monthly CPI/price-index values. Series are keyed by country, region, and currency and must use a consistent official index base.
- `GET /price-intelligence/benchmark` returns cohort-level aggregates only and excludes the requesting user's own shop when the account is associated with one.

The review UI should show the entered totals and component rows beside the invoice. The reviewer confirms that the entered numbers and stated geography match the document and available case context. The reviewer does not attest that the shop charged or performed everything described.

## Normalization and comparison cohort

Text normalization uses Unicode decomposition, accent removal, case folding, punctuation-to-space conversion, and whitespace collapsing. Device manufacturer, model, fault type, and component names must match after this normalization. It deliberately does not apply fuzzy matching or guessed synonyms, which could combine different models or repair scopes. Maintain controlled aliases/taxonomy before broadening this matching.

All queries require manufacturer, model, fault, component, part source, repair complexity, country, region, and currency. Part-source mix must match exactly. Values in different currencies are never mixed or converted. Tax is excluded from total repair comparison; it remains recorded in the source transaction. The `TOTAL` benchmark means labour + parts + additional charges before tax. `LABOUR` and `COMPONENT` are available bases as well.

The engine first compares the requested administrative region. If that cohort is too small, it may use the same country and clearly says the geographic level broadened. It does not use a global cohort. Per repair business, at most three newest matching reports contribute, limiting dominance by high-volume shops.

## Evidence and statistical rules

- Regional range requires at least 12 post-filter reports from 5 distinct repair businesses.
- Country fallback requires at least 20 reports from 8 businesses.
- Outliers are filtered with the median absolute deviation (MAD) at 3.5 scaled deviations. If MAD is zero, an IQR fence is used; a 5% median tolerance handles zero-IQR cohorts.
- The displayed band is the 20th–80th percentile, not a confidence interval. Reliability is `MODERATE` at the minimum and `STRONG` only at 30+ reports from 10+ businesses within the requested region.
- If there is no complete same-currency price-index series (regional series key is the region code; country fallback series key is `__NATIONAL__`), only the most recent 12 months are considered and values remain nominal. If a complete series exists for all sample dates, values are adjusted to its newest available month and that date is returned. No synthetic or FX adjustment is performed.
- Before thresholds are met, estimate and exact cohort counts are withheld. The response explains that there is not enough evidence and contains no reference price.

## API

### Benchmark query

`GET /price-intelligence/benchmark` query parameters: `manufacturer`, `model`, `faultType`, `component`, `partSource`, `complexity`, `countryCode`, `regionCode`, `currency`; optional `priceComponent` (`TOTAL`, `LABOUR`, `COMPONENT`) and `quoteAmount` (same currency and basis; total must be pre-tax).

An available response includes the estimate, sample size, independent business count, reliability explanation, matching criteria, matched geographic level, transaction window, inflation-adjustment status, removed-outlier count, optional quote position, and limitations. Quote positions are only `BELOW_RANGE`, `WITHIN_RANGE`, or `ABOVE_RANGE`; there is no fraud label.

## Scaling and operations

The initial query is indexed by eligibility, dimensions, currency, region, and transaction date and caps raw results at 2,000. Monitor candidate counts and query latency. If data grows beyond that cap, replace application-side filtering with a PostgreSQL statistics query/materialized cohort table while preserving the same eligibility thresholds, privacy suppression, contribution caps, and explainable criteria. Do not add a separate service until workload, isolation, or release requirements justify one.

Price reports retain a direct case and invoice relationship for audit. Apply RepairProof’s evidence retention and deletion policy consistently; any legal retention or anonymization decision must preserve audit metadata without keeping invoice contents longer than policy permits. Benchmark responses never expose case IDs, business names, or transaction rows.

## Known limitations

- Values are human-entered and document-reviewed reports, not independently audited payments.
- Fault and component matching is normalized exact text, not semantic equivalence. Descriptions that use different terms will not match.
- Repair complexity is a four-level submitted category and can be inconsistently rated.
- Location is supplied by the shop and checked during human review; it is not yet derived from a maintained address/geocoding service.
- No foreign-exchange conversion is performed. CPI coverage needs a maintainer to import official monthly series. When either is unavailable, the engine returns same-currency nominal recent data or no range.
- The benchmark may omit valid repairs because of strict matching, required part-source consistency, and outlier filtering. It must never be presented as the only reasonable price.
