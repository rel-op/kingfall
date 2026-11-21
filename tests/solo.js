// Run inside the page by tools/drive.mjs: plays a whole one-player game, the "player" following the
// coach's advice most of the time and blundering now and then, and reports what the coach and review saw.
// Along the way it takes a move back, asks for a tip, saves and reloads, and replays a mistake from the review.
(async () => {
  BC.manual = true; BC.trailer = true;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = { worker: null, human: 0, cpu: 0, cautions: 0, tipsShown: 0, undo: null, noAdvice: 0, reload: null, retry: null };
  let g = BC.scene, waited = 0;
  for (let i = 0; i < 200000 && g.mode !== 'over'; i++) {
    BC.tick(1 / 20); await 0;
    g = BC.scene;
    if (BC.ui.stack.length) {
      // the coach is questioning a move: note it, then play on regardless
      log.cautions++;
      const m = BC.ui.stack[0];
      if (!g.warn && !/CHECKMATE|BETTER/.test(m.note)) return 'caution without a marked reply: ' + m.note;
      m.items[2].act();
      continue;
    }
    if (g.mode === 'promo') { g.promoPick(); continue; }
    if (g.mode === 'think') { await sleep(4); continue; }
    if (g.mode !== 'play') continue;
    // wait a little for the coach, as a person would take a moment anyway
    if (!g.advice && waited < 400) { waited++; await sleep(4); continue; }
    if (!g.advice) log.noAdvice++;
    waited = 0;
    if (log.human === 3 && log.undo === null) {
      const before = g.line.length;
      g.undo(); log.undo = before - g.line.length; log.human++;
      continue;
    }
    if (log.human === 5) { g.askTip(); g.askTip(); BC.tick(1 / 20); if (g.tip === 2 && g.best()) log.tipsShown++; }
    if (log.human === 8 && log.reload === null) {
      const g2 = new BC.Game({ save: JSON.parse(JSON.stringify(g.snapshot())) });
      log.reload = g2.line.join() === g.line.join() && g2.ai.level === g.ai.level && g2.rev.length === g.rev.length && g2.mode === 'play';
    }
    const L = g.legal, best = g.best();
    const m = best && Math.random() < 0.8 ? best : L[(Math.random() * L.length) | 0];
    g.sel = m.from; g.targets = L.filter((x) => x.from === m.from);
    g.commit(m); log.human++;
  }
  log.worker = !BC.ai.slow;
  log.cpu = g.line.length - g.rev.length;
  const R = BC.ai.review(g.rev);
  BC.ui.clear(); BC.ui.review(g);
  for (let i = 0; i < 12; i++) BC.tick(1 / 60);
  const out = { result: g.result, plies: g.line.length, reviewed: g.rev.length, accuracy: R.acc, count: R.count, worst: R.worst.map((w) => w.did + ' / ' + w.better), log };
  if (new URLSearchParams(location.search).has('retry')) {
    const it = BC.ui.stack[0].items.find((x) => x.act && x.label !== 'BACK' && !(x.off && x.off()));
    if (it) { it.act(); BC.tick(1 / 60); const n = BC.scene; log.retry = n !== g && n.mode === 'play' && n.human() && n.tip === 1 && n.line.length < g.line.length; }
  }
  return JSON.stringify(out);
})()
