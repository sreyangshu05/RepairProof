# RepairProof technical SEO

## Public indexable surface

Only the public homepage (`/`) is submitted for indexing. It describes the current product as electronics repair documentation and verification software. The current site does not have distinct, substantive public product-detail pages, so the sitemap contains one canonical URL rather than thin duplicate SPA routes.

`VITE_APP_URL` should be set at web build time to the actual HTTPS production origin. On a Vercel production build, the SEO generator and browser metadata can fall back to Vercel's configured production project domain. Preview, local, localhost, and placeholder builds remain `noindex`. If neither a valid explicit origin nor a Vercel production domain is available, the build emits `robots.txt` with `Disallow: /` and an empty sitemap; do not publish a fake canonical URL or submit a placeholder sitemap.

When configured, the build generates:

- A canonical homepage URL and Open Graph URL.
- A homepage title/description, Open Graph fields, and Twitter summary metadata.
- `dist/sitemap.xml` containing only the homepage.
- `dist/robots.txt` allowing the public page, excluding API crawling, and naming the sitemap.
- `WebSite` and `SoftwareApplication` JSON-LD describing only the RepairProof software product. No aggregate rating, review, address, legal identity, pricing, certification, customer, partnership, or outcome statistic is asserted.

## Private and dynamic routes

Consumer, technician, shop, admin, login, signup, customer-authorization, certificate lookup, legacy workspace, and API paths are `noindex`. React updates page titles and meta directives for client navigation; Vercel response headers and the Nginx deployment add `X-Robots-Tag: noindex, nofollow, noarchive` to private paths so crawler handling does not depend only on JavaScript. Do not place customer records, evidence URLs, tokens, device identifiers, or certificate detail URLs in the sitemap or structured data.

`robots.txt` does not provide access control and can be ignored. Sensitive data must remain protected by the application authorization layer. `X-Robots-Tag` and meta `noindex` reduce indexing; they do not make a public route private.

## Content, accessibility, and performance

The landing page has one descriptive H1, section headings, semantic navigation/main/footer landmarks, text-based product explanations, and keyboard-operable calls to action. Its interface preview is rendered with local UI/CSS rather than a large stock image. Keep copy accurate to enabled product behavior. Do not add review/rating markup, fake local-business information, thin keyword pages, or unsupported claims. When creating a genuinely useful public page, provide a distinct title, description, canonical URL, accessible heading hierarchy, and add it to the sitemap only after confirming it contains no customer-specific data.

## Build and verification

Set `VITE_APP_URL` in Vercel's production build environment when the intended public origin differs from the project's production domain. Otherwise Vercel's production-domain system variable is used only for production builds; preview/local builds stay `noindex`. For a Docker release, set `VITE_APP_URL` explicitly. The SEO generator runs as the web `postbuild` script; Nginx supplies noindex response headers for private paths. Verify the deployed `/`, `/robots.txt`, `/sitemap.xml`, and representative private routes with `curl -I` and a rendered browser. Confirm the canonical exactly matches the production hostname, private pages carry the response header, and the sitemap contains only approved public URLs. Recheck Search Console after the real domain is live; this repository has no live Search Console/analytics connection and makes no ranking or indexing claim.
