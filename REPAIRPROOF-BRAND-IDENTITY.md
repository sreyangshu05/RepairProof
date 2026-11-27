# RepairProof Brand Identity

**Brand platform and visual system — v1.0**  
**Position:** The trusted, independent record of a repair.  
**Creative idea:** *Proof, made visible.*

RepairProof should feel like a precise instrument used by skilled people: calm, legible, durable, and easy to trust. The visual system is built from evidence markers, measured geometry, clear status language, and useful contrast. It avoids the visual clichés of consumer fintech, generic AI products, and anonymous repair-shop software.

## 1. Brand personality

| Trait | Expression | Avoid |
|---|---|---|
| Trustworthy | Clear evidence, plain terms, consistent outcomes | Claims of certainty without supporting records |
| Technically exact | Alignment, measurement, careful typography, useful detail | Decorative circuit traces and fake technical jargon |
| Open | Show what is known, unknown, changed, and approved | Hiding caveats behind badges or color |
| Accountable | Attribute actions and preserve a traceable timeline | Blame language or uneditable “perfect” histories |
| Human and capable | Respect technicians’ craft and customers’ questions | Cold industrial language or cute gadget mascots |
| Globally usable | Neutral English, readable numerals, adaptable layouts | Culture-specific symbols and text baked into graphics |

**Archetype:** The independent inspector, supported by the craftsperson. RepairProof gives skilled repair work a clear record; it does not position itself as judge, manufacturer, or repair shop.

## 2. Positioning

**For** independent repair professionals, their customers, and people evaluating a repaired device, **RepairProof is** an independent repair verification platform **that** turns the work into a transparent record of condition, diagnosis, parts, authorization, testing, and warranty. **Unlike** a receipt or shop database, RepairProof connects the evidence to a verifiable repair certificate that can be reviewed later.

### Core promise

**A clear record of what was found, what was done, and what was checked.**

### Reasons to believe

- Timestamped intake and repair evidence.
- Itemized estimates and customer authorization.
- Traceable repair actions and component provenance.
- Recorded post-repair checks.
- A shareable certificate with a public, privacy-conscious verification view.

Never promise that a repair is “perfect,” that evidence is impossible to alter, or that a certificate proves facts beyond the records captured. Say “documented,” “recorded,” and “verifiable” with care.

## 3. Brand narrative

Repair work is skilled, but too much of it disappears into a verbal explanation, a paper receipt, or a database only one shop can see. That leaves technicians carrying the burden of proving what they found and customers guessing what they approved.

RepairProof gives the work a record. It starts with the device as received, follows the diagnosis and estimate, captures the customer’s decision, records the repair and checks, then seals the result into a certificate that can be reviewed later. Each step makes the next one easier to understand.

RepairProof does not replace the technician’s judgment. It makes that judgment, the supporting evidence, and the customer’s choices visible. Good work deserves a good record.

**Brand line:** *Proof, made visible.*  
**Supporting line:** *A clear record for every repair.*

## 4. Logo direction

### Recommended direction: “The verified aperture”

Create a compact geometric mark from a square evidence frame with one open corner and a precise check/registration stroke inside. The frame references a captured image or inspection area; the check is formed as a measured path, not a generic tick pasted into a shield. A small notch or offset signals that the mark is a record boundary, not a security lock.

The mark must be recognizable at 16–24 px, work in one color, reproduce in laser print and certificate QR pages, and retain its silhouette without gradients. Pair with a wordmark in a clear humanist sans; set `Repair` and `Proof` in a single typographic wordmark, with optional weight contrast rather than two unrelated colors.

**Construction principles**

- Use a square-based grid and consistent stroke widths.
- Keep an open edge to suggest inspection and access, not enclosure.
- Make the internal stroke resolve as a verification gesture only after a second look.
- Avoid a literal phone, screwdriver, gear, shield, robot, fingerprint, or recycling arrows.
- Do not put microtype, circuit lines, or a QR pattern inside the logo.

**Lockups:** primary horizontal (mark + wordmark), stacked (small-format), mark-only app/favicon, monochrome certificate stamp. Maintain at least one mark-stroke of clear space. Minimum wordmark width 120 px digital / 28 mm print; mark minimum 16 px digital / 5 mm print. Do not use the mark as a status badge for individual case outcomes.

## 5. Symbol concepts

1. **Verified aperture (primary):** open inspection frame + measured check. Most ownable and useful across evidence capture, certificate, and navigation.
2. **Evidence pin:** a dot joined to a short horizontal rule and bracket, suggesting a precise annotation tied to a record. Strong secondary graphic device, not the master logo.
3. **Proof sequence:** three aligned marks for “recorded / reviewed / verified,” useful for lifecycle diagrams. Keep steps labeled; never imply all cases reached verification.

## 6. Typography

**Primary UI / brand face:** `Inter` (or system sans fallback) for broad language support, stable UI metrics, and strong legibility. If licensing and language coverage are confirmed, a custom-licensed humanist sans may become a brand asset later.

**Technical numerals:** use tabular numerals for case IDs, prices, timestamps, and measurements (`font-variant-numeric: tabular-nums`). Keep certificate codes monospaced using `IBM Plex Mono` or system monospace; use only for identifiers and data, never paragraphs.

**Hierarchy**

| Use | Style |
|---|---|
| Display / marketing headline | 40–56 px, 600–700, tight but not condensed; short lines |
| Page title | 28–32 px, 650–700 |
| Section title | 18–22 px, 600–650 |
| Body | 16 px, 400–450, line height 1.5 |
| Dense data / table | 14 px minimum, 400–500, line height 1.4 |
| Caption / helper | 13–14 px; never use low contrast to make it “secondary” |
| Case / certificate ID | 13–15 px mono, tabular numerals, letter spacing +0.02em |

Use sentence case. Reserve all caps for tiny technical labels and keep letter spacing modest. Avoid ultra-light weights and long all-caps headings.

## 7. Color system

### Brand palette

| Token | Hex | Role |
|---|---|---|
| `Proof Ink` | `#172B3A` | Primary brand text, dark theme surfaces, serious anchor |
| `Workshop Teal` | `#0B6B67` | Primary action and verification accent; distinctive without neon |
| `Signal Brass` | `#A56A17` | Evidence marker, attention accent; use sparingly |
| `Paper` | `#F6F5F0` | Warm light app canvas |
| `White` | `#FFFFFF` | Cards, forms, clear reading surfaces |
| `Slate` | `#52616B` | Secondary copy and neutral UI |
| `Line` | `#D7DEE0` | Borders and dividers |
| `Success` | `#28734D` | Successful checks, paired with text/icon |
| `Warning` | `#8A5A12` | Needs attention, paired with text/icon |
| `Error` | `#B23A3A` | Errors and failed checks, paired with text/icon |
| `Info` | `#315F8C` | Informational states |

No gradients are required. Teal is an action color, not a decorative wash. Brass signals a point of attention and should not be used for large fills with small text.

### Light theme tokens

| Token | Value |
|---|---|
| `--color-bg` | `#F6F5F0` |
| `--color-surface` | `#FFFFFF` |
| `--color-surface-raised` | `#FFFFFF` |
| `--color-text` | `#172B3A` |
| `--color-text-muted` | `#52616B` |
| `--color-text-subtle` | `#64737C` |
| `--color-primary` | `#0B6B67` |
| `--color-primary-hover` | `#085956` |
| `--color-primary-pressed` | `#064A47` |
| `--color-on-primary` | `#FFFFFF` |
| `--color-accent` | `#A56A17` |
| `--color-border` | `#D7DEE0` |
| `--color-border-strong` | `#AAB7BC` |
| `--color-focus` | `#145CC2` |

### Dark theme tokens

| Token | Value |
|---|---|
| `--color-bg` | `#101C24` |
| `--color-surface` | `#172833` |
| `--color-surface-raised` | `#1D303B` |
| `--color-text` | `#F2F5F3` |
| `--color-text-muted` | `#C0CBCB` |
| `--color-text-subtle` | `#AAB8BA` |
| `--color-primary` | `#55B8AE` |
| `--color-primary-hover` | `#73C9C0` |
| `--color-primary-pressed` | `#3A9F96` |
| `--color-on-primary` | `#102522` |
| `--color-accent` | `#E2B45F` |
| `--color-border` | `#334852` |
| `--color-border-strong` | `#597078` |
| `--color-focus` | `#8BB9FF` |

Dark mode should use layered, opaque surfaces rather than glass. Keep photographs and evidence images color-accurate; do not tint them to match theme.

### Semantic state colors

| State | Light | Dark | Required companion |
|---|---|---|---|
| Success / passed | `#28734D` | `#75C99A` | “Passed” label + check icon |
| Attention / pending | `#8A5A12` | `#E2B45F` | “Awaiting review” or precise status |
| Error / failed | `#B23A3A` | `#F08A83` | Failure text + error icon |
| Informational | `#315F8C` | `#84B9EB` | Plain status text |

Never encode meaning by color alone. Test actual text/background pairs, especially badges, disabled controls, overlays on photos, and hover/focus states.

## 8. Iconography

Use a consistent 1.75–2 px stroke family with rounded joins, simple geometry, and 16/20/24 px sizes. Lucide is an acceptable initial library; customize a small set of RepairProof-specific marks (aperture, evidence pin, certificate) rather than forking the whole library. Prefer familiar metaphors: camera, wrench/action, list/check, clock, document, link, download. Avoid redundant icons next to obvious labels, decorative icon clouds, and ambiguous shield/AI sparkles.

Icons that communicate case state always include visible text labels or accessible names. Interactive icon-only buttons require a tooltip and accessible name; touch target minimum 44 × 44 CSS px.

## 9. Illustration style

Use editorial line diagrams and exploded-view-inspired technical sketches: a few deliberate strokes, numbered callouts, small scale marks, and restrained flat fills. Draw real repair contexts at human scale; represent multiple device types and people without implying a specific region or income group. Use illustrations to explain a process or empty state, not to make the product feel futuristic.

Do not use robot characters, pseudo-technical circuit backgrounds, stock 3D blobs, or “AI brain” imagery. Keep labels as accessible HTML text, not embedded in SVG raster exports.

## 10. Photography direction

Photographs should look like credible workshop documentation: real benches, appropriate tools, natural task lighting, close-up evidence with enough context, and visible human hands when relevant. Show devices in realistic condition, not only pristine product renders. Avoid dramatic sparks, unsafe tool use, staged handshakes, anonymous call-center portraits, and implausible repair setups.

For product UI, evidence images remain neutral and unfiltered. Cropping may focus attention, but preserve context and disclose annotations. Marketing photography should be documentary rather than glossy; customers and technicians are collaborators, not hero/villain roles.

## 11. Motion principles

- Motion confirms an action or relationship: upload progress, newly added evidence, quote response, certificate ready.
- Use short durations (120–220 ms) for standard transitions; 250–350 ms only for larger panel/state changes.
- Prefer opacity and small positional shifts; avoid springy overshoot, spinning seals, parallax, or perpetual motion.
- Respect `prefers-reduced-motion`; all status changes remain understandable without animation.
- Never animate evidence itself in a way that obscures detail. Avoid delaying a user’s task for branded motion.
- Provide progress and failure text for asynchronous work; animation is not a substitute for a status.

## 12. Brand voice

**Voice:** precise, calm, respectful, transparent. Explain evidence and uncertainty in everyday language. Address technicians as professionals and customers as decision-makers.

| Do | Avoid |
|---|---|
| “The charging port was replaced. Charging and data transfer passed the recorded checks.” | “Your device is 100% fixed.” |
| “This estimate is version 2. Review the updated parts and total.” | “Oops! We made a little change.” |
| “No test result was recorded for water resistance.” | “All systems verified” when only some tests ran. |
| “The link expired. Ask the shop to send a new estimate.” | Legalistic error text or blame. |
| “Part source: aftermarket, as reported by the shop.” | Presenting a technician-entered source as independently authenticated fact. |

Use active voice, short sentences, exact dates/currency, and explicit actors. Label user-entered facts as reported or recorded. Never describe the platform as certifying quality independently when it is preserving shop-supplied evidence.

## 13. UI visual identity

### Overall composition

- Calm warm-neutral workspace with white/raised panels and strong ink typography.
- Grid-based layouts; 8 px spacing rhythm; generous whitespace around evidence and primary decisions.
- Compact, information-dense case tables are acceptable, but use row height and typography for scanability rather than small text.
- Use consistent 1 px borders, 8 px control radius, 12 px card radius. Reserve pills for status; use square/low-radius shapes for data structures.
- Keep primary action position and wording consistent. Destructive actions are visually distinct and require clear scope.
- Evidence views prioritize image fidelity, zoom, annotation coordinates, capture metadata, author, and timestamp.
- Certificate page should feel like a clear record, not a marketing landing page: identity, issue state/date, device summary, performed work, parts, tests, warranty, verification ID, and privacy statement.

### Core interaction patterns

- Case timeline shows who did what and when; corrections appear as new entries.
- Quote versions are visibly numbered and clearly identify the current version.
- Pass/fail/untested are three distinct states. “Not tested” must never look like “passed.”
- Public pages disclose only what is needed and never reveal customer contact or full serial/IMEI.
- Forms identify required fields, preserve entered data after recoverable errors, and show validation next to the field.
- Empty states explain the next useful action without promotional copy.

## 14. Accessibility and contrast requirements

Target WCAG 2.2 AA for the interface, with a practical goal of AAA contrast for long-form body text when feasible.

- Normal text contrast at least **4.5:1**; large text (24 px regular or 18.66 px bold) at least **3:1**.
- Essential non-text controls, focus indicators, and graphical state indicators at least **3:1** against adjacent colors.
- Do not use color as the sole signal. Add text, shape, icon, or pattern.
- Visible keyboard focus; focus ring at least 2 px with offset and sufficient contrast in both themes.
- Keyboard operation for menus, dialogs, tabs, timeline, image annotation, and upload. Provide a non-coordinate alternative for annotations (e.g. “Add note” list).
- Support browser zoom/reflow at 200% and narrow mobile widths without horizontal scrolling for core workflows.
- Use semantic landmarks/headings, labels, descriptions, error association, live status announcements, and meaningful image alt text.
- Respect reduced motion and high-contrast/forced-colors settings.
- Minimum touch target 44 × 44 CSS px where practical; never make critical controls tiny to fit a dense table.

The palette values above are design candidates; measure every implemented pairing with a contrast checker and automated/manual accessibility review. The intended pairs—light ink on paper/white, dark text on teal buttons, dark-theme near-white on ink surfaces—are selected for contrast, but state and translucent overlays need separate validation.

## 15. Design tokens

### CSS token starter

```css
:root {
  color-scheme: light;
  --rp-color-bg: #f6f5f0;
  --rp-color-surface: #ffffff;
  --rp-color-surface-raised: #ffffff;
  --rp-color-text: #172b3a;
  --rp-color-text-muted: #52616b;
  --rp-color-text-subtle: #64737c;
  --rp-color-primary: #0b6b67;
  --rp-color-primary-hover: #085956;
  --rp-color-on-primary: #ffffff;
  --rp-color-accent: #a56a17;
  --rp-color-border: #d7dee0;
  --rp-color-border-strong: #aab7bc;
  --rp-color-focus: #145cc2;
  --rp-color-success: #28734d;
  --rp-color-warning: #8a5a12;
  --rp-color-error: #b23a3a;
  --rp-radius-control: 8px;
  --rp-radius-card: 12px;
  --rp-shadow-card: 0 1px 2px rgb(23 43 58 / 8%);
  --rp-space-unit: 4px;
  --rp-font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --rp-font-mono: "IBM Plex Mono", ui-monospace, monospace;
}

[data-theme="dark"] {
  color-scheme: dark;
  --rp-color-bg: #101c24;
  --rp-color-surface: #172833;
  --rp-color-surface-raised: #1d303b;
  --rp-color-text: #f2f5f3;
  --rp-color-text-muted: #c0cbcb;
  --rp-color-text-subtle: #aab8ba;
  --rp-color-primary: #55b8ae;
  --rp-color-primary-hover: #73c9c0;
  --rp-color-on-primary: #102522;
  --rp-color-accent: #e2b45f;
  --rp-color-border: #334852;
  --rp-color-border-strong: #597078;
  --rp-color-focus: #8bb9ff;
  --rp-color-success: #75c99a;
  --rp-color-warning: #e2b45f;
  --rp-color-error: #f08a83;
  --rp-shadow-card: 0 1px 2px rgb(0 0 0 / 24%);
}
```

### Spacing and sizing scale

Use a 4 px base: `1=4`, `2=8`, `3=12`, `4=16`, `5=20`, `6=24`, `8=32`, `10=40`, `12=48`, `16=64`, `20=80` px. Standard input/button height 40–44 px; compact controls 36 px only for secondary dense contexts. Main content max width 1280 px; reading text max width 72 characters.

## 16. Brand governance and rollout

1. Approve the aperture mark direction and wordmark drawing with a professional vector designer; this document is a direction, not a finished trademark-cleared logo.
2. Check company/product name, domains, and mark availability in launch markets before filing or public identity rollout.
3. Implement semantic tokens in CSS first, then map Tailwind/shadcn semantic variables to those tokens. Replace generic blue only after checking every component state.
4. Create core assets: SVG mark, horizontal/stacked lockups, monochrome certificate stamp, favicon/app icon, social avatar, and accessible brand one-pager.
5. Test public quote and certificate journeys with technicians and customers at mobile sizes; validate clarity of “recorded by shop” versus “independently verified by RepairProof.”
