import { readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const outputDirectory = resolve(process.cwd(), 'dist');
const files = await collect(outputDirectory);
const precache = files
  .map((file) => `/${relative(outputDirectory, file).split(sep).join('/')}`)
  .filter((file) => file !== '/sw.js' && !file.endsWith('.map'));
if (!precache.includes('/offline.html')) throw new Error('Offline fallback is missing from the PWA build.');
const serviceWorker = await readFile(resolve(outputDirectory, 'offline.html'), 'utf8');
if (!serviceWorker.includes('Locally saved technician drafts'))
  throw new Error('Offline fallback is missing its synchronization warning.');

const source = `/* Generated from this build's public shell and static assets. */
const VERSION = ${JSON.stringify(`repairproof-${Date.now()}`)};
const SHELL_CACHE = VERSION + '-shell';
const ASSET_CACHE = VERSION + '-assets';
const PRECACHE = ${JSON.stringify([...new Set(precache)])};
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(PRECACHE);
    if (!self.registration.active) await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('repairproof-') && name !== SHELL_CACHE && name !== ASSET_CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try { return await fetch(request, { signal: controller.signal }); }
      catch {
        const shell = await caches.match('/index.html', { ignoreVary: true }) || await caches.match('/', { ignoreVary: true });
        return shell || (await caches.match('/offline.html')) || new Response('Offline', { status: 503 });
      } finally { clearTimeout(timeout); }
    })());
    return;
  }
  if (!PRECACHE.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    return fetch(request);
  })());
});
`;
await writeFile(resolve(outputDirectory, 'sw.js'), source);
console.info(`[pwa] Generated service worker with ${precache.length} public shell assets; API responses are network-only.`);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? collect(path) : [path];
  }));
  return nested.flat();
}
