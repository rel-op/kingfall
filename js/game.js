// One match: board state, piece views, selection, move animation, drawing.
(function () {
  'use strict';
  const BC = window.BC, C = BC.chess, V = BC.view;
  const FEET = 0.2; // pieces stand a little in front of their square's centre

  class Game {
    constructor(cfg) {
      this.fx = new BC.Fx(); this.tasks = []; this.t = 0; this.rt = 0;
      this.cam = { x: 480, y: 270, z: 1 }; this.shakeM = 0; this.freeze = 0; this.speed = 1; this.slow = 1;
      this.dim = 0; this.bars = 0; this.hudK = 1; this.fight = null; this.banner = null; this.combo = 0;
      this.sel = -1; this.targets = []; this.hover = -1; this.promo = null; this.history = [];
      if (cfg.save) this.load(cfg.save);
      else {
        this.envI = cfg.env || 0; this.S = cfg.fen ? C.fromFEN(cfg.fen) : C.newGame();
        this.clockBase = cfg.clock || 0; this.clock = this.clockBase ? [this.clockBase * 60, this.clockBase * 60] : null;
        this.moves = []; this.captured = [[], []]; this.last = null; this.result = null;
      }
      this.env = BC.ENVS[this.envI]; this.amb = new BC.Ambient(this.env);
      this.cursor = [V.orient === 'side' ? 52 : 52, V.orient === 'side' ? 12 : 12];
      this.mode = this.result ? 'over' : 'play';
      this.build(); this.refresh();
      BC.audio.music(this.env.key);
    }
    snapshot() {
      return { v: 2, env: this.envI, clockBase: this.clockBase, clock: this.clock && this.clock.slice(), S: C.clone(this.S), moves: this.moves.slice(),
        captured: [this.captured[0].slice(), this.captured[1].slice()], last: this.last, result: this.result, date: Date.now() };
    }
    load(s) {
      this.envI = s.env; this.clockBase = s.clockBase; this.clock = s.clock && s.clock.slice(); this.S = C.clone(s.S);
      this.moves = s.moves.slice(); this.captured = [s.captured[0].slice(), s.captured[1].slice()]; this.last = s.last; this.result = s.result || null;
    }
    build() {
      this.pv = [];
      this.S.board.forEach((p, sq) => {
        if (!p) return;
        const uv = V.sqUV(sq);
        this.pv.push({ id: p.id, t: p.t, c: p.c, sq, u: uv.u, v: uv.v, m: 0, mT: 0, anim: 'idle', at: Math.random() * 3, fi: 0, flip: p.c === 1, hop: 0, ox: 0, white: 0, rot: 0, alpha: 1, hidden: false, scale: 1 });
      });
    }
    at(sq) { return this.pv.find((p) => p.sq === sq && !p.hidden); }
    refresh() {
      this.legal = C.legalMoves(this.S);
      this.checkSq = C.inCheck(this.S, this.S.turn) ? C.kingSq(this.S, this.S.turn) : -1;
    }

    // ---- tiny scheduler: animation code reads top to bottom with await ----
    tween(d, fn, ease) { return new Promise((res) => this.tasks.push({ t: 0, d: Math.max(0.0001, d), fn, ease, res })); }
    wait(d) { return this.tween(d, () => {}); }
    until(test) { return new Promise((res) => this.tasks.push({ test, res })); }
    shake(m) { this.shakeM = Math.max(this.shakeM, m); }

    // ---- input ----
    input(ev) {
      if (this.mode === 'over') return;
      if (this.mode === 'anim') { if (ev.type === 'ok') this.speed = 5; return; }
      const turn = this.S.turn;
      if (ev.pad !== undefined && BC.input.padCount() >= 2 && ev.pad !== turn) return;
      if (this.mode === 'promo') return this.promoInput(ev);
      if (ev.type === 'dir') {
        const uv = V.sqUV(this.cursor[turn]);
        const sq = V.uvSq(BC.clamp(uv.u + ev.dx, 0.5, 7.5), BC.clamp(uv.v + ev.dy, 0.5, 7.5));
        if (sq >= 0 && sq !== this.cursor[turn]) { this.cursor[turn] = sq; BC.audio.sfx('ui_move', 0.5); }
        this.mouseMode = false;
      } else if (ev.type === 'ok') {
        if (ev.mouse) { const sq = this.pick(ev.x, ev.y); if (sq < 0) return; this.cursor[turn] = sq; }
        this.act(this.cursor[turn]);
      } else if (ev.type === 'back') { if (this.sel >= 0) this.deselect(); else BC.ui.pause(this); }
      else if (ev.type === 'menu') BC.ui.pause(this);
      else if (ev.type === 'hint') { BC.opts.hints = !BC.opts.hints; BC.saveOpts(); BC.audio.sfx('ui_ok', 0.6); this.note(BC.opts.hints ? 'MOVE HINTS ON' : 'MOVE HINTS OFF'); }
      else if (ev.type === 'move' && this.mode === 'play') { const sq = this.pick(ev.x, ev.y); if (sq >= 0) { this.cursor[turn] = sq; this.mouseMode = true; } }
    }
    pick(x, y) { const p = V.unproject(x, y); return V.uvSq(p.u, p.v); }
    note(str) { this.fx.text(str, 480, 150, { s: 2, c: '#fff', life: 1.1, rise: 10 }); }
    select(sq) {
      this.deselect(true);
      this.sel = sq; this.targets = this.legal.filter((m) => m.from === sq);
      const pv = this.at(sq); pv.mT = 7; pv.anim = 'idle'; pv.at = 0;
      BC.audio.sfx('morph_up', 0.8);
      const p = V.project(pv.u, pv.v + FEET);
      this.fx.ring(p.x, p.y, 44 * p.s, BC.TEAMS[pv.c].trim, 0.45);
      this.fx.sparks(p.x, p.y - 30 * p.s, 16, [BC.TEAMS[pv.c].glow, '#ffffff', BC.TEAMS[pv.c].trim], 130, 0.5);
    }
    deselect(quiet) {
      if (this.sel < 0) return;
      const pv = this.at(this.sel);
      if (pv) pv.mT = 0;
      this.sel = -1; this.targets = [];
      if (!quiet) BC.audio.sfx('morph_down', 0.5);
    }
    act(sq) {
      const turn = this.S.turn, pc = this.S.board[sq];
      if (this.sel >= 0) {
        const opts = this.targets.filter((m) => m.to === sq);
        if (opts.length > 1) { this.promo = { moves: opts, i: 0 }; this.mode = 'promo'; BC.audio.sfx('ui_ok'); return; }
        if (opts.length === 1) return void this.play(opts[0]);
        if (sq === this.sel) return this.deselect();
        if (!pc || pc.c !== turn) return this.deselect();
      }
      if (pc && pc.c === turn) {
        if (this.legal.some((m) => m.from === sq)) this.select(sq);
        else { BC.audio.sfx('ui_back', 0.7); const pv = this.at(sq); this.tween(0.25, (k) => { pv.ox = Math.sin(k * 25) * 3 * (1 - k); }); }
      }
    }
    promoInput(ev) {
      const P = this.promo;
      if (ev.type === 'dir' && ev.dx) { P.i = (P.i + ev.dx + 4) % 4; BC.audio.sfx('ui_move', 0.5); }
      else if (ev.type === 'move' || (ev.type === 'ok' && ev.mouse)) {
        const i = Math.floor((ev.x - 240) / 120);
        if (ev.y > 170 && ev.y < 370 && i >= 0 && i < 4) { P.i = i; if (ev.type === 'ok') this.promoPick(); }
      } else if (ev.type === 'ok') this.promoPick();
      else if (ev.type === 'back') { this.promo = null; this.mode = 'play'; }
    }
    promoPick() { const m = this.promo.moves[this.promo.i]; this.promo = null; this.play(m); }

    // ---- moving ----
    async morph(pv, to) { pv.mT = to; await this.until(() => pv.m === to); }
    async walk(pv, u, v, o) {
      o = o || {};
      const u0 = pv.u, v0 = pv.v, dist = Math.hypot(u - u0, v - v0);
      const d = o.d || Math.max(0.2, dist / (o.speed || 9));
      if (Math.abs(u - u0) > 0.05) pv.flip = u < u0;
      pv.anim = 'move'; pv.at = 0;
      const p0 = V.project(u0, v0 + FEET);
      this.fx.dust(p0.x, p0.y, 5, '#fff3e0');
      BC.audio.sfx(pv.t === 'n' ? 'gallop' : pv.t === 'r' ? 'stomp' : 'dash', 0.6);
      await this.tween(d, (k) => {
        pv.u = u0 + (u - u0) * k; pv.v = v0 + (v - v0) * k;
        pv.hop = o.jump ? Math.sin(Math.PI * k) * o.jump : 0;
        if (o.trail) this.ghostOf(pv);
      }, o.ease || BC.ease.io);
      pv.hop = 0; pv.anim = 'idle'; pv.at = 0;
    }
    ghostOf(pv) {
      if (this.t - (pv.gt || 0) < 0.035) return;
      pv.gt = this.t;
      const p = V.project(pv.u, pv.v + FEET), st = this.frameOf(pv);
      this.fx.ghost(pv.t, pv.c, st[0], st[1], p.x, p.y - pv.hop * 46 * p.s, { flip: pv.flip, scale: p.s }, 0.2);
    }
    async play(m) {
      const S = this.S, pv = this.at(m.from), team = pv.c;
      this.history.push(JSON.stringify(this.snapshot()));
      this.mode = 'anim'; this.speed = 1; this.sel = -1; this.targets = [];
      const san = C.san(S, m, this.legal);
      await this.morph(pv, 7);
      const to = V.sqUV(m.to);
      const victim = m.capSq >= 0 ? this.at(m.capSq) : null;
      if (victim) {
        if (BC.opts.fights === 'off') { await this.walk(pv, to.u, to.v, { jump: pv.t === 'n' ? 0.9 : 0 }); this.smash(victim, pv.flip ? -1 : 1); }
        else await BC.takedown(this, pv, victim, { to });
        this.captured[team].push(victim.t);
      } else {
        const jobs = [this.walk(pv, to.u, to.v, { jump: pv.t === 'n' ? 0.9 : 0, trail: pv.t === 'q' })];
        if (m.flag === 'ck' || m.flag === 'cq') {
          const rk = this.at(m.flag === 'ck' ? m.to + 1 : m.to - 2), ruv = V.sqUV(m.flag === 'ck' ? m.to - 1 : m.to + 1);
          rk.sq = m.flag === 'ck' ? m.to - 1 : m.to + 1;
          BC.audio.sfx('castle', 0.8);
          jobs.push((async () => { await this.morph(rk, 7); await this.walk(rk, ruv.u, ruv.v); rk.flip = rk.c === 1; await this.morph(rk, 0); })());
        }
        await Promise.all(jobs);
      }
      pv.sq = m.to; pv.flip = team === 1; pv.u = to.u; pv.v = to.v;
      C.play(S, m);
      this.moves.push(san); this.last = { from: m.from, to: m.to };
      const p = V.project(pv.u, pv.v + FEET);
      if (m.promo) {
        pv.t = m.promo; pv.white = 1;
        this.fx.beam(p.x, p.y, 34 * p.s, BC.TEAMS[team].glow, 0.7); this.fx.ring(p.x, p.y, 70, BC.TEAMS[team].trim, 0.6);
        this.fx.sparks(p.x, p.y - 40, 40, ['#ffffff', BC.TEAMS[team].glow, BC.TEAMS[team].trim], 220, 0.8);
        this.say('PROMOTION', BC.PIECE_NAMES[m.promo], team); BC.audio.sfx('promote');
        pv.anim = 'idle'; await this.wait(0.7);
      }
      await this.morph(pv, 0);
      this.fx.dust(p.x, p.y, 8); BC.audio.sfx('land', 0.7); this.shake(1.5);
      this.speed = 1;
      this.refresh();
      const st = C.status(S);
      if (st === 'checkmate') {
        BC.audio.sfx('check'); await this.wait(0.35);
        const king = this.pv.find((q) => q.t === 'k' && q.c !== team && !q.hidden);
        if (BC.opts.fights !== 'off') await BC.takedown(this, pv, king, { mate: true });
        else this.smash(king, team === 0 ? 1 : -1);
        return this.end({ type: 'checkmate', winner: team });
      }
      if (st !== 'playing') return this.end({ type: st, winner: -1 });
      if (this.checkSq >= 0) { this.say('CHECK', '', team); BC.audio.sfx('check', 0.8); }
      this.mode = 'play';
      BC.save.put('auto', this.snapshot());
    }
    // Instant capture used when fight scenes are turned off.
    smash(victim, dir) {
      const p = V.project(victim.u, victim.v + FEET);
      this.fx.shatter(victim.t, victim.c, 'morph', 0, p.x, p.y, p.s, victim.flip, dir);
      this.fx.dust(p.x, p.y, 12); this.fx.sparks(p.x, p.y - 30, 20, ['#fff', BC.TEAMS[victim.c].stone[0]], 200);
      victim.hidden = true; this.shake(6); this.fx.flash(0.3); BC.audio.sfx('shatter');
    }
    say(str, sub, team) { this.banner = { str, sub, team, age: 0, life: 1.5 }; }
    end(result) {
      this.result = result; this.mode = 'over'; this.sel = -1; this.targets = [];
      BC.save.del('auto');
      BC.audio.sfx(result.winner >= 0 ? 'win' : 'draw');
      BC.ui.gameOver(this);
      // the winning army comes alive to celebrate
      if (result.winner >= 0) this.pv.filter((p) => p.c === result.winner && !p.hidden).forEach((p, i) => { this.wait(0.25 + i * 0.07).then(() => { p.mT = 7; p.anim = 'idle'; p.at = 0; }); });
    }
    undo() {
      if (!this.history.length || this.mode !== 'play') return false;
      this.load(JSON.parse(this.history.pop()));
      this.sel = -1; this.targets = []; this.build(); this.refresh();
      return true;
    }

    // ---- frame update ----
    update(dt) {
      this.rt += dt;
      this.amb.update(dt);
      this.shakeM = Math.max(0, this.shakeM - dt * 34);
      if (this.banner && (this.banner.age += dt) > this.banner.life) this.banner = null;
      if (this.splash && (this.splash.age += dt * this.speed) > this.splash.life) this.splash = null;
      // a glint now and then on the army whose turn it is
      if (this.mode === 'play' && (this.glint = (this.glint || 0) - dt) < 0) {
        this.glint = 0.35 + Math.random() * 0.5;
        const mine = this.pv.filter((p) => p.c === this.S.turn && !p.hidden && p.m === 0);
        if (mine.length) {
          const p = mine[(Math.random() * mine.length) | 0], q = V.project(p.u, p.v + FEET);
          this.fx.parts.add({ kind: 'star', x: q.x + (Math.random() - 0.5) * 14 * q.s, y: q.y - (20 + Math.random() * 34) * q.s, life: 0.5, s: 4, col: '#ffffff', glow: true });
        }
      }
      let w = dt * this.speed;
      this.fx.update(w * (this.freeze > 0 ? 0.25 : 1) * this.slow, dt);
      if (this.freeze > 0) { this.freeze -= w; w = 0; } else w *= this.slow;
      this.t += w;
      const run = this.tasks; this.tasks = [];
      for (const k of run) {
        if (k.test) { if (k.test()) k.res(); else this.tasks.push(k); continue; }
        k.t += w;
        const q = Math.min(1, k.t / k.d);
        k.fn(k.ease ? k.ease(q) : q);
        if (q >= 1) k.res(); else this.tasks.push(k);
      }
      for (const p of this.pv) {
        if (p.m < p.mT) p.m = Math.min(p.mT, p.m + w * 7 / 0.38);
        else if (p.m > p.mT) p.m = Math.max(p.mT, p.m - w * 7 / 0.26);
        p.at += w; p.white = Math.max(0, p.white - dt * 7);
      }
      if (this.mode === 'play' && this.clock) {
        const c = this.clock, tn = this.S.turn, before = c[tn];
        c[tn] = Math.max(0, c[tn] - dt);
        if (c[tn] < 10 && Math.floor(before) !== Math.floor(c[tn])) BC.audio.sfx('tick', 0.7);
        if (c[tn] <= 0) this.end({ type: 'time', winner: tn ^ 1 });
      }
    }
    frameOf(p) {
      if (p.m <= 0) return ['morph', 0];
      if (p.m < 7) return ['morph', Math.floor(p.m)];
      if (p.anim === 'attack') return ['attack', p.fi];
      if (p.anim === 'hit') return ['hit', Math.min(3, Math.floor(p.at * 11))];
      if (p.anim === 'move') return ['move', Math.floor(p.at * (p.t === 'r' ? 11 : 16)) % 8];
      return ['idle', Math.floor(p.at * 6) % 4];
    }

    // ---- drawing ----
    drawPiece(ctx, p) {
      const q = V.project(p.u, p.v + FEET), k0 = BC.statueScale(p.t), sc = q.s * p.scale * (k0 + (1 - k0) * Math.min(1, p.m / 7));
      const lift = p.hop * 46 * q.s;
      ctx.save();
      ctx.globalAlpha = 0.34 * p.alpha * Math.max(0.3, 1 - p.hop * 0.5);
      ctx.fillStyle = '#0a0414';
      ctx.beginPath(); ctx.ellipse(q.x + p.ox, q.y + 1, (p.t === 'n' && p.m >= 7 ? 30 : 21) * sc * (1 - p.hop * 0.25), 6.5 * sc, 0, 0, 7); ctx.fill();
      ctx.restore();
      const st = this.frameOf(p);
      const w = Math.max(p.white, p.m > 0 && p.m < 7 ? Math.sin((p.m / 7) * Math.PI) * 0.5 : 0);
      BC.drawSprite(ctx, p.t, p.c, st[0], st[1], q.x + p.ox, q.y - lift, { flip: p.flip, scale: sc, white: w, rot: p.rot, alpha: p.alpha });
    }
    world(ctx) {
      const c = this.cam, sx = (Math.random() - 0.5) * this.shakeM, sy = (Math.random() - 0.5) * this.shakeM;
      ctx.setTransform(2 * c.z, 0, 0, 2 * c.z, 2 * (480 - c.x * c.z + sx), 2 * (270 - c.y * c.z + sy));
    }
    draw(ctx) {
      const T = BC.TEAMS, turn = this.S.turn, env = this.env, t = this.rt;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.fillStyle = '#07050c'; ctx.fillRect(0, 0, 960, 540);
      this.world(ctx);
      ctx.imageSmoothingEnabled = true;
      const bg = BC.assets.img['bg_' + env.key];
      if (bg) ctx.drawImage(bg, -24, -14, 1008, 568);
      else { const g = ctx.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, env.sky); g.addColorStop(1, '#201428'); ctx.fillStyle = g; ctx.fillRect(-30, -20, 1020, 580); }
      ctx.fillStyle = env.shade; ctx.fillRect(-30, -20, 1020, 580);
      this.amb.fires(ctx);
      this.amb.draw(ctx, false);
      ctx.drawImage(BC.boardCanvas(env), 0, 0, 960, 540);
      // rank and file labels on the frame
      if (!this.fight) for (let i = 0; i < 8; i++) {
        const side = V.orient === 'side';
        const a = V.project(i + 0.5, -0.25), b = V.project(-0.27, i + 0.5);
        BC.text(ctx, side ? String(i + 1) : 'ABCDEFGH'[i], a.x, a.y - 3, { a: 'c', c: env.frame[3], o: env.frame[2] });
        BC.text(ctx, side ? 'ABCDEFGH'[i] : String(8 - i), b.x, b.y - 3, { a: 'c', c: env.frame[3], o: env.frame[2] });
      }

      // square overlays
      if (!this.fight) {
        const sqQuad = (sq, inset) => { const uv = V.sqUV(sq), i = inset || 0; V.quad(ctx, uv.u - 0.5 + i, uv.v - 0.5 + i, uv.u + 0.5 - i, uv.v + 0.5 - i); };
        if (this.last) for (const sq of [this.last.from, this.last.to]) { sqQuad(sq); ctx.fillStyle = 'rgba(255,236,150,0.26)'; ctx.fill(); }
        if (this.checkSq >= 0) {
          sqQuad(this.checkSq); ctx.fillStyle = `rgba(255,30,50,${0.35 + 0.25 * Math.sin(t * 9)})`; ctx.fill();
          sqQuad(this.checkSq, 0.04); ctx.strokeStyle = '#ff3048'; ctx.lineWidth = 2; ctx.stroke();
        }
        if (this.sel >= 0) {
          sqQuad(this.sel); ctx.fillStyle = T[turn].main + '66'; ctx.fill();
          sqQuad(this.sel, 0.03); ctx.strokeStyle = T[turn].trim; ctx.lineWidth = 2; ctx.stroke();
          if (BC.opts.hints) {
            const seen = new Set();
            for (const m of this.targets) {
              if (seen.has(m.to)) continue; seen.add(m.to);
              const uv = V.sqUV(m.to), p = V.project(uv.u, uv.v), pulse = 0.5 + 0.5 * Math.sin(t * 6 + uv.u + uv.v);
              if (m.cap) {
                sqQuad(m.to); ctx.fillStyle = `rgba(255,40,60,${0.2 + 0.16 * pulse})`; ctx.fill();
                sqQuad(m.to, 0.05 + 0.03 * pulse); ctx.strokeStyle = '#ff4058'; ctx.lineWidth = 2.5; ctx.stroke();
              } else {
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                const r = (9 + 3 * pulse) * p.s, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
                g.addColorStop(0, T[turn].glow); g.addColorStop(0.35, T[turn].main + 'aa'); g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g; ctx.translate(p.x, p.y); ctx.scale(1, 0.5); ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, 7); ctx.fill();
                ctx.restore();
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 5 * p.s, 2.6 * p.s, 0, 0, 7); ctx.fill();
                ctx.strokeStyle = T[turn].main; ctx.lineWidth = 1.5; ctx.stroke();
              }
            }
          }
        }
        if (this.mode === 'play') {
          const uv = V.sqUV(this.cursor[turn]), b = 0.06 + 0.03 * Math.sin(t * 7), L = 0.26;
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineJoin = 'miter';
          for (const [cu, cv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            const u = uv.u + cu * (0.5 - b), v = uv.v + cv * (0.5 - b);
            const a = V.project(u - cu * L, v), c2 = V.project(u, v), d = V.project(u, v - cv * L);
            ctx.strokeStyle = '#1a0c16'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(d.x, d.y); ctx.stroke();
            ctx.strokeStyle = T[turn].trim; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(d.x, d.y); ctx.stroke();
          }
        }
      }

      // pieces, far row first; the fighters are drawn above the dimmed board
      const order = this.pv.filter((p) => !p.hidden).sort((a, b) => a.v - b.v || a.m - b.m);
      const F = this.fight;
      for (const p of order) if (!F || (p !== F.a && p !== F.v)) this.drawPiece(ctx, p);
      if (this.dim > 0.01) { ctx.fillStyle = `rgba(10,4,22,${this.dim})`; ctx.fillRect(-200, -200, 1400, 1000); }
      if (F && F.rays > 0.01) this.rays(ctx, F);
      if (F) for (const p of order) if (p === F.a || p === F.v) this.drawPiece(ctx, p);
      this.fx.drawWorld(ctx);
      this.amb.draw(ctx, true);

      // lighting and grade, in screen space
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      this.amb.light(ctx);
      const vg = ctx.createRadialGradient(480, 290, 200, 480, 290, 640);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, env.grade[1]);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = env.grade[0]; ctx.fillRect(0, 0, 960, 540);
      BC.bloom(ctx);
      if (this.bars > 0.01) { ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, 960, 46 * this.bars); ctx.fillRect(0, 540 - 46 * this.bars, 960, 46 * this.bars); }
      BC.ui.hud(ctx, this);
      if (this.banner) BC.ui.banner(ctx, this.banner);
      if (this.splash) BC.ui.splash(ctx, this.splash);
      if (this.promo) BC.ui.promo(ctx, this);
      this.fx.drawScreen(ctx);
    }
    // Manga-style focus lines converging on a finishing blow.
    rays(ctx, F) {
      const p = V.project(F.v.u, F.v.v + FEET), col = BC.TEAMS[F.a.c], r = BC.rng(((this.rt * 24) | 0) + 5);
      ctx.save(); ctx.translate(p.x, p.y - 44); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 46; i++) {
        const a = r() * Math.PI * 2, w = 0.012 + r() * 0.05, r0 = 70 + r() * 90;
        ctx.globalAlpha = F.rays * (0.25 + r() * 0.5);
        ctx.fillStyle = i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? col.trim : col.main;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a - w) * 900, Math.sin(a - w) * 900); ctx.lineTo(Math.cos(a + w) * 900, Math.sin(a + w) * 900);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
  // Dormant statues are sized like a real chess set: pawns shortest, king tallest.
  const STATUE_H = { p: 50, r: 57, n: 63, b: 67, q: 73, k: 80 };
  BC.statueScale = (t) => { const f = BC.frame(t, 'morph', 0); return f ? STATUE_H[t] / f[3] : 1; };
  BC.Game = Game;
  BC.FEET = FEET;
})();
