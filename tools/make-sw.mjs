// Writes sw.js: the list of files the installed app keeps for offline play, and a version made from their contents.
// Run after changing any game file: node tools/make-sw.mjs
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const walk = (dir) => readdirSync(join(root, dir)).flatMap((n) => (statSync(join(root, dir, n)).isDirectory() ? walk(dir + '/' + n) : [dir + '/' + n]));
const files = ['index.html', 'manifest.webmanifest', ...walk('js'), ...walk('assets')].filter((f) => !/\.DS_Store$|atlas\.json$/.test(f)).sort();
const hash = createHash('sha1');
for (const f of files) hash.update(f).update(readFileSync(join(root, f)));
const version = hash.digest('hex').slice(0, 10);

writeFileSync(join(root, 'sw.js'), `// Written by tools/make-sw.mjs. Do not edit by hand.
// Offline support: keeps a copy of the game on the device and refreshes it in the background.
const CACHE = 'kingfall-${version}';
const FILES = ${JSON.stringify(files)};

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((all) => Promise.all(all.filter((k) => k.startsWith('kingfall-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Music is asked for in slices; a browser may refuse a whole file where it asked for a part of one.
async function slice(req, res) {
  const m = /bytes=(\\d+)-(\\d*)/.exec(req.headers.get('range') || '');
  if (!m) return res;
  const buf = await res.arrayBuffer(), from = +m[1], to = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(from, to + 1), { status: 206, statusText: 'Partial Content', headers: {
    'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream', 'Content-Range': 'bytes ' + from + '-' + to + '/' + buf.byteLength, 'Content-Length': String(to - from + 1), 'Accept-Ranges': 'bytes' } });
}
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // one saved copy per file, whatever follows the "?"
  const key = url.origin + url.pathname + (url.pathname.endsWith('/') ? 'index.html' : '');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE), hit = await cache.match(key);
    // answer from the saved copy at once, and fetch a fresh one for next time
    const fresh = fetch(key, { cache: 'no-cache' }).then((r) => { if (r.status === 200) cache.put(key, r.clone()); return r; });
    if (hit) { e.waitUntil(fresh.catch(() => {})); return slice(req, hit); }
    return req.headers.has('range') ? fetch(req) : fresh;
  })());
});
`);
console.log(`sw.js: ${files.length} files, version ${version}`);
