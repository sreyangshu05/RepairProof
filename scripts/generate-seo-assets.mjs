import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve(process.cwd(), 'dist');
const indexPath = resolve(outputDirectory, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');
const origin =
  getPublicOrigin(process.env.VITE_APP_URL) ??
  (process.env.VERCEL_ENV === 'production'
    ? getPublicOrigin(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? ''}`)
    : null);

if (!origin) {
  await writeFile(
    resolve(outputDirectory, 'robots.txt'),
    'User-agent: *\nDisallow: /\n',
  );
  await writeFile(
    resolve(outputDirectory, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n',
  );
  await writeFile(
    indexPath,
    indexHtml.replace(
      /<meta name="robots" content="[^"]*"\s*\/>/,
      '<meta name="robots" content="noindex, nofollow" />',
    ),
  );
  console.warn(
    '[seo] No public HTTPS production origin is configured; generated a safe noindex build with an empty sitemap. Set VITE_APP_URL or deploy to Vercel production with its production domain configured to enable indexing.',
  );
  process.exit(0);
}

const description =
  'Document electronics repairs from diagnosis and customer approval through repair actions and post-repair checks. Keep a clear digital repair record.';
const home = `${origin}/`;
const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: 'RepairProof', url: home, description },
    {
      '@type': 'SoftwareApplication',
      name: 'RepairProof',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: home,
      description,
    },
  ],
};
const safeJsonLd = JSON.stringify(graph).replace(/</g, '\\u003c');
let generatedIndex = indexHtml
  .replace(
    /<meta name="robots" content="[^"]*"\s*\/>/,
    '<meta name="robots" content="index, follow" />',
  )
  .replace('</head>', `<link rel="canonical" href="${home}" />\n    <meta property="og:url" content="${home}" />\n    <script id="repairproof-seo-jsonld" type="application/ld+json">${safeJsonLd}</script>\n  </head>`);
await writeFile(indexPath, generatedIndex);

await writeFile(
  resolve(outputDirectory, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${home}</loc></url></urlset>\n`,
);
await writeFile(
  resolve(outputDirectory, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`,
);
console.info(`[seo] Generated canonical, metadata, sitemap, and robots.txt for ${origin}`);

function getPublicOrigin(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.invalid') ||
      host.endsWith('.example') ||
      host === 'example.com' ||
      host === 'example.org' ||
      host.endsWith('.example.org') ||
      host.endsWith('.test')
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}
