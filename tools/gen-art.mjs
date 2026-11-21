// Generate the source art, one image at a time, skipping any that already exist.
// usage: IMAGE_CMD=/path/to/codex-image.sh node tools/gen-art.mjs [name-filter]
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = join(root, 'art', 'raw');
const J = JSON.parse(readFileSync(join(root, 'tools', 'art-jobs.json'), 'utf8'));
const cmd = process.env.IMAGE_CMD;
if (!cmd) { console.error('set IMAGE_CMD to the image generation script'); process.exit(2); }
const filter = process.argv[2];
const log = (s) => { console.log(s); appendFileSync(join(raw, '_log.txt'), s + '\n'); };

for (const job of J.jobs) {
  if (filter && !job.out.includes(filter)) continue;
  const out = join(raw, job.out + '.png');
  if (existsSync(out)) continue;
  let prompt;
  if (job.kind === 'single') prompt = `${job.text} ${J.single} ${J.style} ${J.key}`;
  else if (job.kind === 'sheet') prompt = `${J.sheetHead} ${job.text.replace('@idlehit', J.idlehit)} ${J.sheetTail}`;
  else if (job.kind === 'raw') prompt = `${job.text} ${J.style} ${J.key}`;
  else prompt = `${J[job.kind]} ${job.text}`;
  const args = ['--out', out];
  if (job.ref) {
    const ref = join(raw, job.ref + '.png');
    if (!existsSync(ref)) { log(`skip ${job.out}: reference ${job.ref} missing`); continue; }
    args.push('--image', ref);
  }
  args.push(prompt);
  const t0 = Date.now();
  let ok = false;
  for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
    const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 480000 });
    ok = r.status === 0 && existsSync(out);
    if (!ok) {
      log(`FAIL ${job.out} (try ${attempt}): ${(r.stderr || '').trim().split('\n').slice(0, 3).join(' | ')}`);
      if (/QUOTA|RATE-LIMIT/.test(r.stderr || '')) { log('stopping: quota'); process.exit(3); }
    }
  }
  if (ok) log(`ok ${job.out} ${Math.round((Date.now() - t0) / 1000)}s`);
}
log('done');
