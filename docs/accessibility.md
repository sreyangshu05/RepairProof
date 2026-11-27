# RepairProof accessibility engineering

## Target and audit status

RepairProof targets WCAG 2.2 Level AA for applicable web content. This audit record is not a conformance claim. Automated browser checks cover selected routes, rendered text contrast pairs, semantics, and interactions; they do not replace assistive technology and manual review.

## Corrections made

- Replaced the public repair preview's hand-written tabs with Radix Tabs, including tab/panel relationships, selected state, roving focus, and arrow-key navigation.
- Shared dialog and drawer primitives set `aria-modal="true"` and explicitly restore focus to the opening element when dismissed, including controlled dialogs without a Radix trigger.
- Role workspaces have a visible-on-focus skip link to a focusable main landmark. Route changes move focus to the new page heading.
- The landing page's scripted scroll respects `prefers-reduced-motion`.
- Repair list tables have named, focusable horizontal scroll regions and scoped column headers.
- Public certificate and customer authorization pages expose main landmarks. Public certificate lookup and account forms have programmatic labels and error announcements.
- Repair detail forms have explicit labels and IDs. Verification checklist controls use semantic buttons and pressed state instead of clickable non-semantic elements.
- Removed unsafe response typing in audited UI areas and resolved hook dependency and unused-import issues encountered during the changes.

## Component and product requirements

### Navigation and focus

- Use links for navigation and buttons for actions. Icon-only controls require an accessible name.
- Each page needs a `main` landmark and one clear level-one heading. Include a skip link in every distinct application shell.
- On client-side route changes, move focus to the new page heading. Preserve focus restoration when dismissing a modal or menu.
- Use a disclosure for non-modal menus. Use the shared Radix dialog/drawer primitive for modal tasks; retain its title, description, Escape handling, focus containment, and trigger focus restoration.
- Keep a visible focus indicator on all keyboard-operable controls.

### Forms and errors

- Use `FormField` or an equivalent programmatic label. Placeholder text is never the sole label.
- Connect help and validation text with `aria-describedby`; set `aria-invalid` only while invalid. Keep errors in text and announce submitted errors with an alert or focused summary linked to fields.
- Preserve entered values when a submission fails. Mark required fields in text/accessibility name and visually.
- Announce asynchronous changes with a concise status region. Avoid announcing frequently changing timers or every keystroke.

### Tables, charts, and status

- Use native table markup, explicit header scopes, and a caption or accessible region name. If a table scrolls horizontally, make the scroll viewport keyboard-focusable and name it.
- Do not encode repair status, severity, or test results by color alone. Include visible text labels.
- No data visualization chart is present in the current React experience. Future charts must have an accessible summary and equivalent readable data table or list; color and tooltips cannot be the only explanation.

### Contrast, targets, motion, and language

- Normal text requires at least 4.5:1 contrast; large text requires 3:1. Non-text controls and focus indicators must remain distinguishable. Test rendered combinations including badges and disabled/error states, not only token names.
- Prefer a 44 by 44 CSS pixel target for touch controls. WCAG 2.2 AA's minimum target criterion is 24 by 24 CSS pixels with exceptions; the product standard is larger.
- Respect reduced-motion preferences in CSS and scripted transitions. Preserve state and meaning when animation is removed.
- Set a correct document language (`lang="en"` currently). Mark passages in other languages with their own `lang`; use plain language and do not use color alone.

## Verification run

Run from the repository root:

```powershell
pnpm --filter @repairproof/web run build
pnpm --filter @repairproof/web run lint
pnpm --filter @repairproof/web run test
python -m pytest apps/web/tests/e2e -q
```

The Chromium suite covers selected public/authenticated pages for document language, landmarks, headings, control names, unique IDs and ARIA references; tab keyboard operation; reduced-motion scrolling; skip links and route focus; dialog modal semantics, focus containment, Escape and focus restoration; table region/header semantics; form error announcements; narrow viewport navigation and 44px targets; and selected rendered text contrast pairs in light/dark themes.

Latest run: production build succeeded; ESLint completed with no warnings or errors; Vitest passed **3/3**; Chromium/Pytest passed **36/36**. The browser suite's rendered contrast checks cover three pages in both themes (six page/theme combinations), not every role, component, state, or non-text contrast requirement. Semantic-token contrast checks likewise cover selected pairs only.

## Remaining checks and limits

- NVDA, VoiceOver, and other screen readers were not manually tested. Verify public and authenticated role journeys with NVDA + Firefox/Chrome and VoiceOver + Safari, including forms, validation, dialogs, tables, and status announcements.
- Zoom/reflow at 200% and 400%, Windows High Contrast/forced colors, text-spacing overrides, speech input, and touch screen-reader operation remain untested.
- Review all role/state combinations for text and non-text contrast, especially badges, evidence controls, and destructive/disabled states.
- There is no chart today; apply the equivalent-data requirement when one is introduced.
- An axe-core browser scan could not be added: installing the test dependency failed because package registry access was denied (`EACCES`). No axe scan is claimed.

Keep these checks in feature acceptance criteria and design-system component reviews; do not defer accessibility to release hardening.
