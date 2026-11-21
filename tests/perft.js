// Move-generation check: counts positions to a fixed depth and compares with known totals.
const C = require('../js/chess.js');
const cases = [
  ['start', C.START_FEN, 4, 197281],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
  ['endgame', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 5, 674624],
  ['promos', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 3, 9467],
  ['pos5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
];
let bad = 0;
for (const [name, fen, depth, want] of cases) {
  const got = C.perft(C.fromFEN(fen), depth);
  console.log(`${got === want ? 'ok  ' : 'FAIL'} ${name} depth ${depth}: ${got} (want ${want})`);
  if (got !== want) bad++;
}
// Fool's mate, move notation and end-of-game detection.
const S = C.newGame();
for (const want of ['f3', 'e5', 'g4', 'Qh4#']) {
  const legal = C.legalMoves(S);
  const m = legal.find((x) => C.san(S, x, legal) === want);
  if (!m) { console.log('FAIL san ' + want); bad++; break; }
  C.play(S, m);
}
const st = C.status(S);
console.log(`${st === 'checkmate' ? 'ok  ' : 'FAIL'} fool's mate -> ${st}`);
if (st !== 'checkmate') bad++;
const K = C.fromFEN('8/8/8/4k3/8/8/8/4K2B w - - 0 1');
console.log(`${C.status(K) === 'material' ? 'ok  ' : 'FAIL'} K+B v K is a draw`);
if (C.status(K) !== 'material') bad++;
process.exit(bad ? 1 : 0);
