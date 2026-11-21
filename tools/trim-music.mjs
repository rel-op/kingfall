// Cuts the silence off the end of each music track, so one track hands over to the next without a long gap,
// and writes the track's length into the file, which the game needs to fade the last second.
// No re-encoding: the file is cut on a frame boundary and the sound is untouched. Safe to run again.
// usage: node tools/trim-music.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'music');
const KEEP = 0.6;   // seconds of quiet left after the last note
for (const f of readdirSync(dir).filter((x) => x.endsWith('.mp3') && !x.startsWith('_')).sort()) {
  const file = join(dir, f);
  const len = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  // ffmpeg reports each stretch of silence on stderr; one still open at the end of the file is the tail
  const log = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=noise=-45dB:d=0.3', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)], ends = [...log.matchAll(/silence_end: ([\d.]+)/g)];
  const quiet = starts.length > ends.length ? +starts[starts.length - 1][1] : ends.length && len - +ends[ends.length - 1][1] < 0.2 ? +starts[starts.length - 1][1] : null;
  const cut = quiet !== null && len - quiet >= KEEP + 0.5 ? quiet + KEEP : null;
  // the length lives in a small header at the front; a file straight from the generator has none
  const head = readFileSync(file).subarray(0, 4096).toString('latin1'), stamped = head.includes('Xing') || head.includes('Info');
  if (cut === null && stamped) { console.log(`${f}: ${len.toFixed(1)}s, nothing to do`); continue; }
  const tmp = join(dir, '_' + f);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', file, ...(cut === null ? [] : ['-t', String(cut)]), '-c', 'copy', tmp]);
  renameSync(tmp, file);
  console.log(cut === null ? `${f}: ${len.toFixed(1)}s, length written` : `${f}: ${len.toFixed(1)}s -> ${cut.toFixed(1)}s`);
}
