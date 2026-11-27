# RepairProof performance baseline and budgets

Date: 2026-11-23. This is a local production-build baseline, not a field performance report.

## Changes made

- Split account access out of the shared workspace module. Before the split, the login route's shared chunk was 237.53 kB raw / 66.34 kB gzip, plus a 0.30 kB wrapper. The account page now has a 44.71 kB / 16.24 kB gzip chunk. This is an 81% reduction in that shared chunk's raw size and a 76% reduction in its gzip size; the Zod validation dependency remains a separate shared 53.41 kB / 12.19 kB gzip chunk.
- Load consumer and technician workspace components with `React.lazy` when those workspace views render. The current technician view chunk is 94.28 kB raw / 28.20 kB gzip, and the consumer dashboard chunk is 24.37 kB / 5.99 kB gzip. These chunks no longer ship inside the account-access module.
- Enabled gzip in the Nginx config and immutable one-year caching for fingerprinted static assets. `index.html` is marked `no-cache` so users can discover the latest asset hashes. Docker/Nginx could not be started in this environment, so server header behavior still needs a container check.
- Added a Vite manifest-based budget check: `pnpm perf:budget` builds the web app and checks entry, landing, async JS, and CSS gzip sizes.

## Measurements

### Production build output

| Asset | Before | After |
|---|---:|---:|
| Main JS entry | 428.27 kB raw / 142.79 kB gzip | 428.73 kB / 142.98 kB |
| Landing route chunk | 39.11 kB / 9.42 kB | 39.22 kB / 9.47 kB |
| Account-access shared chunk | 237.53 kB / 66.34 kB plus 0.30 kB / 0.22 kB wrapper | 44.71 kB / 16.24 kB |
| Technician workspace chunk | Included in shared chunk | 94.28 kB / 28.20 kB |
| Consumer dashboard chunk | Included in shared chunk | 24.37 kB / 5.99 kB |
| CSS | 51.25 kB / 10.14 kB | 51.27 kB / 10.15 kB |

The code split improves the account-access route and defers workspace code; it does not reduce the main entry. In a local headless Chromium run against Vite's production preview, the landing navigation requested **524,209 decoded bytes** across document and assets. The main script's browser transfer size was **143,276 bytes**, the stylesheet **10,446 bytes**, and the landing chunk **9,765 bytes**. Vite preview compression was active; these numbers do not validate Nginx compression.

### Local browser lab run

Repeated the landing and `/login` routes five times each in fresh Chromium contexts against the local Vite production preview. Desktop viewport was 1440 × 900; mobile was 390 × 844. Runs used no CPU or network throttling and reduced motion. LCP and CLS came from browser `PerformanceObserver`; FCP came from the navigation entry. For an interaction proxy, the run clicked the landing-page preview action or submitted the login form to a locally intercepted synthetic 401. The table reports nearest-rank p75 across valid navigation samples and p75 of the maximum Event Timing duration observed per run.

| Device | Route | Valid FCP/LCP samples | FCP p75 | LCP p75 | Event Timing duration proxy p75 | CLS max |
|---|---|---:|---:|---:|---:|---:|
| Desktop | Landing | 4/5 | 304 ms | 304 ms | 24 ms | 0.000 |
| Desktop | Login | 5/5 | 248 ms | 248 ms | 40 ms | 0.000 |
| Mobile | Landing | 5/5 | 160 ms | 160 ms | 16 ms | 0.000 |
| Mobile | Login | 5/5 | 228 ms | 228 ms | 40 ms | 0.000 |

The desktop landing route had one sample without a valid FCP/LCP entry, so its p75 uses four observations. The Event Timing values are a small, scripted lab proxy, not INP: each run exercises only one scripted interaction, with no representative user interaction distribution. These results do not establish field Core Web Vitals or field p75. No production or CrUX data is configured, and no visitor data was collected. To measure field p75, deploy privacy-reviewed real-user measurement and collect sufficient visits, segmented by device class; until then, report these lab data separately.

Reproduction: run `python scripts/measure-web-vitals.py --base-url http://127.0.0.1:4173 --samples 5`. The script uses local browser data only and does not send credentials or measurements to external services.

Verification after the route split: web production build passed, Vitest passed **3/3**, and the existing responsive/accessibility Playwright suite passed **19/19** against the local production preview. The PostgreSQL-backed workflow test previously measured 2.0 s for a full seeded lifecycle integration and 0.7 s for the multi-request HTTP integration journey; these end-to-end test durations are not isolated API latency distributions or p95 measurements.

## Budgets

The checked-in budget command currently passes the following gzip limits:

| Budget | Limit | Current |
|---|---:|---:|
| Initial application JS entry | 160 KiB | 139.5 KiB |
| Public landing route JS | 20 KiB | 9.2 KiB |
| Any asynchronous JS chunk | 40 KiB | Largest: 27.5 KiB |
| Initial CSS | 12 KiB | 9.8 KiB |

For field Core Web Vitals, target p75 LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1, separately for mobile and desktop. These are the current “good” thresholds documented by [web.dev](https://web.dev/articles/vitals). They remain targets until privacy-approved, consent-aware real-user measurement is in place. Initial internal API budget: p95 < 500 ms for ordinary authenticated reads, measured only after representative query plans and production-like data are available; this is not a current SLO.

## Backend and data findings

- `CaseService.findAll` returns every matching repair case and joins device, technician, and relation counts without a limit. Add an authorized cursor contract before shops accumulate large case volumes; keep page totals separate from per-page counts.
- `DeviceService.findAll` returns every matching device and all related repair-case summaries. Return a bounded device page with case counts and load repair history from the device detail endpoint in pages.
- `CaseService.technicianWorkspace` caps cases at 200 but includes every test result and all original evidence rows for each case. This is still an unbounded payload within a case. Redesign it as a paginated queue plus selected-case detail/history requests before high-volume use; do not truncate silently because that would falsify queue metrics.
- The schema currently has single-column repair-case indexes, while list queries combine tenant/deletion/status/technician filters and sort by timestamps. Composite/partial indexes are candidates only. Capture `EXPLAIN (ANALYZE, BUFFERS)` for representative tenant sizes before adding indexes, then compare query latency and write/storage costs.
- React Query uses a 30-second stale time, but repair records and evidence are authenticated data and must not receive shared public HTTP caching. Use per-user query cache invalidation after mutations; consider conditional requests only after the API exposes stable ETags/version fields.
- The UI has no large decorative raster images or remote image hosts. Evidence uploads go directly from the browser to private object storage using a signed upload token, avoiding API-server file buffering. The current upload path uses Supabase's standard signed upload for files up to 25 MB. Supabase recommends resumable TUS uploads above 6 MB or on unstable networks; add signed TUS uploads with progress, retry, and resume before relying on large mobile video uploads ([Supabase upload docs](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)).
- The application is a Vite React SPA, not server-rendered. The initial document is a small shell and the public page content depends on JavaScript. Local LCP is incomplete, so first test the route with field or throttled lab data. If public search entry points need stronger no-JS rendering, prerender the static public routes separately; do not SSR authenticated repair data into public HTML.
- API latency, production database plans, full upload throughput, and background queue throughput have not been benchmarked. Docker runtime was unavailable, so Nginx gzip/cache headers were not exercised end to end.

## Reproduction

- `pnpm --filter @repairproof/web run build`
- `pnpm --filter @repairproof/web run perf:budget`
- `pnpm --filter @repairproof/web run test`
- Use a production preview and a clean browser context for lab navigation checks. Use mobile/desktop p75 field data before claiming Core Web Vitals compliance.
