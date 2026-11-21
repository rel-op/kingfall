// Drive the game in headless Chrome: run steps, take screenshots, print console errors.
// usage: node tools/drive.mjs <url-or-file> '<json steps>'
// A target starting "serve:" is served over http from this folder for the run (needed for the installable-app parts).
// env: STRICT=1 drops Chrome's file-access flag; MOBILE=844x390 emulates a phone with a touch screen.
// steps: {"tap":[x,y]} in game coordinates (960x540)  {"server":false} stops the server  {"reload":true}
// steps: {"wait":ms} {"eval":"js"} {"evalFile":"path.js"} {"shot":"out.png"} {"size":[w,h]} {"frames":{n,dt,dir,every,at:{frame:js}}}
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const target = process.argv[2];
const arg = process.argv[3] || '[]';
const steps = JSON.parse(existsSync(arg) ? readFileSync(arg, 'utf8') : arg);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.css': 'text/css' };
let server = null;
if (target.startsWith('serve:')) {
  const root = process.cwd();
  server = createServer((req, res) => {
    const path = join(root, normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\]|\.\.)+/, '')), file = path.endsWith('/') || path === root ? join(path, 'index.html') : path;
    try { const body = readFileSync(file); res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(body); }
    catch (e) { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
}
const mobile = process.env.MOBILE ? process.env.MOBILE.split('x').map(Number) : null;
const url = server ? `http://127.0.0.1:${server.address().port}/${target.slice(6)}` : /^(https?|file):/.test(target) ? target : pathToFileURL(resolve(target.split('?')[0])).href + (target.includes('?') ? '?' + target.split('?')[1] : '');
const port = 9300 + Math.floor(Math.random() * 500);
const dir = mkdtempSync(join(tmpdir(), 'kf-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--window-size=1280,720',
  '--hide-scrollbars', '--mute-audio', ...(process.env.STRICT ? [] : ['--allow-file-access-from-files']), '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageWs() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const pg = list.find((x) => x.type === 'page');
      if (pg) return pg.webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    await sleep(100);
  }
  throw new Error('chrome did not start');
}

let failed = false;
try {
  const ws = new WebSocket(await pageWs());
  await new Promise((r) => { ws.onopen = r; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.consoleAPICalled') console.log('[console.' + m.params.type + ']', m.params.args.map((a) => a.value ?? a.description).join(' '));
    else if (m.method === 'Runtime.exceptionThrown') { failed = true; console.log('[exception]', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); }
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  if (mobile) { await send('Emulation.setDeviceMetricsOverride', { width: mobile[0], height: mobile[1], deviceScaleFactor: 2, mobile: true }); await send('Emulation.setTouchEmulationEnabled', { enabled: true }); }
  else await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(700);
  for (const s of steps) {
    if (s.wait) await sleep(s.wait);
    if (s.size) await send('Emulation.setDeviceMetricsOverride', { width: s.size[0], height: s.size[1], deviceScaleFactor: 1, mobile: false });
    if (s.server === false && server) { await new Promise((r) => { server.closeAllConnections(); server.close(r); }); server = null; }
    if (s.reload) { await send('Page.reload'); await sleep(1500); }
    if (s.tap) {
      // game coordinates to page coordinates, then a finger tap or a mouse click
      const r = await send('Runtime.evaluate', { expression: '(() => { const r = BC.canvas.getBoundingClientRect(); return [r.left, r.top, r.width]; })()', returnByValue: true });
      const at = typeof s.tap === 'string' ? (await send('Runtime.evaluate', { expression: s.tap, returnByValue: true })).result.result.value : s.tap;
      const [left, top, width] = r.result.result.value, x = left + at[0] * width / 960, y = top + at[1] * width / 960;
      if (mobile) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
      else { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); }
      await sleep(s.after || 350);
    }
    if (s.evalFile) s.eval = readFileSync(s.evalFile, 'utf8');
    if (s.eval) {
      const r = await send('Runtime.evaluate', { expression: s.eval, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) { failed = true; console.log('[eval error]', r.result.exceptionDetails.exception?.description); }
      else if (r.result?.result?.value !== undefined) console.log('[eval]', typeof r.result.result.value === 'string' ? r.result.result.value : JSON.stringify(r.result.result.value));
    }
    if (s.frames) {
      // Fixed-step capture: advance the game by dt per frame and save every Nth frame.
      const f = s.frames; mkdirSync(f.dir, { recursive: true });
      let stopAt = f.n;
      for (let i = 0; i < f.n && i < stopAt; i++) {
        if (f.until && stopAt === f.n && i >= (f.min || 0) && i % 4 === 0) {
          const u = await send('Runtime.evaluate', { expression: f.until, returnByValue: true });
          if (u.result?.result?.value) stopAt = i + (f.tail || 0);
        }
        if (f.at && f.at[i]) await send('Runtime.evaluate', { expression: f.at[i], awaitPromise: true });
        await send('Runtime.evaluate', { expression: `BC.tick(${f.dt || 1 / 60})`, awaitPromise: true });
        if (i % (f.every || 1) === 0) {
          const r = await send('Page.captureScreenshot', { format: f.jpg ? 'jpeg' : 'png', quality: 92 });
          writeFileSync(join(f.dir, (f.prefix || 'f') + String((f.start || 0) + Math.floor(i / (f.every || 1))).padStart(5, '0') + (f.jpg ? '.jpg' : '.png')), Buffer.from(r.result.data, 'base64'));
        }
      }
      console.log('[frames]', f.n, f.dir);
    }
    if (s.dump) {
      const r = await send('Runtime.evaluate', { expression: s.dump.expr, awaitPromise: true, returnByValue: true });
      writeFileSync(s.dump.file, typeof r.result?.result?.value === 'string' ? r.result.result.value : JSON.stringify(r.result?.result?.value));
    }
    if (s.shot) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(s.shot, Buffer.from(r.result.data, 'base64'));
      console.log('[shot]', s.shot);
    }
  }
  ws.close();
} finally {
  if (server) server.close();
  chrome.kill();
}
process.exit(failed ? 1 : 0);
