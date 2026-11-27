# RepairProof Design System

**Version:** 1.0  
**Audience:** Product design and frontend engineering  
**Implementation:** React + TypeScript + Tailwind CSS + Radix UI primitives  
**Purpose:** A shared visual and interaction language for the technician workbench, shop control center, customer repair view, and platform operations console.

This is the implementation source of truth for reusable web UI. Brand strategy remains in `REPAIRPROOF-BRAND-IDENTITY.md`; role journeys remain in `REPAIRPROOF-EXPERIENCE-DESIGN.md`. Use semantic tokens here rather than local color, spacing, radius, or shadow literals.

## 1. Design principles

1. **Evidence first:** preserve image fidelity and clearly distinguish reported, observed, and tested facts.
2. **Calm precision:** use clear hierarchy, stable layouts, restrained color, and predictable controls.
3. **Accessible by default:** keyboard and screen-reader behavior is part of each component contract.
4. **Explicit states:** loading, pending, failed, passed, untested, disabled, and destructive states are distinct.
5. **Responsive by intent:** complex tables adapt to card/scroll patterns; they do not simply shrink text.
6. **One component, one contract:** role-specific screens compose shared primitives instead of creating parallel styling systems.

## 2. Semantic color tokens

Values are defined in `apps/web/src/index.css` as HSL channel variables for Tailwind compatibility. Do not add component-local hex values; extend semantic tokens centrally.

| Semantic token | Light | Dark | Use |
|---|---|---|---|
| `background` | Paper `#F6F5F0` | Ink `#101C24` | App canvas |
| `foreground` | Ink `#172B3A` | Near-white `#F2F5F3` | Main text |
| `card` | `#FFFFFF` | `#172833` | Card/dialog surface |
| `popover` | `#FFFFFF` | `#172833` | Select/menu/tooltip surface |
| `primary` | Teal `#0B6B67` | Teal `#55B8AE` | Primary actions/links |
| `primary-foreground` | `#FFFFFF` | `#102522` | Text on primary |
| `secondary` | Mist `#E8EFF0` | `#293B45` | Secondary controls |
| `muted` | Warm mist `#F0EFE8` | `#293B45` | Quiet surfaces |
| `muted-foreground` | Slate `#52616B` | `#C0CBCB` | Secondary text |
| `accent` | Brass `#A56A17` | Gold `#E2B45F` | Small evidence emphasis |
| `destructive` | Red `#B23A3A` | Soft red `#F08A83` | Destructive/error state |
| `success` | Green `#28734D` | Soft green `#75C99A` | Success state |
| `warning` | Deep amber `#8A5A12` | Gold `#E2B45F` | Warning state |
| `info` | Blue `#315F8C` | Light blue `#84B9EB` | Informational state |
| `border` | `#D7DEE0` | `#334852` | Dividers/control outlines |
| `input` | `#C2CDD0` | `#435A63` | Input border |
| `ring` | `#145CC2` | `#8BB9FF` | Focus ring |

**Rules:**

- Use `text-foreground`/`text-muted-foreground`, `bg-background`/`bg-card`, and semantic status tokens.
- Do not use primary as a decorative background wash. Brass is an accent and not a default button color.
- Statuses always include a text label and, where helpful, an icon. Do not communicate status with color alone.
- Avoid opacity-based text colors for essential content; use explicit theme tokens.
- Recheck contrast for every actual token pairing and component state, including hover, disabled, borders, and chart marks.

## 3. Typography

Font families: `font-sans` uses Inter/system sans; `font-mono` uses IBM Plex Mono/system monospace. No external font request is required for a functional fallback.

| Token/class | Size / line height | Weight | Use |
|---|---:|---:|---|
| `text-display` | 48/56 px desktop; 36/44 mobile | 650–700 | Marketing or onboarding hero only |
| `text-page-title` | 30/38 px | 650–700 | Main page heading |
| `text-section-title` | 20/28 px | 600–650 | Section headings |
| `text-card-title` | 16/24 px | 600 | Card headings |
| `text-body` | 16/24 px | 400 | Standard product content |
| `text-body-sm` | 14/20 px | 400–500 | Dense descriptions and table rows |
| `text-label` | 14/20 px | 500–600 | Form labels and controls |
| `text-caption` | 13/18 px minimum | 400–500 | Metadata/helper text |
| `text-code` | 13–15 px / 20 px | 400–500 | Case IDs, certificate codes |

Use sentence case, semantic heading order, and tabular numerals for prices/timestamps (`rp-data`). Never reduce essential table text below 14 px. Use mono only for codes and technical identifiers.

## 4. Spacing, responsive breakpoints, and grid

### Spacing

Base unit is 4 px. Allowed spacing tokens: `0`, `1` (4), `2` (8), `3` (12), `4` (16), `5` (20), `6` (24), `8` (32), `10` (40), `12` (48), `16` (64), `20` (80), `24` (96). Prefer the nearest token; use arbitrary values only for a documented geometry constraint (e.g. annotation overlay coordinate).

### Breakpoints

| Token | Width | Layout intent |
|---|---:|---|
| `xs` | 480 px | Small phone landscape / compact forms |
| `sm` | 640 px | Large phone; two-column small groups where appropriate |
| `md` | 768 px | Tablet; desktop navigation may begin |
| `lg` | 1024 px | Workbench side navigation and multi-panel case views |
| `xl` | 1280 px | Standard desktop content max width |
| `2xl` | 1440 px | Wide tables and multi-panel dashboards |

Breakpoints are layout decisions, not device categories. Test at 320 px and between breakpoints; do not assume a tablet has a mouse.

### Grid

- App shell: 12 columns at `lg+`, 8 at `md`, 4 at mobile; 24 px desktop gutters, 16 px mobile gutters.
- Main content max width: 1280 px; reading content max width: 72 characters.
- Technician case detail: primary content 8 columns + contextual rail 4 columns at wide layouts; stack below 1024 px.
- Shop dashboard cards: 4 columns at 1440+, 3 at 1024+, 2 at 640+, 1 on small mobile.
- Forms: one column by default. Pair fields only when semantically related and both retain adequate width.
- Data tables: preserve columns on desktop; on narrow widths use horizontal scrolling with a visible cue or transform rows to labeled cards. Never silently hide critical case status, price, or action.

## 5. Shape, elevation, icon, and motion

### Border radii

| Token | Value | Use |
|---|---:|---|
| `rounded-sm` | 6 px | Small tags / inner controls |
| `rounded-md` | 8 px | Inputs, buttons, menus |
| `rounded-lg` | 12 px | Cards, dialogs |
| `rounded-full` | 9999 px | Status badges, avatars only |

Avoid pill-shaped primary buttons and excessive nested rounded surfaces.

### Elevation

- Level 0: flat canvas, no shadow.
- Level 1 / `shadow-card`: `0 1px 2px rgb(23 43 58 / 8%)` light; subtle dark shadow in dark theme. Standard card.
- Level 2: `0 8px 24px rgb(16 28 36 / 14%)`; popovers and menus.
- Level 3: `0 20px 48px rgb(0 0 0 / 24%)`; modal/dialog only.
- Use borders and surface shifts before adding shadow. No glass blur or floating dashboard tile decoration.

### Icon rules

- Use Lucide React at 16/20/24 px, consistent 1.75–2 px strokes.
- Icons supplement labels; status icons supplement status words.
- Icon-only buttons require accessible name, tooltip where discoverability benefits, and 44 × 44 px target.
- Decorative icons use `aria-hidden="true"`; avoid emoji and mixed icon families.
- Never use icon color alone to indicate pass/fail/priority.

### Animation

- Standard interaction: 120–180 ms; panel transition: 180–250 ms.
- Prefer opacity and small positional changes; no bounce, continuous motion, or decorative shimmer beyond short skeleton loading.
- Respect `prefers-reduced-motion`; current global CSS removes nonessential movement.
- Animation must not carry information unavailable in text or delay work.

## 6. Form standards

- Use a visible label for every control; placeholders are examples, never labels.
- Place hint and error text near the field and connect with `aria-describedby`; set `aria-invalid` when invalid. `FormField` provides this pattern.
- Required status is explicit in text/accessible name; do not rely only on an asterisk.
- Inputs/selects are at least 44 px tall on mobile and use 16 px mobile text to avoid browser zoom behavior.
- Input state: default, hover, focus-visible, invalid, disabled, read-only, loading. Error border is accompanied by message/icon/text.
- Preserve values after recoverable errors. Validate on blur/submit without interrupting typing.
- Checkbox/radio labels are clickable, with at least 44 px row targets. Radio groups have a group label and mutually exclusive options.
- Select is for a short known list; use searchable combobox only when the list is long. Provide “Not known” where absence is valid; do not encode blank as a meaningful value.
- Textarea grows or scrolls predictably; provide character guidance only when a real limit matters.
- Destructive confirmation explains the exact object and impact. Do not use dialogs for routine reversible actions.

## 7. Component inventory and contracts

All components live under `apps/web/src/components/ui/`. Add feature-specific composition under the feature folder; do not fork primitive styles locally.

| Component | Variants / states | Keyboard and accessibility | Responsive behavior |
|---|---|---|---|
| **Button** | `default`, `secondary`, `outline`, `ghost`, `link`, `destructive`, `success`; `sm`, `default`, `lg`, `icon`; disabled/loading | Native `<button>` semantics; focus ring; icon-only needs `aria-label`; loading retains accessible name and uses `aria-busy`. | Full-width on narrow form footers where useful; icon size target 44×44. |
| **Input** | text/email/search/number/date/file; default, focus, invalid, disabled, read-only | Native input; associated visible label; `aria-describedby`, `aria-invalid`. | 44 px min height mobile; file input styling follows same semantic focus. |
| **Select** | default, disabled, invalid; grouped items, labels, separator | Radix: arrows to navigate, Enter/Space select, Escape closes, type-ahead; trigger announces label/value. | Portal position follows viewport; menu max-height scrolls. |
| **Textarea** | default, focus, invalid, disabled; vertical resize | Native textarea; label and description; preserve text on failure. | Full width, min 112 px, avoid fixed tiny height on phone. |
| **Checkbox** | unchecked, checked, indeterminate, disabled, invalid | Space toggles; label is separate and associated; Radix semantics. | 20 px control with generous clickable label row. |
| **Radio group** | selected/unselected/disabled; vertical or horizontal | Arrow keys move/select; Space selects; named group and option labels. | Stack choices on narrow widths; do not force horizontal overflow. |
| **Dialog** | standard, destructive confirmation, form; open/closed | Radix traps focus, Escape closes where safe, returns focus to trigger; require title and description. | Centered bounded dialog; max-height scroll; nearly full width on mobile. |
| **Drawer** | left/right/bottom | Dialog semantics and focus management; Escape close; visible close control. | Side drawer at desktop; bottom sheet on mobile, respects safe area. |
| **Dropdown menu** | item, checkbox, radio, submenu, destructive | Radix arrow navigation, Home/End, type-ahead, Escape; do not place complex forms in menu. | Collision-aware portal, scrollable if long. |
| **Tabs** | horizontal/vertical, default/selected/disabled | Radix tablist; arrows move focus, Home/End as supported; tab panels labeled. | Horizontal scroll/overflow or select alternate navigation on narrow screens. |
| **Tooltip** | default/long description | Trigger remains keyboard focusable; Escape dismisses; no essential content only in tooltip. | Collision-aware; short content and no hover-only mobile dependency. |
| **Badge** | default, secondary, outline, success, warning, info, destructive | Noninteractive by default; text label; status icon optional. | Wraps naturally; do not truncate critical status. |
| **Card** | default, interactive, selected, warning | Interactive card uses a real link/button, not clickable `div`; heading structure is owned by caller. | Padding reduces from 24 to 16 px on small screens. |
| **Table** | default, selectable, sortable composition | Use `<caption>`, `<th scope>`, row labels; sort controls are buttons with state. | Horizontal scroll with cue or labeled mobile card alternative; keep critical data present. |
| **Pagination** | numbered, previous/next, ellipsis | `nav` label, page link, `aria-current="page"`, disabled semantics. | Show fewer page numbers; keep previous/next accessible. |
| **Breadcrumb** | path with current page and collapsed ancestors | `nav` named Breadcrumb, ordered list, `aria-current=page`; separators hidden from AT. | Collapse ancestors with accessible menu; keep current page visible. |
| **Alert** | info, success, warning, destructive | `role=status` polite by default; assertive only for urgent errors; title and message. | Full width; actions wrap below message. |
| **Notification / toast** | default, success, warning, destructive; action/dismiss | Radix live-region behavior; concise, noncritical; persistent errors also appear inline. | Bottom-right desktop; bottom safe-area mobile; viewport does not cover critical controls. |
| **Skeleton** | text, avatar, card, table row via composition | `aria-hidden`; parent announces loading state with text and `aria-busy`. | Match final layout to reduce layout shift. |
| **Empty state** | neutral, filtered/no-results, first-use, error-adjacent | Heading, concise explanation, one primary next action; illustration decorative. | Compact on mobile; no large decorative art pushing task below fold. |
| **Data visualization** | line/bar/stacked/status summary, table fallback | Provide title, units, data table or text equivalent; patterns/labels supplement color. | Simplify labels; allow scroll or switch to summary on phone. No hover-only data. |
| **FormField** | label, hint, required, error | Associates label/description/error and sets `aria-invalid` on child. | Spacing and labels remain visible; not placeholder-only. |

## 8. Component-specific design rules

### Buttons

- One primary action per region. Secondary and destructive actions are visually subordinate.
- Loading uses stable width and text such as “Saving…”; prevent duplicate submits.
- Never use `success` variant for the main navigation action; success is for a completed task where appropriate.
- `asChild` links must retain anchor semantics and keyboard focus.

### Tables and pagination

- Default page size 25; offer 10/25/50 only when dataset use warrants it.
- Use server-side sorting/filtering for large tenant datasets; show active filters and clear-all.
- Row actions are buttons/menus with labels. Avoid making entire rows ambiguous click targets.
- Preserve selected rows and filters on pagination; announce result range.

### Alerts and notifications

- Inline alert is persistent context; toast is brief feedback. Never use a toast as the only record of customer approval, certificate issue, or failed upload.
- Toasts should not interrupt focus. Auto-dismiss only low-risk success messages; errors remain long enough or are persistent.
- Announce asynchronous state changes politely; reserve assertive live regions for urgent errors.

### Data visualizations

- Use charts only to answer a real shop/platform question. MVP cases often need a sortable table before charts.
- Charts require title, period, units, source/update time, labels/tooltips available by keyboard, and a screen-reader text/table equivalent.
- Use a colorblind-safe categorical palette derived from semantic status tokens; distinguish series with direct labels or line patterns.
- Do not use red/green alone. Keep scales honest, show zero/baseline where relevant, and label missing data as missing rather than zero.
- Use native SVG/canvas only through a documented wrapper with accessible fallback. Select a chart library when the first actual visualization is scoped.

## 9. Keyboard interaction summary

| Pattern | Expected keys |
|---|---|
| Button/link | `Tab`/`Shift+Tab`; `Enter` activates link/button; `Space` activates button |
| Checkbox | `Space` toggles |
| Radio group | Arrow keys move; `Space` selects |
| Select/menu | `Enter`/`Space` opens; arrows navigate; type-ahead; `Escape` closes |
| Dialog/drawer | Focus enters; `Tab` stays inside; `Escape` closes if safe; close returns focus |
| Tabs | Arrow keys among tabs; `Home`/`End` when supported; `Tab` into active panel |
| Table | Native row/cell reading; sort controls are ordinary buttons; no custom grid unless full grid keyboard model is implemented |
| Pagination | Tab to links; current page has `aria-current`; disabled items are not focusable |

Do not intercept standard keys without a strong reason. Provide a visible focus indicator on all interactive elements.

## 10. Accessibility acceptance bar

- Target WCAG 2.2 AA.
- Normal text contrast ≥4.5:1; large text ≥3:1; essential UI boundary/focus indicator ≥3:1 against adjacent color.
- Do not use color alone; every state has text or shape/label.
- Full keyboard support and logical focus order; no keyboard trap except correctly managed modal focus.
- Focus ring is at least 2 px with offset; do not remove browser outline without replacement.
- Reflow at 320 CSS px and zoom 200% without loss of core actions; respect reduced motion and forced colors.
- Touch target 44×44 CSS px where practical, especially icon buttons, checkboxes, and radio labels.
- Inputs have labels, instructions, and associated validation. Errors are identified in text and announced.
- Tables/charts use semantic headers and nonvisual equivalents; images have meaningful alt or are marked decorative.
- Test light and dark states, keyboard-only flows, screen-reader announcements, and contrast values—not just token swatches.

Palette tokens are candidates until measured in rendered contexts. Any exception must be documented with the use case and accessible alternative.

## 11. Naming and contribution rules

- Component filenames use `kebab-case.tsx`; exported React component names use `PascalCase`.
- Components expose semantic props (`variant`, `size`, `disabled`) and compose with `className` only as a controlled extension point.
- Feature components compose primitives; they do not copy primitive CSS.
- New tokens are added to CSS variables and Tailwind mapping together. Avoid raw hex/HSL values in feature components.
- Variants should map to purpose, not arbitrary visual combinations. Avoid boolean prop explosion.
- Add story/demo coverage for complex stateful primitives as the component inventory grows; use real content and narrow/wide layouts.
- Changes to keyboard, focus, ARIA, or responsive behavior are API changes and need review.

## 12. Implemented starter components

The current React app has semantic styles and the following shared primitives added or aligned:

- Updated: Button, Input, Card, Badge, Tabs.
- Added: Textarea, Select, Checkbox, RadioGroup, FormField, Alert, Dialog, Drawer, DropdownMenu, Tooltip, Notification, Skeleton, EmptyState, Table, Pagination, Breadcrumb.
- Existing Radix UI packages supply focus management and keyboard behavior; no new runtime dependency was added.

The system deliberately does not include a chart library, date picker, combobox, or complex grid yet. Add these when a real workflow needs them, with an accessible pattern and an ADR if the dependency is substantial.
