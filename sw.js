// Written by tools/make-sw.mjs. Do not edit by hand.
// Offline support: keeps a copy of the game on the device and refreshes it in the background.
const CACHE = 'kingfall-8e2f7e72be';
const FILES = ["assets/atlas.js","assets/bg/ember_battle.png","assets/bg/ember_board.png","assets/bg/frost_battle.png","assets/bg/frost_board.png","assets/bg/sakura_battle.png","assets/bg/sakura_board.png","assets/fx.js","assets/fx.png","assets/icons/apple-touch-icon.png","assets/icons/icon-192.png","assets/icons/icon-512.png","assets/icons/icon-maskable-512.png","assets/logo.png","assets/music/ember.mp3","assets/music/frost.mp3","assets/music/sakura.mp3","assets/music/title.mp3","assets/portraits/moon_bishop.png","assets/portraits/moon_king.png","assets/portraits/moon_knight.png","assets/portraits/moon_pawn.png","assets/portraits/moon_queen.png","assets/portraits/moon_rook.png","assets/portraits/sun_bishop.png","assets/portraits/sun_king.png","assets/portraits/sun_knight.png","assets/portraits/sun_pawn.png","assets/portraits/sun_queen.png","assets/portraits/sun_rook.png","assets/sfx.js","assets/sprites/moon_bishop.png","assets/sprites/moon_king.png","assets/sprites/moon_knight.png","assets/sprites/moon_pawn.png","assets/sprites/moon_queen.png","assets/sprites/moon_rook.png","assets/sprites/sun_bishop.png","assets/sprites/sun_king.png","assets/sprites/sun_knight.png","assets/sprites/sun_pawn.png","assets/sprites/sun_queen.png","assets/sprites/sun_rook.png","index.html","js/ai.js","js/app.js","js/chess.js","js/engine.js","js/fight.js","js/fx.js","js/game.js","js/gfx.js","js/main.js","js/sys.js","js/ui.js","js/view.js","manifest.webmanifest"];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((all) => Promise.all(all.filter((k) => k.startsWith('kingfall-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Music is asked for in slices; a browser may refuse a whole file where it asked for a part of one.
async function slice(req, res) {
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') || '');
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
