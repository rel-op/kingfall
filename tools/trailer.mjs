// Record the trailer: play scripted scenes frame by frame at 1080p60, then cut them
// together with the music and every sound effect placed where the game played it.
// usage: node tools/trailer.mjs [shot-name ...]   (no names = all shots, then assemble)
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'out', 'trailer');
const act = (n) => `BC.scene.act(BC.chess.sqFromName("${n}"))`;
const cap = (a, b, l) => `BC.caption(${JSON.stringify(a)}, ${JSON.stringify(b || '')}, ${l || 3.2})`;
const fen = (f) => 'fen=' + encodeURIComponent(f);
const done = 'BC.scene.mode !== "anim"';

const SHOTS = [
  { name: '01-title', query: '', n: 215, at: { 0: 'BC.fadeTo(1)' } },
  { name: '02-alive', query: 'game&env=0', n: 330,
    at: { 12: cap('EVERY PIECE COMES ALIVE', 'STONE CHESSMEN TRANSFORM INTO WARRIORS', 4.6), 22: act('e2'), 92: act('e4'), 168: act('g8'), 238: act('f6') } },
  { name: '03-pawn', query: 'game&env=0&' + fen('r1bqkbnr/pppp1ppp/8/4p3/3nP3/2P2N2/PP3PPP/RNBQKB1R w KQkq - 0 5'), n: 620, until: done, min: 120, tail: 26,
    at: { 6: cap('FIGHTING-GAME TAKEDOWNS', 'EVERY CAPTURE IS A DUEL', 3.4), 14: act('c3'), 52: act('d4') } },
  { name: '04-rook', query: 'game&env=1&' + fen('r3k2r/ppp2ppp/2n5/3b4/8/2N5/PPP2PPP/3RK2R w Kkq - 0 12'), n: 700, until: done, min: 120, tail: 26,
    at: { 6: cap('EMBER FORGE', 'THREE ARENAS TO FIGHT IN', 3.2), 14: act('d1'), 52: act('d5') } },
  { name: '05-queen', query: 'game&env=1&' + fen('r1b1kb1r/pppp1ppp/2n5/4q3/8/2N5/PPPPQPPP/R1B1KB1R w KQkq - 0 8'), n: 700, until: done, min: 120, tail: 26,
    at: { 6: cap('SIX SIGNATURE FINISHERS', '', 2.8), 14: act('e2'), 52: act('e5') } },
  { name: '06-bishop', query: 'game&env=2&' + fen('3qk2r/ppp2ppp/2n2n2/3r4/8/1B6/PPP2PPP/RN1QK2R w KQk - 0 10'), n: 700, until: done, min: 120, tail: 26,
    at: { 6: cap('FROSTMOON ABBEY', '', 2.8), 14: act('b3'), 52: act('d5') } },
  { name: '07-king', query: 'game&env=2&' + fen('6k1/5ppp/8/8/8/2n1P3/3K1PP1/8 w - - 0 40'), n: 700, until: done, min: 120, tail: 26,
    at: { 6: cap('TWO PLAYERS, ONE SCREEN', 'MOUSE OR GAMEPAD - MOVE HINTS - SAVE GAMES', 3.6), 14: act('d2'), 52: act('c3') } },
  { name: '08-mate', query: 'game&env=0&' + fen('6rk/6pp/8/6N1/8/8/5PPP/6K1 w - - 0 30'), n: 900, until: 'BC.scene.mode === "over"', min: 200, tail: 170,
    at: { 0: 'BC.trailer = true', 14: act('g5'), 52: act('f7') } },
  { name: '09-end', query: '', n: 200, at: { 0: 'BC.fadeTo(1)', 150: 'BC.fadeOut = 1.4' } },
];

function record(shot) {
  const dir = join(out, shot.name);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const steps = [{ size: [1920, 1080] }, { wait: 1200 },
    { frames: { n: shot.n, dt: 1 / 60, dir, jpg: true, at: shot.at, until: shot.until, min: shot.min, tail: shot.tail } },
    { dump: { expr: 'JSON.stringify(BC.audio.log)', file: join(dir, 'audio.json') } }];
  writeFileSync(join(dir, 'steps.json'), JSON.stringify(steps));
  return new Promise((res, rej) => {
    const p = spawn('node', [join(root, 'tools', 'drive.mjs'), join(root, 'index.html') + '?manual&' + shot.query, join(dir, 'steps.json')], { stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(shot.name + ' failed'))));
  });
}

const want = process.argv.slice(2);
const todo = SHOTS.filter((s) => !want.length || want.some((w) => s.name.includes(w)));
for (let i = 0; i < todo.length; i += 3) await Promise.all(todo.slice(i, i + 3).map(record));

// ---- assemble ----
const events = [], list = [];
let t = 0;
for (const s of SHOTS) {
  const dir = join(out, s.name);
  if (!existsSync(dir)) { console.log('missing shot', s.name, '- not assembling'); process.exit(0); }
  const n = readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
  const mp4 = join(out, s.name + '.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '60', '-i', join(dir, 'f%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', mp4]);
  for (const e of JSON.parse(readFileSync(join(dir, 'audio.json'), 'utf8'))) if (e.name && e.t <= n / 60) events.push({ t: t + e.t, name: e.name, vol: e.vol });
  list.push(`file '${mp4}'`);
  console.log(s.name, n, 'frames', (n / 60).toFixed(1) + 's');
  t += n / 60;
}
writeFileSync(join(out, 'list.txt'), list.join('\n'));
writeFileSync(join(out, 'events.json'), JSON.stringify({ duration: t, events }));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(out, 'list.txt'), '-c', 'copy', join(out, 'video.mp4')]);
execFileSync('uv', ['run', '--quiet', join(root, 'tools', 'mix_audio.py'), join(out, 'events.json'), join(out, 'mix.wav')], { stdio: 'inherit', env: { ...process.env, PYENV_VERSION: 'system' } });
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(out, 'video.mp4'), '-i', join(out, 'mix.wav'), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '224k', '-shortest', '-movflags', '+faststart', join(root, 'trailer.mp4')]);
console.log('trailer.mp4', t.toFixed(1) + 's');
