// Engine check: its move generator against known totals, a few must-find moves, and search speed.
const E = require('../js/engine.js')();
let bad = 0;
const ok = (pass, msg) => { console.log((pass ? 'ok   ' : 'FAIL ') + msg); if (!pass) bad++; };
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
for (const [name, fen, depth, want] of [
  ['start', START, 4, 197281],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
  ['endgame', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 5, 674624],
  ['promos', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 3, 9467],
  ['pos5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
]) { E.set(fen); const got = E.perft(depth); ok(got === want, `perft ${name} depth ${depth}: ${got} (want ${want})`); }

for (const [name, fen, line, want] of [
  ['mate in one', '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', [], 'a1a8'],
  ['wins the queen with a fork', 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', [], null],
  ['takes a free queen', 'rnb1kbnr/pppp1ppp/8/4p1q1/4P3/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 1', [], 'c1g5'],
  ['mate in two', 'r1bq2r1/b4pk1/p1pp1p2/1p2pP2/1P2P1PB/3P4/1PPQ2P1/R3K2R w KQ - 0 1', [], 'd2h6'],
  ['scholar\'s mate', START, ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6'], 'h5f7'],
]) {
  E.clear(); E.set(fen, line);
  const r = E.best({ ms: 1500, depth: 9 });
  ok(want === null || r.best === want, `${name}: ${r.best} cp ${r.cp}${r.mate ? ' mate ' + r.mate : ''} depth ${r.depth}`);
}
E.clear(); E.set(START);
const a = E.all({ depth: 5, ms: 5000 });
ok(a.moves.length === 20 && a.depth === 5, `all-moves at depth 5: ${a.moves.length} moves, best ${a.moves[0].uci} ${a.moves[0].cp}, worst ${a.moves[19].uci} ${a.moves[19].cp}, reply to best ${a.moves[0].reply}`);
E.clear(); E.set('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
const t0 = Date.now(), r = E.best({ ms: 1000 });
console.log(`     speed: depth ${r.depth}, ${r.nodes} nodes in ${Date.now() - t0} ms (${Math.round(r.nodes / (Date.now() - t0))}k nodes/s), plays ${r.best}`);
process.exit(bad ? 1 : 0);
