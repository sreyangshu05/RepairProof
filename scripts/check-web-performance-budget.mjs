import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webDist = resolve(repositoryRoot, 'apps/web/dist');
const manifest = JSON.parse(await readFile(resolve(webDist, '.vite/manifest.json'), 'utf8'));
const assets = Object.values(manifest);
const appEntry = assets.find((asset) => asset.src === 'index.html' && asset.isEntry);
const landingEntry = assets.find((asset) => asset.src?.endsWith('/landing-page.tsx'));
const dynamicEntries = assets.filter((asset) => asset.isDynamicEntry && asset.file?.endsWith('.js'));

if (!appEntry?.file || !landingEntry?.file) {
  throw new Error('Vite manifest is missing the application or public landing entry.');
}

async function gzipKiB(file) {
  const bytes = await readFile(resolve(webDist, file));
  return gzipSync(bytes, { level: 9 }).byteLength / 1024;
}

const measurements = [
  { name: 'Initial application JavaScript', file: appEntry.file, budgetKiB: 160 },
  { name: 'Public landing route JavaScript', file: landingEntry.file, budgetKiB: 20 },
  ...await Promise.all(dynamicEntries.map(async (asset) => ({
    name: `Async chunk ${asset.name ?? asset.file}`,
    file: asset.file,
    budgetKiB: 40,
  }))),
];

const cssFiles = [...new Set(appEntry.css ?? [])];
const results = [];
for (const measurement of measurements) {
  const actualKiB = await gzipKiB(measurement.file);
  results.push({ ...measurement, actualKiB });
}
for (const file of cssFiles) {
  results.push({ name: 'Initial CSS', file, budgetKiB: 12, actualKiB: await gzipKiB(file) });
}

for (const result of results) {
  const outcome = result.actualKiB <= result.budgetKiB ? 'PASS' : 'FAIL';
  process.stdout.write(`${outcome} ${result.name}: ${result.actualKiB.toFixed(1)} KiB / ${result.budgetKiB} KiB\n`);
}

const failures = results.filter((result) => result.actualKiB > result.budgetKiB);
if (failures.length) process.exitCode = 1;
