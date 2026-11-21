// Menus, the in-game HUD, banners, and the title screen.
(function () {
  'use strict';
  const BC = window.BC, V = BC.view;
  const UI = BC.ui = { stack: [], t: 0 };
  const CLOCKS = [0, 1, 3, 5, 10];
  const GOLD = ['#fff6c0', '#ffb62e'];
  const COACH = ['OFF', 'TIPS ONLY', 'FULL'];

  function panel(ctx, x, y, w, h, col, a) {
    ctx.fillStyle = `rgba(12,7,24,${a === undefined ? 0.88 : a})`; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#05030a'; ctx.fillRect(x - 2, y - 2, w + 4, 2); ctx.fillRect(x - 2, y + h, w + 4, 2); ctx.fillRect(x - 2, y, 2, h); ctx.fillRect(x + w, y, 2, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
    ctx.fillStyle = '#ffd23e';
    for (const [cx, cy] of [[x - 1, y - 1], [x + w - 4, y - 1], [x - 1, y + h - 4], [x + w - 4, y + h - 4]]) ctx.fillRect(cx, cy, 5, 5);
  }
  UI.panel = panel;

  // ---------- generic menu ----------
  class Menu {
    constructor(o) { Object.assign(this, { title: '', items: [], w: 380, i: 0, age: 0 }, o); while (this.items[this.i] && this.items[this.i].off && this.items[this.i].off()) this.i++; }
    get head() { return this.title ? 58 : 16; }
    get h() { return this.head + 16 + this.items.length * 28 + (this.note ? 22 : 0); }
    box() { const h = this.h; return { x: this.x !== undefined ? this.x : 480 - this.w / 2, y: this.y !== undefined ? this.y : 270 - h / 2, w: this.w, h }; }
    move(d) {
      const n = this.items.length;
      for (let k = 0; k < n; k++) { this.i = (this.i + d + n) % n; const it = this.items[this.i]; if (!(it.off && it.off())) break; }
      BC.audio.sfx('ui_move', 0.5);
    }
    fire(it, d) {
      if (it.off && it.off()) return;
      if (d && it.adj) { it.adj(d); BC.audio.sfx('ui_move', 0.6); }
      else if (it.act) { BC.audio.sfx('ui_ok', 0.7); it.act(); }
      else if (it.adj) { it.adj(1); BC.audio.sfx('ui_move', 0.6); }
    }
    input(ev) {
      const b = this.box();
      if (ev.type === 'dir') { if (ev.dy) this.move(ev.dy); else if (ev.dx) this.fire(this.items[this.i], ev.dx); }
      else if (ev.type === 'move' || (ev.type === 'ok' && ev.mouse)) {
        const k = Math.floor((ev.y - (b.y + this.head)) / 28);
        if (ev.x < b.x || ev.x > b.x + b.w || k < 0 || k >= this.items.length) return;
        const it = this.items[k];
        if (it.off && it.off()) return;
        if (this.i !== k) { this.i = k; if (ev.type === 'move') BC.audio.sfx('ui_move', 0.35); }
        if (ev.type === 'ok') this.fire(it, it.adj && !it.act ? (ev.x < b.x + b.w * 0.6 ? -1 : 1) : 0);
      } else if (ev.type === 'ok') this.fire(this.items[this.i], 0);
      else if (ev.type === 'back' || ev.type === 'menu') { BC.audio.sfx('ui_back', 0.7); if (this.onBack) this.onBack(); else if (!this.sticky) UI.close(); }
    }
    draw(ctx, top) {
      this.age += 1 / 60;
      const b = this.box(), k = BC.ease.out(Math.min(1, this.age / 0.18)), cx = b.x + b.w / 2;
      if (this.shade !== false) { ctx.fillStyle = `rgba(6,3,14,${0.6 * k})`; ctx.fillRect(0, 0, 960, 540); }
      ctx.save(); ctx.translate(0, (1 - k) * 18); ctx.globalAlpha = k;
      panel(ctx, b.x, b.y, b.w, b.h, '#b3262e', this.cover ? 0.95 : undefined);
      if (this.title) {
        BC.text(ctx, this.title, cx, b.y + 16, { a: 'c', s: 3, g: GOLD, o: '#2a0d16' });
        ctx.fillStyle = '#ffd23e'; ctx.fillRect(b.x + 30, b.y + 46, b.w - 60, 1);
      }
      this.items.forEach((it, n) => {
        const y = b.y + this.head + n * 28, sel = n === this.i && top, off = it.off && it.off();
        if (sel) {
          const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
          g.addColorStop(0, 'rgba(242,67,47,0)'); g.addColorStop(0.5, 'rgba(242,67,47,0.75)'); g.addColorStop(1, 'rgba(242,67,47,0)');
          ctx.fillStyle = g; ctx.fillRect(b.x + 6, y - 3, b.w - 12, 22);
          BC.text(ctx, '>', b.x + 18 + Math.sin(UI.t * 8) * 2, y + 1, { s: 2, c: '#ffd23e' });
        }
        const col = off ? '#5a5068' : sel ? '#ffffff' : '#d8cbe6';
        const lab = typeof it.label === 'function' ? it.label() : it.label;
        if (it.value) { BC.text(ctx, lab, b.x + 36, y + 1, { s: 2, c: col, sh: '#05030a' }); BC.text(ctx, '< ' + it.value() + ' >', b.x + b.w - 22, y + 1, { s: 2, c: sel ? '#ffd23e' : '#bfa9d6', a: 'r', sh: '#05030a' }); }
        else BC.text(ctx, lab, it.small ? b.x + 36 : cx, y + 1, { s: 2, c: col, a: it.small ? 'l' : 'c', sh: '#05030a' });
      });
      const note = typeof this.note === 'function' ? this.note() : this.note;
      if (note) BC.text(ctx, note, cx, b.y + b.h - 22, { a: 'c', s: 1, c: '#9a8cb0' });
      ctx.restore();
    }
  }
  UI.Menu = Menu;
  UI.open = (m) => { UI.stack.push(m instanceof Menu ? m : new Menu(m)); };
  UI.close = () => { UI.stack.pop(); };
  UI.clear = () => { UI.stack.length = 0; };
  UI.input = (ev) => { UI.stack[UI.stack.length - 1].input(ev); };
  UI.draw = (ctx) => {
    let from = 0;
    UI.stack.forEach((m, i) => { if (m.cover) from = i; });
    UI.stack.forEach((m, i) => { if (i >= from) m.draw(ctx, i === UI.stack.length - 1); });
  };

  // ---------- menus ----------
  const onOff = (v) => (v ? 'ON' : 'OFF');
  UI.options = function () {
    const o = BC.opts, vol = (k) => ({ label: k === 'music' ? 'MUSIC' : 'SOUND', value: () => Math.round(o[k] * 10) + '', adj: (d) => { o[k] = BC.clamp(Math.round(o[k] * 10 + d) / 10, 0, 1); BC.audio.volumes(); BC.saveOpts(); } });
    UI.open({ title: 'OPTIONS', w: 430, items: [
      { label: 'MOVE HINTS', value: () => onOff(o.hints), adj: () => { o.hints = !o.hints; BC.saveOpts(); } },
      { label: 'FIGHT SCENES', value: () => o.fights.toUpperCase(), adj: (d) => { const L = ['full', 'quick', 'off']; o.fights = L[(L.indexOf(o.fights) + d + 3) % 3]; BC.saveOpts(); } },
      { label: 'BOARD VIEW', value: () => (o.orient === 'side' ? 'SIDE-ON' : 'CLASSIC'), adj: () => { o.orient = o.orient === 'side' ? 'classic' : 'side'; V.orient = o.orient; BC.saveOpts(); if (BC.scene.build && BC.scene.mode === 'play') { BC.scene.sel = -1; BC.scene.targets = []; BC.scene.build(); } } },
      vol('music'), vol('sfx'),
      { label: 'GLOW', value: () => onOff(o.bloom), adj: () => { o.bloom = !o.bloom; BC.saveOpts(); } },
      { label: 'FULL SCREEN', act: () => BC.fullscreen() },
      { label: 'BACK', act: UI.close },
    ] });
  };
  const slotText = (s) => (s ? `${BC.ENVS[s.env].name}  MOVE ${s.moves.length}${s.ai ? '  CPU ' + s.ai.level : ''}` : '- EMPTY -');
  UI.slots = function (mode, game) {
    const items = [];
    if (mode === 'load') items.push({ label: 'AUTOSAVE', value: () => slotText(BC.save.get('auto')), off: () => !BC.save.get('auto'), act: () => loadSlot('auto') });
    for (let n = 1; n <= 3; n++) {
      items.push({ label: 'SLOT ' + n, value: () => slotText(BC.save.get('slot' + n)), off: () => mode === 'load' && !BC.save.get('slot' + n),
        act: () => { if (mode === 'save') { BC.save.put('slot' + n, game.snapshot()); UI.close(); game.note('GAME SAVED TO SLOT ' + n); UI.clear(); } else loadSlot('slot' + n); } });
    }
    items.push({ label: 'BACK', act: UI.close });
    UI.open({ title: mode === 'save' ? 'SAVE GAME' : 'LOAD GAME', w: 600, items });
  };
  function loadSlot(k) { const s = BC.save.get(k); if (!s) return; UI.clear(); BC.go(new BC.Game({ save: s })); }
  UI.pause = function (game) {
    UI.open({ title: 'PAUSED', items: [
      { label: 'RESUME', act: UI.close },
      { label: 'MOVE HINTS', value: () => onOff(BC.opts.hints), adj: () => { BC.opts.hints = !BC.opts.hints; BC.saveOpts(); } },
      { label: 'SAVE GAME', act: () => UI.slots('save', game) },
      { label: 'LOAD GAME', act: () => UI.slots('load', game) },
      { label: 'TAKE BACK MOVE', off: () => !game.history.length || game.mode !== 'play', act: () => { game.undo(); UI.close(); } },
      ...(game.ai ? [{ label: 'COACH', value: () => COACH[game.ai.coach], adj: (d) => { game.ai.coach = (game.ai.coach + d + 3) % 3; game.danger = game.ai.coach === 2 && game.mode === 'play' ? game.hanging() : []; if (!game.ai.coach) game.tip = 0; } },
        { label: 'ASK FOR A TIP', off: () => !game.ai.coach || game.mode !== 'play', act: () => { UI.close(); game.askTip(); } }] : []),
      { label: 'OPTIONS', act: UI.options },
      { label: 'QUIT TO TITLE', act: () => { UI.clear(); BC.go(new Title()); } },
    ] });
  };
  UI.gameOver = function (game) {
    const r = game.result;
    const what = { checkmate: 'CHECKMATE', stalemate: 'STALEMATE', material: 'DRAW', fifty: 'DRAW', repetition: 'DRAW', time: 'TIME UP' }[r.type];
    const note = r.winner >= 0 ? (game.ai ? (r.winner === game.ai.side ? BC.ai.LEVELS[game.ai.level - 1].name + ' WINS' : 'YOU WIN') : BC.TEAMS[r.winner].full + ' WINS') : { stalemate: 'NO LEGAL MOVES', material: 'NOT ENOUGH PIECES TO MATE', fifty: 'FIFTY MOVES WITHOUT PROGRESS', repetition: 'SAME POSITION THREE TIMES' }[r.type];
    game.banner = { str: what, sub: note, team: r.winner >= 0 ? r.winner : 0, age: 0, life: 3.4 };
    game.wait(2.6).then(() => {
      if (BC.scene !== game || BC.trailer) return;
      const look = game.ai && game.rev.length;
      UI.open({ title: what, note, sticky: true, y: look ? 320 : 346, w: 330, shade: false, items: [
        ...(look ? [{ label: 'REVIEW YOUR GAME', act: () => UI.review(game) }] : []),
        { label: 'REMATCH', act: () => { UI.clear(); BC.go(new BC.Game({ env: game.envI, clock: game.clockBase, ai: game.ai })); } },
        { label: game.ai ? 'CHANGE OPPONENT' : 'CHANGE ARENA', act: () => { UI.clear(); const t = new Title(); BC.go(t); if (game.ai) t.solo(); else t.setup(); } },
        { label: 'TITLE SCREEN', act: () => { UI.clear(); BC.go(new Title()); } },
      ] });
    });
  };

  // After a one-player game: how accurately the player moved, and the moments worth trying again.
  UI.review = function (game) {
    const R = BC.ai.review(game.rev), c = R.count, line = (label) => ({ label, small: true, off: () => true });
    const items = [line(`ACCURACY ${R.acc}%   OVER ${R.n} MOVES   TIPS USED ${game.tips}`), line(`${c[0]} GOOD   ${c[1]} SLIPS   ${c[2]} MISTAKES   ${c[3]} BLUNDERS`)];
    items.push(line(R.worst.length ? 'WHERE IT TURNED. PICK ONE TO TRY IT AGAIN:' : 'NO REAL MISTAKES. WELL PLAYED.'));
    for (const w of R.worst) {
      const snap = game.history[w.n - game.h0];
      items.push({ label: `MOVE ${(w.n >> 1) + 1}: ${w.did}. BETTER: ${w.better}`, small: true, off: () => !snap, act: () => { UI.clear(); BC.go(new BC.Game({ save: JSON.parse(snap), tip: 1 })); } });
    }
    items.push({ label: 'BACK', act: UI.close });
    UI.open({ title: 'YOUR GAME', w: 700, items, i: items.length - 1 });
  };
  // The full coach questions a move that gives a lot away, and shows the reply it is worried about.
  UI.caution = function (game, m, p, b) {
    const S = game.S, r = p.reply, sq = BC.chess.sqFromName, from = r ? sq(r.slice(0, 2)) : -1, to = r ? sq(r.slice(2, 4)) : -1;
    const missed = b.mate > 0 && !(p.mate > 0);
    const hit = to < 0 ? null : to === m.to ? (m.promo || m.p) : S.board[to] && S.board[to].c === S.turn && to !== m.from ? S.board[to].t : null;
    const why = p.mate < 0 ? 'THAT WALKS INTO CHECKMATE' : missed ? 'YOU HAVE A CHECKMATE HERE. LOOK AGAIN' : hit ? 'THEY CAN TAKE YOUR ' + BC.PIECE_NAMES[hit] : 'THERE IS A MUCH BETTER MOVE HERE';
    if (from >= 0 && !missed) game.warn = { from, to };
    const done = (f) => () => { UI.close(); game.warn = null; f(); };
    BC.audio.sfx('ui_back', 0.8);
    UI.open({ title: BC.ai.win(b.cp) - BC.ai.win(p.cp) >= 15 ? 'BLUNDER?' : 'CAREFUL', note: why, w: 250, x: S.turn === 0 ? 4 : 706, y: 250, shade: false, sticky: true, cover: true, onBack: done(() => game.deselect()), items: [
      { label: 'TAKE IT BACK', act: done(() => game.deselect()) },
      { label: 'SHOW A BETTER ONE', act: done(() => { game.deselect(); game.tip = 2; game.tips++; }) },
      { label: 'PLAY IT ANYWAY', act: done(() => game.play(m)) },
    ] });
  };

  // ---------- HUD ----------
  const fmt = (s) => { s = Math.ceil(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  UI.hud = function (ctx, G) {
    const k = G.hudK, turn = G.S.turn, t = UI.t;
    if (k < 0.01) return;
    for (let team = 0; team < 2; team++) {
      const T = BC.TEAMS[team], x = (team === 0 ? 8 : 764) + (team === 0 ? -1 : 1) * (1 - k) * 220, y = 112, w = 188, h = 306;
      const active = turn === team && G.mode !== 'over';
      ctx.save(); ctx.globalAlpha = k;
      panel(ctx, x, y, w, h, active ? T.trim : T.dark, 0.84);
      const hg = ctx.createLinearGradient(x, 0, x + w, 0);
      hg.addColorStop(0, T.main); hg.addColorStop(1, T.dark);
      ctx.fillStyle = hg; ctx.fillRect(x + 2, y + 2, w - 4, 24);
      ctx.fillStyle = T.trim; ctx.beginPath(); ctx.arc(x + 16, y + 14, 7, 0, 7); ctx.fill();
      if (team === 1) { ctx.fillStyle = T.dark; ctx.beginPath(); ctx.arc(x + 19, y + 12, 6, 0, 7); ctx.fill(); }
      BC.text(ctx, T.full, x + 30, y + 7, { s: 2, c: '#fff', sh: T.ink });
      const cpu = G.ai && team === G.ai.side;
      // portrait: the piece in hand, or the king
      const px = x + 8, py = y + 32, pw = 172, ph = 122;
      const sel = active && G.sel >= 0 ? G.S.board[G.sel] : null, ty = sel ? sel.t : 'k';
      const pg = ctx.createLinearGradient(0, py, 0, py + ph);
      pg.addColorStop(0, T.dark); pg.addColorStop(1, '#0a0614');
      ctx.fillStyle = pg; ctx.fillRect(px, py, pw, ph);
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      ctx.globalAlpha = k * 0.22; ctx.fillStyle = T.trim;
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI + t * 0.15; ctx.beginPath(); ctx.moveTo(px + pw / 2, py + ph); ctx.lineTo(px + pw / 2 + Math.cos(a) * 260, py + ph - Math.sin(a) * 260); ctx.lineTo(px + pw / 2 + Math.cos(a + 0.17) * 260, py + ph - Math.sin(a + 0.17) * 260); ctx.fill(); }
      ctx.globalAlpha = k;
      const face = BC.assets.img['face_' + T.key + '_' + BC.PIECE[ty]];
      if (face) {
        const sc = 0.66, fw = face.width * sc, fh = face.height * sc;
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.translate(px + pw / 2, py + 4); if (team === 1) ctx.scale(-1, 1);
        ctx.drawImage(face, -fw / 2, 0, fw, fh);
      }
      ctx.restore();
      ctx.fillStyle = T.trim; ctx.fillRect(px, py + ph, pw, 1);
      if (G.ai) BC.text(ctx, cpu ? 'CPU LEVEL ' + G.ai.level : 'YOU', team === 0 ? px + 5 : px + pw - 5, py + 5, { s: 1, c: '#fff', a: team === 0 ? 'l' : 'r', o: '#05030a' });
      BC.text(ctx, cpu && !sel ? BC.ai.LEVELS[G.ai.level - 1].name : BC.PIECE_NAMES[ty], x + w / 2, y + 160, { a: 'c', s: 2, c: T.glow, sh: '#05030a' });
      if (G.clock) {
        const low = G.clock[team] < 10 && active;
        BC.text(ctx, fmt(G.clock[team]), x + w / 2, y + 182, { a: 'c', s: 4, c: low && Math.sin(t * 14) > 0 ? '#ff3048' : active ? '#ffffff' : '#8a7c9c', o: '#05030a' });
      } else BC.text(ctx, 'MOVE ' + G.S.full, x + w / 2, y + 188, { a: 'c', s: 3, c: active ? '#fff' : '#8a7c9c', o: '#05030a' });
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 10, y + 218, w - 20, 1);
      const caps = G.captured[team].slice().sort((a, b) => BC.chess.VALUE[b] - BC.chess.VALUE[a] || (a < b ? -1 : 1));
      const sum = (l) => l.reduce((n, p) => n + BC.chess.VALUE[p], 0), diff = sum(G.captured[team]) - sum(G.captured[team ^ 1]);
      BC.text(ctx, 'TAKEN', x + 12, y + 224, { s: 1, c: '#9a8cb0' });
      if (diff > 0) BC.text(ctx, '+' + diff, x + w - 12, y + 224, { s: 1, c: T.trim, a: 'r' });
      caps.forEach((p, i) => BC.drawSprite(ctx, p, team ^ 1, 'morph', 0, x + 20 + (i % 8) * 21, y + 264 + Math.floor(i / 8) * 32, { scale: 0.42 * BC.statueScale(p), flip: false }));
      if (active) {
        const a = 0.5 + 0.5 * Math.sin(t * 6);
        BC.text(ctx, G.mode === 'think' ? 'THINKING' + '...'.slice(0, 1 + (Math.floor(t * 3) % 3)) : G.checkSq >= 0 ? 'IN CHECK!' : 'TO MOVE', x + w / 2, y + h + 8, { a: 'c', s: 2, c: G.checkSq >= 0 ? '#ff5068' : T.glow, o: '#05030a' });
        ctx.globalAlpha = k * (0.25 + 0.3 * a); ctx.strokeStyle = T.trim; ctx.lineWidth = 2; ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
      }
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = k; ctx.translate(0, -(1 - k) * 60);
    panel(ctx, 340, 8, 280, 24, '#3a2a4c', 0.8);
    BC.text(ctx, G.env.name, 350, 16, { s: 1, c: G.env.accent });
    const n = G.moves.length;
    BC.text(ctx, n ? `${Math.ceil(n / 2)}${n % 2 ? '.' : '...'} ${G.moves[n - 1]}` : 'FIRST MOVE', 610, 13, { s: 2, c: '#fff', a: 'r', sh: '#05030a' });
    if (G.ai && G.ai.coach === 2) {
      // who is ahead, Sun's share from the left
      ctx.fillStyle = '#05030a'; ctx.fillRect(338, 36, 284, 9);
      ctx.fillStyle = BC.TEAMS[1].main; ctx.fillRect(340, 38, 280, 5);
      ctx.fillStyle = BC.TEAMS[0].main; ctx.fillRect(340, 38, Math.round(280 * G.bal / 100), 5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(479, 37, 2, 7);
    }
    ctx.restore();
    if (G.mode === 'play') {
      ctx.globalAlpha = 0.7 * k;
      BC.text(ctx, 'CLICK / (A) SELECT    (B) CANCEL    [H] HINTS ' + onOff(BC.opts.hints) + (G.ai && G.ai.coach ? '    [T] TIP' : '') + '    [ESC] MENU', 480, 529, { a: 'c', s: 1, c: '#e8dcf4', o: '#05030a' });
      ctx.globalAlpha = 1;
    }
  };
  UI.banner = function (ctx, b) {
    const k = b.age / b.life, T = BC.TEAMS[b.team], inn = BC.ease.out(Math.min(1, b.age / 0.16)), a = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    ctx.save(); ctx.globalAlpha = a;
    const h = 74 * inn, g = ctx.createLinearGradient(0, 0, 960, 0);
    g.addColorStop(0, 'rgba(8,4,16,0)'); g.addColorStop(0.2, 'rgba(8,4,16,0.9)'); g.addColorStop(0.8, 'rgba(8,4,16,0.9)'); g.addColorStop(1, 'rgba(8,4,16,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 232 - h / 2, 960, h);
    ctx.fillStyle = T.main; ctx.fillRect(120, 232 - h / 2, 720, 2); ctx.fillRect(120, 232 + h / 2 - 2, 720, 2);
    ctx.translate(480 + (1 - inn) * 80, 232);
    BC.text(ctx, b.str, 0, b.sub ? -30 : -22, { a: 'c', s: 6, g: ['#ffffff', T.trim], o: T.ink });
    if (b.sub) BC.text(ctx, b.sub, 0, 18, { a: 'c', s: 2, c: T.glow, o: T.ink });
    ctx.restore();
  };
  // Face-off card before the checkmate finisher.
  UI.splash = function (ctx, sp) {
    const k = sp.age / sp.life, inn = BC.ease.out(Math.min(1, k / 0.18)), outk = k > 0.82 ? (k - 0.82) / 0.18 : 0;
    const off = (1 - inn) * 520 + outk * outk * 620;
    ctx.fillStyle = `rgba(6,3,14,${0.55 * inn * (1 - outk)})`; ctx.fillRect(0, 0, 960, 540);
    [sp.a, sp.v].forEach((pc, i) => {
      const T = BC.TEAMS[pc.c], dir = i === 0 ? -1 : 1, x0 = i === 0 ? -off : 500 + off;
      ctx.save();
      ctx.beginPath();
      if (i === 0) { ctx.moveTo(x0, 150); ctx.lineTo(x0 + 500, 150); ctx.lineTo(x0 + 420, 390); ctx.lineTo(x0, 390); }
      else { ctx.moveTo(x0 + 40, 150); ctx.lineTo(x0 + 460, 150); ctx.lineTo(x0 + 460, 390); ctx.lineTo(x0 - 40, 390); }
      ctx.closePath(); ctx.clip();
      const g = ctx.createLinearGradient(0, 150, 0, 390);
      g.addColorStop(0, T.main); g.addColorStop(1, T.ink);
      ctx.fillStyle = g; ctx.fillRect(x0 - 60, 150, 600, 240);
      ctx.globalAlpha = 0.18; ctx.fillStyle = T.trim;
      for (let n = 0; n < 12; n++) ctx.fillRect(x0 - 60, 156 + n * 20 + ((UI.t * 60 + n * 7) % 20), 600, 3);
      ctx.globalAlpha = 1;
      const face = BC.assets.img['face_' + T.key + '_' + BC.PIECE[pc.t]];
      if (face) {
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.translate(x0 + (i === 0 ? 200 : 250), 160); if (pc.c === 1) ctx.scale(-1, 1);
        ctx.drawImage(face, -face.width * 0.55, 0, face.width * 1.1, face.height * 1.1);
      }
      ctx.restore();
      ctx.fillStyle = T.trim; ctx.fillRect(i === 0 ? x0 : x0 - 40, 388, 500, 3); ctx.fillRect(i === 0 ? x0 : x0 + 40, 148, 500, 3);
      BC.text(ctx, BC.PIECE_NAMES[pc.t], i === 0 ? x0 + 24 : x0 + 436, 356, { s: 3, a: i === 0 ? 'l' : 'r', c: '#fff', o: T.ink });
    });
    ctx.save(); ctx.globalAlpha = inn * (1 - outk); ctx.translate(480, 270); ctx.scale(1 + (1 - inn) * 2, 1 + (1 - inn) * 2);
    BC.text(ctx, 'FINAL BLOW', 0, -24, { a: 'c', s: 6, g: ['#ffffff', '#ffd23e'], o: '#2a0d16' });
    ctx.restore();
  };
  UI.promo = function (ctx, G) {
    const P = G.promo, team = G.S.turn, T = BC.TEAMS[team];
    ctx.fillStyle = 'rgba(6,3,14,0.6)'; ctx.fillRect(0, 0, 960, 540);
    panel(ctx, 220, 150, 520, 230, T.main);
    BC.text(ctx, 'PROMOTE TO', 480, 164, { a: 'c', s: 3, g: GOLD, o: '#2a0d16' });
    P.moves.forEach((m, i) => {
      const x = 300 + i * 120, sel = i === P.i;
      if (sel) { ctx.fillStyle = T.main + '55'; ctx.fillRect(x - 54, 196, 108, 172); ctx.strokeStyle = T.trim; ctx.lineWidth = 2; ctx.strokeRect(x - 54, 196, 108, 172); }
      BC.drawSprite(ctx, m.promo, team, 'idle', sel ? Math.floor(UI.t * 6) % 4 : 0, x - 6, 340, { scale: sel ? 1 : 0.88, flip: false });
      BC.text(ctx, BC.PIECE_NAMES[m.promo], x, 350, { a: 'c', s: 2, c: sel ? '#fff' : '#a898bc', o: '#05030a' });
    });
  };

  // ---------- title screen ----------
  class Title {
    constructor() { this.t = 0; this.envI = 0; this.clockI = 3; this.cpu = Object.assign({ level: 3, side: 0, coach: 2, clockI: 0 }, BC.save.get('solo') || {}); this.amb = new BC.Ambient(BC.ENVS[0]); BC.audio.music('title'); this.main(); }
    main() {
      UI.clear();
      const has = !!BC.save.get('auto');
      UI.open({ title: '', sticky: true, shade: false, y: has ? 318 : 336, w: 330, bare: true, items: [
        ...(has ? [{ label: 'CONTINUE', act: () => loadSlot('auto') }] : []),
        { label: 'ONE PLAYER', act: () => this.solo() },
        { label: 'TWO PLAYERS', act: () => this.setup() },
        { label: 'LOAD GAME', act: () => UI.slots('load') },
        { label: 'OPTIONS', act: UI.options },
        { label: 'HOW TO PLAY', act: () => UI.open({ title: 'HOW TO PLAY', w: 640, items: [
          { label: 'PLAY THE COMPUTER, OR A FRIEND ON THE SAME SCREEN.', small: true, off: () => true },
          { label: 'SUN MOVES FIRST. T ASKS THE COACH FOR A TIP.', small: true, off: () => true },
          { label: 'MOUSE: CLICK A PIECE, THEN A SQUARE.', small: true, off: () => true },
          { label: 'GAMEPAD: STICK OR D-PAD, (A) PICK, (B) CANCEL.', small: true, off: () => true },
          { label: 'TWO GAMEPADS: ONE EACH. START OPENS THE MENU.', small: true, off: () => true },
          { label: 'KEYS: ARROWS + ENTER.  H HINTS.  F FULL SCREEN.', small: true, off: () => true },
          { label: 'PRESS (A) OR CLICK TO SPEED UP A FIGHT.', small: true, off: () => true },
          { label: 'BACK', act: UI.close }], i: 7 }) },
      ] });
    }
    solo() {
      const P = this.cpu, L = BC.ai.LEVELS, SIDES = ['SUN, MOVES FIRST', 'MOON', 'RANDOM'];
      UI.open({ title: 'ONE PLAYER', w: 520, y: 226, shade: false, cover: true, note: () => L[P.level - 1].tag, items: [
        { label: 'OPPONENT', value: () => P.level + ' ' + L[P.level - 1].name, adj: (d) => { P.level = BC.clamp(P.level + d, 1, L.length); } },
        { label: 'YOU PLAY', value: () => SIDES[P.side], adj: (d) => { P.side = (P.side + d + 3) % 3; } },
        { label: 'COACH', value: () => COACH[P.coach], adj: (d) => { P.coach = (P.coach + d + 3) % 3; } },
        { label: 'ARENA', value: () => BC.ENVS[this.envI].name, adj: (d) => { this.envI = (this.envI + d + 3) % 3; this.amb = new BC.Ambient(BC.ENVS[this.envI]); } },
        { label: 'CLOCK', value: () => (CLOCKS[P.clockI] ? CLOCKS[P.clockI] + ' MIN EACH' : 'NO CLOCK'), adj: (d) => { P.clockI = (P.clockI + d + CLOCKS.length) % CLOCKS.length; } },
        { label: 'BEGIN', act: () => {
          BC.save.put('solo', P); UI.clear();
          const you = P.side === 2 ? (Math.random() * 2) | 0 : P.side;
          BC.go(new BC.Game({ env: this.envI, clock: CLOCKS[P.clockI], ai: { side: you ^ 1, level: P.level, coach: P.coach } }));
        } },
        { label: 'BACK', act: UI.close },
      ], i: 5 });
    }
    setup() {
      UI.open({ title: 'NEW GAME', w: 470, y: 300, shade: false, cover: true, items: [
        { label: 'ARENA', value: () => BC.ENVS[this.envI].name, adj: (d) => { this.envI = (this.envI + d + 3) % 3; this.amb = new BC.Ambient(BC.ENVS[this.envI]); } },
        { label: 'CLOCK', value: () => (CLOCKS[this.clockI] ? CLOCKS[this.clockI] + ' MIN EACH' : 'NO CLOCK'), adj: (d) => { this.clockI = (this.clockI + d + CLOCKS.length) % CLOCKS.length; } },
        { label: 'MOVE HINTS', value: () => onOff(BC.opts.hints), adj: () => { BC.opts.hints = !BC.opts.hints; BC.saveOpts(); } },
        { label: 'BEGIN', act: () => { UI.clear(); BC.go(new BC.Game({ env: this.envI, clock: CLOCKS[this.clockI] })); } },
        { label: 'BACK', act: UI.close },
      ], i: 3 });
    }
    input() {}
    update(dt) { this.t += dt; this.amb.update(dt); }
    draw(ctx) {
      const env = BC.ENVS[this.envI], t = this.t;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      const bg = BC.assets.img['stage_' + env.key] || BC.assets.img['bg_' + env.key];
      ctx.imageSmoothingEnabled = true;
      const pan = Math.sin(t * 0.1) * 14;
      if (bg) ctx.drawImage(bg, -30 + pan, -17, 1020, 574); else { ctx.fillStyle = '#1a1028'; ctx.fillRect(0, 0, 960, 540); }
      ctx.fillStyle = 'rgba(10,4,22,0.32)'; ctx.fillRect(0, 0, 960, 540);
      this.amb.draw(ctx, false);
      // the two kings square off
      for (let team = 0; team < 2; team++) {
        const x = team === 0 ? 150 : 810, y = 500;
        ctx.fillStyle = 'rgba(8,4,16,0.4)'; ctx.beginPath(); ctx.ellipse(x, y, 70, 12, 0, 0, 7); ctx.fill();
        BC.drawSprite(ctx, 'k', team, 'idle', Math.floor(t * 6 + team * 2) % 4, x, y, { scale: 2.5, flip: team === 1 });
      }
      this.amb.draw(ctx, true); this.amb.light(ctx);
      const vg = ctx.createRadialGradient(480, 260, 160, 480, 260, 640);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,2,20,0.7)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, 960, 540);
      BC.bloom(ctx);
      const bob = Math.sin(t * 1.6) * 3;
      const logo = BC.assets.img.logo;
      if (logo) {
        const lw = 600, lh = logo.height * lw / logo.width;
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.save(); ctx.shadowColor = 'rgba(8,2,16,0.8)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
        ctx.drawImage(logo, 480 - lw / 2, 118 - lh / 2 + bob, lw, lh);
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(480, 96 + bob);
        BC.text(ctx, 'KINGFALL', 4, 6, { a: 'c', s: 14, c: '#16081c' });
        BC.text(ctx, 'KINGFALL', 0, 0, { a: 'c', s: 14, g: ['#fff8d0', '#ff5a2a'], o: '#3a0d18' });
        ctx.restore();
        ctx.drawImage(BC.stamp('王'), 0, 0, 30, 30, 786, 92 + bob, 60, 60);
      }
      if (!(UI.stack.length > 1 && UI.stack[1].title === 'ONE PLAYER')) BC.text(ctx, 'PIXEL BATTLE CHESS', 480, 240 + bob, { a: 'c', s: 3, c: '#ffe9a0', o: '#2a0d16' });
      if (UI.stack.length > 1 && UI.stack[1].title === 'NEW GAME') {
        BC.text(ctx, env.name, 480, 258, { a: 'c', s: 4, g: ['#ffffff', env.accent], o: '#05030a' });
        BC.text(ctx, env.tag, 480, 290, { a: 'c', s: 1, c: '#e8dcf4', o: '#05030a' });
      }
      BC.text(ctx, 'ONE OR TWO PLAYERS   MOUSE OR GAMEPAD', 480, 526, { a: 'c', s: 1, c: '#cfc0e0', o: '#05030a' });
    }
  }
  BC.Title = Title;
})();
