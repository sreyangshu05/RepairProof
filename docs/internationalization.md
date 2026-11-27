# RepairProof internationalization

## Locale foundation

The web application uses a typed message catalog in `apps/web/src/i18n/catalog.ts` and `I18nProvider` for locale selection. Supported locales are English (India, `en-IN`), Bengali (Bangladesh, `bn-BD`) and Hindi (India, `hi-IN`). The selected display locale is saved in browser local storage when available. If storage is blocked, selection remains active for the current session. English is the fallback source locale for missing catalog entries.

Use `useI18n()` for interface copy and localized dates, numbers and currencies. Shared non-component formatters read the active HTML language. Dates/numbers/currency are display formatting only: quotation currency, transaction values, timestamps and canonical repair status codes must remain unchanged in storage and API payloads. Pass a record's currency explicitly to `formatCurrency`; only currency-less display values use the locale default (INR for `en-IN` and `hi-IN`, BDT for `bn-BD`).

## Terminology and review

Repair vocabulary is kept in stable `term.*` entries in the catalog. Current translations distinguish the technician's findings and measurements from a definitive conclusion, and distinguish evidence from independent verification. Do not translate enum identifiers, API fields, model names, serials, certificate IDs or user-entered repair text. A fluent Bengali/Hindi translator and a repair-domain reviewer must approve changes to diagnosis, part, quotation, test and warranty language before release. Do not use machine-only translation for those safety and financial terms.

## Adding a locale

1. Add the BCP 47 locale to the `Locale` type through the catalog and include every English source key in its dictionary.
2. Add the language option, locale-specific default display currency only where product policy defines one, and typography fallback.
3. Add locale formatting checks for dates, numbers and money. Preserve explicit transaction currencies.
4. Review long labels at 200% text size and on narrow screens; prefer wrapping and flexible widths over clipping or smaller type.
5. Have a fluent translator and relevant technical reviewer approve the glossary, validation messages, emails and public legal content.

## Typography and layout

Bengali and Devanagari system font stacks are selected from `html[lang]`. They use installed system fonts and do not fetch fonts from a third party. Rendering can differ across devices; bundle properly licensed WOFF2 subsets if consistent cross-device typography becomes a product requirement. Layout must allow text expansion, avoid fixed-height text containers, and keep touch controls at least 44 CSS pixels high.

## Current scope

The public landing and account entry, shared role workspace, consumer dashboard, technician queue/workflow screens, public certificate verification and customer authorization pages route interface copy through the English/Bengali/Hindi catalogs. The old `/legacy/*` paths are compatibility redirects into maintained routes; they no longer render a separate legacy interface. Canonical lifecycle and evidence-scan states are translated at display time without changing API values.

Signed-in users save their locale on their profile. A customer opening a secure authorization link can select a language before signing in; the choice is stored on that repair case so later quotation and status notices use the same locale. Notification templates cover supported repair, quotation, warranty, dispute and certificate events. Quotation emails preserve the secure action URL while localizing instructions. The API client sends `Accept-Language`; known user-facing errors have catalog translations and unrecognized errors fall back to a generic localized message rather than showing untranslated server error details.

Dynamic customer and technician text such as symptoms, diagnostic findings, proposed repair, warranty terms, evidence descriptions and filenames remains in its original language. It is never silently machine-translated, because translation could change technical or contractual meaning. Device and shop names, model identifiers, serials, IMEIs, certificate numbers, invoice references and currency values are data, not interface copy; identifiers and amounts are preserved while dates and numbers are locale-formatted where appropriate. Email content supplied by a repair record remains unchanged. New user-facing copy should enter the catalog from the start.

This establishes route and delivery coverage, not a claim that every dynamic backend message or all legal/operational material has been professionally reviewed. A fluent Bengali/Hindi translator and repair-domain reviewer must approve safety, financial, warranty and consent language before launch; edits to those phrases should be reviewed just like workflow code.

Right-to-left layout is not enabled because current supported scripts are left-to-right. Add `dir` handling and directional layout review if a right-to-left locale is introduced.
