// Generate sound effects and music with ElevenLabs. Skips files that already exist.
// usage: ELEVENLABS_API_KEY=... node tools/gen-audio.mjs [name-filter]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('set ELEVENLABS_API_KEY'); process.exit(2); }
const filter = process.argv[2];
const sfxDir = join(root, 'art', 'audio', 'sfx'), musDir = join(root, 'assets', 'music');
mkdirSync(sfxDir, { recursive: true }); mkdirSync(musDir, { recursive: true });

// [name, seconds, prompt]
const SFX = [
  ['ui_move', 0.5, 'Single soft wooden koto pluck, short crisp UI tick, dry, no reverb'],
  ['ui_ok', 0.7, 'Bright koto pluck followed by a small brass chime, positive game menu confirm sound, short'],
  ['ui_back', 0.6, 'Soft low wooden block knock, game menu cancel sound, short and dry'],
  ['select', 0.9, 'Magical shimmer rising quickly with a small bell, a stone chess piece awakening, short bright game sound'],
  ['morph_up', 1.2, 'Stone cracking open then a fast rising magical whoosh and sparkle, a statue transforming into a living warrior, punchy'],
  ['morph_down', 0.9, 'Quick reverse magical whoosh ending in a heavy stone thunk, a creature turning back into a stone statue'],
  ['step', 0.5, 'One quick armoured footstep on stone, light metal clink, dry'],
  ['dash', 0.7, 'Fast whoosh of a character dashing forward with cloth flutter, short'],
  ['land', 0.6, 'Heavy marble chess piece set down firmly on a stone board, deep satisfying thunk with tiny click'],
  ['slash', 0.7, 'Sharp katana sword slash whoosh with metallic ring, fast, anime fighting game style'],
  ['slash_big', 1.2, 'Huge two-handed greatsword slash, deep whoosh then a bright shing of steel, dramatic anime finishing blow'],
  ['thrust', 0.6, 'Quick spear thrust whoosh, tight and fast, fighting game style'],
  ['hit', 0.5, 'Punchy fighting game impact hit, hard thud with a snap, arcade style, dry'],
  ['hit_heavy', 0.9, 'Massive heavy fighting game impact, deep bass thump with crunching stone, powerful'],
  ['smash', 1.5, 'Giant stone golem smashing both fists into the ground, earth-shaking boom with rubble and rumble'],
  ['stomp', 0.7, 'Single heavy stone golem footstep, deep ground thud with small debris'],
  ['gallop', 1.2, 'Warhorse galloping fast on stone for a moment, armour jingling, charging past'],
  ['neigh', 1.2, 'Warhorse rearing with a fierce whinny, close, dramatic'],
  ['holy', 1.6, 'Holy light beam striking from the sky, bright choir burst with shimmering bells and a deep whoosh, fantasy spell impact'],
  ['charge', 1.2, 'Magical energy charging up, rising hum with shimmering sparkles, anticipation before a spell'],
  ['flurry', 1.0, 'Rapid flurry of five quick rapier slashes, whip-fast whooshes and light metallic rings'],
  ['burst', 1.3, 'Magical explosion of sparkling energy, bright burst with glittering tail, fantasy finishing move'],
  ['shatter', 1.6, 'Marble statue shattering into many pieces, sharp crack then stone chunks and gravel scattering on a stone floor'],
  ['ko', 2.2, 'Single huge Japanese taiko drum hit together with a deep gong, long resonant decay, dramatic knockout sting'],
  ['taiko', 0.9, 'Two fast powerful Japanese taiko drum hits, dry and punchy, fight starting cue'],
  ['zoom', 0.7, 'Fast cinematic whoosh swoosh, camera zooming in, low to high'],
  ['check', 1.2, 'Tense alarm sting, sharp brass stab with a struck bell, warning that the king is in danger'],
  ['promote', 1.6, 'Triumphant ascending magical chime arpeggio with sparkle and a soft choir, a pawn being crowned'],
  ['castle', 1.0, 'Heavy stone blocks sliding and locking into place with a deep clunk'],
  ['win', 4.5, 'Short triumphant victory fanfare, medieval brass and Japanese taiko drums with a koto flourish, heroic ending sting'],
  ['draw', 3.0, 'Short calm resolving musical phrase on koto and shakuhachi flute, peaceful, match ended in a draw'],
  ['tick', 0.5, 'Single dry wooden clock tick, tense, short'],
];
// [name, ms, prompt]
const MUSIC = [
  ['title', 70000, 'Epic medieval fantasy main theme with Japanese influence: taiko drums, shamisen and koto riffs over heroic orchestral strings and brass, shakuhachi flute melody, driving and adventurous, like the title screen of a classic 2D fighting game. Instrumental, loopable.'],
  ['sakura', 80000, 'Bright, fast-paced battle music for a spring castle courtyard under cherry blossoms: playful koto and shamisen lead, taiko percussion, light orchestral strings, hopeful and energetic, medieval fantasy with Japanese instruments. Instrumental, loopable.'],
  ['ember', 80000, 'Intense, driving battle music inside a volcanic forge fortress: thunderous taiko drums and anvil hits, aggressive low strings and brass, fierce shamisen riffs, dark and fiery, fast tempo. Instrumental, loopable.'],
  ['frost', 80000, 'Mysterious, tense battle music for a moonlit frozen abbey: glassy bells and celesta, shakuhachi flute, choir pads, steady taiko pulse and plucked koto, cold and beautiful but urgent, medium-fast tempo. Instrumental, loopable.'],
  ['storm', 80000, 'Stormy, heroic battle music for a sea fortress battered by a gale: surging orchestral strings rising and falling like waves, bold horns, rolling taiko thunder and crashing cymbals, a defiant shamisen and shakuhachi melody, swashbuckling and windswept, fast tempo, medieval fantasy with Japanese instruments. Instrumental, loopable.'],
  // a second theme for each arena; a game plays the two in turn
  ['sakura2', 80000, 'A second, contrasting theme for a spring castle courtyard under cherry blossoms: graceful and flowing rather than playful, a singing shakuhachi flute melody over rippling koto arpeggios, warm strings, light hand drums and gentle taiko, noble and thoughtful, medium tempo, medieval fantasy with Japanese instruments. Instrumental, loopable.'],
  ['ember2', 80000, 'A second, contrasting theme for a volcanic forge fortress: a slow-burning, menacing war march, low brass swells and deep humming choir pads, heavy taiko on a steady stomping beat with clanging chains and anvils, a snarling shamisen figure building in waves, ominous rather than frantic, medium tempo. Instrumental, loopable.'],
  ['frost2', 80000, 'A second, contrasting theme for a moonlit frozen abbey: swift and driving, racing plucked koto and pizzicato strings over an urgent taiko and frame drum rhythm, a soaring shakuhachi melody, icy bells and choir pads above, like a chase across the ice, fast tempo. Instrumental, loopable.'],
  ['storm2', 80000, 'A second, contrasting theme for a storm-lashed sea fortress: tense and brooding, a rocking six-eight pulse on low strings and koto like a ship at anchor, a distant tolling harbour bell, a mournful shakuhachi and solo cello melody, taiko rumbling like far thunder and swelling to brief heroic surges, medium tempo, medieval fantasy with Japanese instruments. Instrumental, loopable.'],
];

async function call(url, body, out) {
  const r = await fetch(url, { method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { console.log(`FAIL ${out}: ${r.status} ${(await r.text()).slice(0, 300)}`); return false; }
  writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log('ok', out);
  return true;
}

for (const [name, secs, text] of SFX) {
  if (filter && !name.includes(filter)) continue;
  const out = join(sfxDir, name + '.mp3');
  if (existsSync(out)) continue;
  await call('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', { text, duration_seconds: secs, prompt_influence: 0.45 }, out);
}
for (const [name, ms, prompt] of MUSIC) {
  if (filter && !name.includes(filter)) continue;
  const out = join(musDir, name + '.mp3');
  if (existsSync(out)) continue;
  await call('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', { prompt, music_length_ms: ms, model_id: 'music_v1', force_instrumental: true }, out);
}
console.log('done');
