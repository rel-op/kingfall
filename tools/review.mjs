// Play a scripted sequence frame by frame and lay the frames out as contact sheets for review.
// usage: node tools/review.mjs <name> <url-query> <frames> <every> '<json {frame: js}>' [outDir]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [name, query, n, every, at, outArg] = process.argv.slice(2);
const out = outArg || join(root, 'out', 'review');
const dir = join(out, name);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const steps = [{ wait: 900 }, { frames: { n: +n, dt: 1 / 60, dir, every: +every, jpg: true, at: JSON.parse(at || '{}') } }];
const stepFile = join(dir, 'steps.json');
writeFileSync(stepFile, JSON.stringify(steps));
execFileSync('node', [join(root, 'tools', 'drive.mjs'), join(root, 'index.html') + '?manual&' + query, stepFile], { stdio: 'inherit' });
const count = readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
const per = 30;
for (let s = 0, k = 0; s < count; s += per, k++) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-start_number', String(s), '-i', join(dir, 'f%05d.jpg'), '-frames:v', '1', '-vf', 'scale=426:-1,tile=6x5', join(out, `${name}_${k}.jpg`)]);
}
console.log('sheets:', Math.ceil(count / per), 'in', out);
