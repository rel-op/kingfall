// Trim, level and pack the sound effects into assets/sfx.js so the game needs no server to load them.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'art', 'audio', 'sfx'), tmp = join(root, 'out', 'sfx');
mkdirSync(tmp, { recursive: true });
const out = {};
for (const f of readdirSync(src).filter((x) => x.endsWith('.mp3')).sort()) {
  const dst = join(tmp, f);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(src, f),
    '-af', 'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.01,loudnorm=I=-15:TP=-1.5:LRA=11,afade=t=in:d=0.004',
    '-ac', '1', '-ar', '44100', '-b:a', '96k', dst]);
  out[f.replace('.mp3', '')] = readFileSync(dst).toString('base64');
}
writeFileSync(join(root, 'assets', 'sfx.js'), 'window.BC_SFX = ' + JSON.stringify(out) + ';\n');
console.log(Object.keys(out).length, 'sounds packed');
