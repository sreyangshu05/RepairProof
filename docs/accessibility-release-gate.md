# Accessibility release gate

**Status: evaluation plan; not a WCAG conformance report.** Existing Chromium checks cover selected keyboard, landmarks, dialogs, responsive behavior, touch sizing, and contrast samples. They do not cover all pages/states or substitute for assistive-technology evaluation. No axe scan or manual screen-reader run is recorded here.

## Required release evidence

1. Run the current browser suite: `REPAIRPROOF_WEB_URL=<staging-url> python -m pytest apps/web/tests/e2e -q`. Record commit, URL, browser version, viewport set, failures, and screenshots/traces. The suite's mocked flows must be labeled; it does not test backend persistence.
2. Add/run axe-core on each rendered role and primary state once the dependency is available; review every serious/critical finding rather than suppressing rules globally. Record component, route, state, WCAG criterion, fix, and retest.
3. Manual keyboard-only pass: registration/login, case intake, diagnostics, evidence selection/upload errors, quote, customer authorization, repair actions, test submission, dispute, and dialogs. Verify visible focus, logical order, Escape/close, focus restoration, and no keyboard traps.
4. Manual screen-reader pass with NVDA + a supported desktop browser; run VoiceOver + Safari for supported iOS/Safari. Verify heading/landmark order, labels, required/invalid fields, error and success announcements, table headers, async updates, and modal names.
5. Check text and non-text contrast in normal/hover/focus/disabled/error/success states and both themes. Check reflow at 320, 360, 390, 768, 1024, and 1440px; ensure no essential content/actions disappear. Verify 24x24 CSS-pixel minimum target exceptions are not relied on where 44px targets are intended by the product system.
6. Check reduced motion, zoom/reflow, text spacing, language metadata, descriptive link names, meaningful image alternatives, and chart text equivalents.

## Stop-ship criteria

Do not release with a keyboard-blocking interaction, focus loss in a modal/route change, inaccessible required/error state, information conveyed only by color, screen-reader-inaccessible critical workflow, or serious/critical automated finding without reviewed disposition. Scope any eventual WCAG statement to the tested pages, states, assistive technologies, and date. A passing automated scan alone is not proof of WCAG 2.2 AA conformance.
