// One-player support: the ladder of opponents, the coach's analysis, and the maths for the game review.
// The engine itself is js/engine.js; this file decides how well each opponent is allowed to use it.
(function (root) {
  'use strict';

  // Each opponent looks `depth` moves ahead at every legal move, then picks one by score with some
  // randomness: `temp` is how many hundredths of a pawn worse a move must be to be picked about a third as
  // often as the best, and `wild` is the share of moves played with no thought at all. The top three just
  // play the engine's best move within a budget.
  // A depth of 2.5 means two moves ahead on half its turns and three on the rest.
  const LEVELS = [
    { name: 'STABLE HAND', tag: 'JUST LEARNED THE MOVES', depth: 1, temp: 300, wild: 0.4 },
    { name: 'PAGE', tag: 'LEAVES PIECES HANGING', depth: 1, temp: 200, wild: 0.2 },
    { name: 'SQUIRE', tag: 'TAKES WHAT YOU GIVE AWAY', depth: 1.3, temp: 140, wild: 0.08 },
    { name: 'ARCHER', tag: 'STILL MISSES A LOT', depth: 1.7, temp: 105, wild: 0.03 },
    { name: 'MAN-AT-ARMS', tag: 'LEARNING TO LOOK AHEAD', depth: 2, temp: 80 },
    { name: 'SERGEANT', tag: 'CASUAL PLAYER', depth: 2.5, temp: 60 },
    { name: 'KNIGHT', tag: 'STEADY CASUAL PLAYER', depth: 3, temp: 45 },
    { name: 'CAPTAIN', tag: 'SPOTS SIMPLE TRICKS', depth: 3.5, temp: 36 },
    { name: 'BANNERET', tag: 'SETS SIMPLE TRAPS', depth: 4, temp: 30 },
    { name: 'BARON', tag: 'CLUB PLAYER', depth: 4.5, temp: 24 },
    { name: 'EARL', tag: 'STRONG CLUB PLAYER', depth: 5, temp: 18 },
    { name: 'DUKE', tag: 'TOURNAMENT PLAYER', depth: 6, temp: 12 },
    { name: 'MARSHAL', tag: 'STRONG TOURNAMENT PLAYER', depth: 7, temp: 8 },
    { name: 'CHANCELLOR', tag: 'EXPERT', nodes: 120000, ms: 1500 },
    { name: 'REGENT', tag: 'RARELY SLIPS', nodes: 400000, ms: 1500 },
    { name: 'THE CROWN', tag: 'FULL STRENGTH', ms: 2500 },
  ];
  // The engine request for a level. The strongest two vary their first few moves so games do not repeat.
  function request(level, plies, rng) {
    const L = LEVELS[level - 1];
    if (L.depth) return { mode: 'all', depth: Math.floor(L.depth) + ((rng || Math.random)() < L.depth % 1 ? 1 : 0), ms: 4000, margin: Math.max(700, L.temp * 4) };
    if (plies < 8) return { mode: 'all', depth: 6, ms: 1200 };
    return { mode: 'best', ms: L.ms, nodes: L.nodes || 0 };
  }
  function choose(level, res, rng) {
    const L = LEVELS[level - 1], M = res.moves;
    if (!M) return res.best ? { uci: res.best, cp: res.cp, mate: res.mate } : null;
    if (!M.length) return null;
    rng = rng || Math.random;
    if (L.wild && rng() < L.wild) return M[(rng() * M.length) | 0];
    const temp = L.temp || 10, w = M.map((m) => Math.exp(-(M[0].cp - m.cp) / temp));
    let x = rng() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < M.length; i++) if ((x -= w[i]) <= 0) return M[i];
    return M[0];
  }

  // Lichess's published formulas: winning chances from a score, and accuracy from the chances a move gave up.
  const win = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, cp)))) - 1);
  const accuracy = (drop) => (drop <= 0 ? 100 : Math.max(0, Math.min(100, 103.1668100711649 * Math.exp(-0.04354415386753951 * drop) - 3.166924740191411 + 1)));
  // Lichess's bands, in winning-chance points lost: 5 inaccuracy, 10 mistake, 15 blunder.
  const grade = (drop) => (drop >= 15 ? 3 : drop >= 10 ? 2 : drop >= 5 ? 1 : 0);
  function review(rev) {
    const out = { n: rev.length, acc: 0, count: [0, 0, 0, 0], worst: [] };
    for (const r of rev) { const d = Math.max(0, r.wb - r.wp); out.acc += accuracy(d); out.count[grade(d)]++; }
    out.acc = rev.length ? Math.round(out.acc / rev.length) : 0;
    out.worst = rev.filter((r) => r.wb - r.wp >= 5).sort((a, b) => (b.wb - b.wp) - (a.wb - a.wp)).slice(0, 3).sort((a, b) => a.n - b.n);
    return out;
  }

  const api = { LEVELS, request, choose, win, accuracy, grade, review };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---- in the browser: the engine runs in a background worker so the animation never stalls ----
  const BC = root.BC;
  let worker = null, local = null, seq = 0;
  const waiting = new Map(), cache = new Map();
  function start() {
    if (worker || local) return;
    try {
      // built from the page's own copy of the engine, so it also works when the game is opened as a file
      worker = new Worker(URL.createObjectURL(new Blob([BC.engineSource], { type: 'text/javascript' })));
      worker.onmessage = (e) => { const f = waiting.get(e.data.id); waiting.delete(e.data.id); if (f) f(e.data); };
      worker.onerror = () => { worker = null; fallback(); for (const [id, f] of waiting) { waiting.delete(id); f({ error: 'worker failed' }); } };
    } catch (e) { fallback(); }
  }
  function fallback() { local = { bot: BC.Engine(), coach: BC.Engine() }; api.slow = true; }
  function ask(who, fen, line, q) {
    start();
    q = Object.assign({ id: ++seq, who, fen, line }, q);
    return new Promise((res) => {
      if (worker) { waiting.set(q.id, res); worker.postMessage(q); }
      // no worker: think on the page itself, briefly, between frames
      else setTimeout(() => { try { res(local[who].run(Object.assign(q, { ms: Math.min(q.ms || 300, 300) }))); } catch (e) { res({ error: String(e) }); } }, 30);
    });
  }
  api.think = (level, fen, line) => ask('bot', fen, line, request(level, line.length)).then((r) => (r.error ? null : choose(level, r)));
  // The coach's view of a position: every move scored. Asked for early and remembered, so it is ready when needed.
  api.study = function (fen, line) {
    const key = fen + '|' + line.join(' ');
    if (!cache.has(key)) {
      if (cache.size > 6) cache.delete(cache.keys().next().value);
      cache.set(key, ask('coach', fen, line, { mode: 'all', depth: 9, ms: 900, margin: 900 }).then((r) => (r.error || !r.moves.length ? null : r)));
    }
    return cache.get(key);
  };
  BC.ai = api;
})(typeof window !== 'undefined' ? window : globalThis);
