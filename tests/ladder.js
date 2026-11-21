// Plays each opponent against the one above it and prints the score, to check the ladder climbs.
// usage: node tests/ladder.js [games per pair] [first level] [last level]
const ENGINE = require('../js/engine.js'), AI = require('../js/ai.js'), C = require('../js/chess.js');
const games = +process.argv[2] || 20, lo = +process.argv[3] || 1, hi = +process.argv[4] || AI.LEVELS.length;
const eng = AI.LEVELS.map(() => ENGINE()), judge = ENGINE();
let seed = 12345;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const uci = (m) => C.sqName(m.from) + C.sqName(m.to) + (m.promo || '');

// One game. Returns 1 if `a` wins, 0 if `b` wins, 0.5 for a draw. `a` plays White when aWhite.
function play(a, b, aWhite) {
  const S = C.newGame(), line = [];
  for (let ply = 0; ply < 300; ply++) {
    const st = C.status(S);
    if (st === 'checkmate') return (S.turn === 0) === aWhite ? 0 : 1;
    if (st !== 'playing') return 0.5;
    const lv = (S.turn === 0) === aWhite ? a : b, legal = C.legalMoves(S);
    let u;
    if (ply < 2) u = uci(legal[(rng() * legal.length) | 0]);   // a random first move each, for variety
    else {
      const q = AI.request(lv, line.length, rng);
      if (q.mode === 'best') { q.ms = 1e6; q.nodes = q.nodes || 1500000; }   // fixed work, not time, so results repeat
      eng[lv - 1].set(C.START_FEN, line);
      u = AI.choose(lv, q.mode === 'all' ? eng[lv - 1].all(q) : eng[lv - 1].best(q), rng).uci;
    }
    C.play(S, legal.find((m) => uci(m) === u)); line.push(u);
  }
  // too long: call it for whoever is clearly ahead
  judge.set(C.START_FEN, line);
  const r = judge.best({ depth: 6 }), white = S.turn === 0 ? r.cp : -r.cp;
  return Math.abs(white) < 300 ? 0.5 : (white > 0) === aWhite ? 1 : 0;
}
for (let lv = lo; lv < hi; lv++) {
  let pts = 0, w = 0, d = 0;
  const t0 = Date.now();
  for (let g = 0; g < games; g++) { const r = play(lv + 1, lv, g % 2 === 0); pts += r; if (r === 1) w++; else if (r === 0.5) d++; }
  console.log(`${String(lv + 1).padStart(2)} ${AI.LEVELS[lv].name.padEnd(12)} beats ${String(lv).padStart(2)} ${AI.LEVELS[lv - 1].name.padEnd(12)} ${(100 * pts / games).toFixed(0).padStart(3)}%  (${w} wins, ${d} draws, ${games - w - d} losses, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
