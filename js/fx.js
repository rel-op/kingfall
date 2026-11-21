// Sprite frames, shattering, and the effects layer (slashes, beams, rings, pop-up text).
(function () {
  'use strict';
  const BC = window.BC, A = BC.assets;

  // ---------- sprites ----------
  BC.hasAnim = (t, anim) => { const p = (window.BC_ATLAS || {})[BC.PIECE[t]]; return !!(p && p.anims[anim]); };
  // Returns the atlas rectangle for one frame, falling back gracefully if a sheet is missing.
  BC.frame = function (t, anim, i) {
    const p = (window.BC_ATLAS || {})[BC.PIECE[t]];
    if (!p) return null;
    let ids = p.anims[anim];
    if (!ids) { ids = p.anims.idle || p.anims.attack || p.anims.morph; i = 0; if (!ids) return null; }
    return p.frames[ids[Math.max(0, Math.min(ids.length - 1, i | 0))]];
  };
  BC.animLen = (t, anim) => { const p = (window.BC_ATLAS || {})[BC.PIECE[t]]; return p && p.anims[anim] ? p.anims[anim].length : 1; };

  // o: flip, scale, alpha, white (0..1), rot, sx, sy
  BC.drawSprite = function (ctx, t, team, anim, i, x, y, o) {
    o = o || {};
    const f = BC.frame(t, anim, i), key = BC.TEAMS[team].key + '_' + BC.PIECE[t], img = A.img[key];
    if (!f || !img) {
      ctx.fillStyle = BC.TEAMS[team].main; ctx.fillRect(x - 10, y - 50, 20, 50);
      return;
    }
    const s = o.scale || 1, m = ctx.getTransform();
    const dev = Math.abs(m.a) * s;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale((o.flip ? -1 : 1) * s * (o.sx || 1), s * (o.sy || 1));
    // Keep pixels crisp when they land on whole screen pixels; otherwise filter so they don't shimmer.
    const crisp = dev >= 2.6 || Math.abs(dev - Math.round(dev)) < 0.03;
    ctx.imageSmoothingEnabled = !crisp; ctx.imageSmoothingQuality = 'high';
    if (o.alpha !== undefined) ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha));
    ctx.drawImage(img, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
    if (o.white > 0.01 && A.white[key]) {
      ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * Math.min(1, o.white);
      ctx.drawImage(A.white[key], f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
    }
    ctx.restore();
  };

  // ---------- effect sprites ----------
  // Every effect is a keyed animation on assets/fx.png, drawn once per army colour.
  BC.fxAnim = (name, tint) => { const e = (window.BC_FX || {})[name]; return e ? e[tint] || e[Object.keys(e)[0]] : null; };
  // o: flip, flipY, alpha
  BC.drawFx = function (ctx, name, tint, i, x, y, o) {
    const fr = BC.fxAnim(name, tint), img = A.img.fx;
    if (!fr || !img) return;
    const f = fr[Math.max(0, Math.min(fr.length - 1, i | 0))];
    if (!f[2]) return;
    o = o || {};
    const dev = Math.abs(ctx.getTransform().a);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(o.flip ? -1 : 1, o.flipY ? -1 : 1);
    ctx.imageSmoothingEnabled = !(dev >= 2.6 || Math.abs(dev - Math.round(dev)) < 0.03);
    if (o.alpha !== undefined) ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha));
    ctx.drawImage(img, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
    ctx.restore();
  };

  const pick = (v, table) => { for (const [max, name] of table) if (v <= max) return name; return table[table.length - 1][1]; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  // Spark sprites are drawn for three headings; the other five are mirrors. Indexed by octant.
  const SPARK = [['h', 0, 0], ['d', 0, 0], ['v', 0, 0], ['d', 1, 0], ['h', 1, 0], ['d', 1, 1], ['v', 0, 1], ['d', 0, 1]];

  class Fx {
    constructor() { this.items = []; this.bits = []; this.texts = []; this.shards = []; this.ghosts = []; this.flashA = 0; this.flashCol = '#fff'; }
    // One sprite animation played once over `life` seconds.
    // o: flip, flipY, delay, under (drawn on the floor, beneath the pieces)
    spr(name, tint, x, y, life, o) {
      const it = Object.assign({ name, tint, x, y, life: life || 0.3 }, o);
      it.age = -(it.delay || 0);
      this.items.push(it);
      return it;
    }
    slash(x, y, r, tint, life, o) { return this.spr(pick(r, [[62, 'slash_s'], [90, 'slash_m'], [999, 'slash_l']]), tint, x, y, life || 0.26, o); }
    rapier(x, y, r, tint, life, o) { return this.spr(r < 64 ? 'rapier_s' : 'rapier_m', tint, x, y, life || 0.22, o); }
    hit(x, y, pow, tint) { return this.spr(pick(pow, [[0.5, 'hit_s'], [1.4, 'hit_m'], [99, 'hit_l']]), tint, x, y, 0.24 + 0.04 * pow, { flip: Math.random() < 0.5, flipY: Math.random() < 0.5 }); }
    burst(x, y, big, tint, life) { return this.spr(big ? 'burst_l' : 'burst_m', tint, x, y, life || 0.5); }
    shock(x, y, r, tint, life, delay) { return this.spr(pick(r, [[58, 'shock_s'], [100, 'shock_m'], [150, 'shock_l'], [999, 'shock_xl']]), tint, x, y, life || 0.4, { under: true, delay }); }
    pillar(x, y, w, tint, life) { return this.spr(w < 36 ? 'pillar_s' : 'pillar_l', tint, x, y, life || 0.45, { pillar: true }); }
    glint(x, y, r, tint, life) { return this.spr(pick(r, [[22, 'glint_s'], [30, 'glint_m'], [999, 'glint_l']]), tint, x, y, life || 0.25); }
    thrust(x0, y, x1, tint, life) { const len = Math.abs(x1 - x0); return this.spr(pick(len, [[130, 'thrust_s'], [260, 'thrust_m'], [9999, 'thrust_l']]), tint, (x0 + x1) / 2, y, life || 0.2, { flip: x1 < x0 }); }
    cut(x, y, flip, tint, life) { return this.spr('cut', tint, x, y, life || 0.75, { flip }); }
    charge(x, y, tint, life) { return this.spr('charge', tint, x, y, life || 0.3); }
    land(x, y, big, tint) { return this.spr(big ? 'dust_l' : 'dust_s', tint || 'dust', x, y, big ? 0.6 : 0.45); }
    flash(a, col) { this.flashA = Math.max(this.flashA, a); this.flashCol = col || '#fff'; }
    // Pop-up text in screen space. o: s scale, c colour, o outline, life, g gradient, rise
    text(str, x, y, o) { this.texts.push(Object.assign({ str, x, y, age: 0, life: 0.9, s: 2 }, o)); }

    // A small sprite with its own motion. o: vx, vy, g, drag, floor, life, spin (frames a second), spark
    bit(name, tint, x, y, o) { const b = Object.assign({ name, tint, x, y, vx: 0, vy: 0, life: 0.5, age: 0, ph: Math.random() * 4 }, o); this.bits.push(b); return b; }
    scatter(n, x, y, o, make) {
      for (let i = 0; i < n; i++) {
        const a = (o.a0 !== undefined ? o.a0 : 0) + Math.random() * (o.spread !== undefined ? o.spread : Math.PI * 2);
        const sp = (o.sp || 60) * rnd(0.35, 1);
        make(Math.cos(a) * sp, Math.sin(a) * sp, (o.life || 0.5) * rnd(0.6, 1));
      }
    }
    sparks(x, y, n, tint, sp, life) {
      this.scatter(n, x, y, { sp: sp || 160, life: life || 0.35 }, (vx, vy, lf) => this.bit('spark', Math.random() < 0.3 ? 'white' : tint, x, y, { vx, vy, life: lf, g: 240, drag: 2, spark: true }));
    }
    dust(x, y, n, tint) {
      const big = n >= 12;
      this.scatter(Math.ceil(n / 3), x, y, { sp: big ? 70 : 46, a0: Math.PI, spread: Math.PI, life: 0.62 }, (vx, vy, lf) => this.bit(big && Math.random() < 0.5 ? 'puff_c' : Math.random() < 0.5 ? 'puff_a' : 'puff_b', tint || 'dust', x + vx * 0.08, y - 3, { vx, vy: vy * 0.45, life: lf, drag: 3, flip: Math.random() < 0.5 }));
    }
    // Rubble that flies, falls and bounces. o: sp, life, g, a0, spread, floor, big
    debris(x, y, n, tint, o) {
      this.scatter(n, x, y, o, (vx, vy, lf) => this.bit('chunk' + ((Math.random() * (o.big ? 4 : 3)) | 0), tint || 'rock', x, y, { vx, vy, life: lf, g: o.g || 620, floor: o.floor, spin: rnd(8, 16) }));
    }
    petals(x, y, n, tints, sp) {
      this.scatter(n, x, y, { sp: sp || 300, life: 1.1 }, (vx, vy, lf) => this.bit('petal', tints[(Math.random() * tints.length) | 0], x, y, { vx, vy, life: lf, g: 160, drag: 2.4, spin: rnd(6, 11), flip: Math.random() < 0.5 }));
    }
    twinkle(x, y, tint, life) { return this.bit('twinkle', tint || 'white', x, y, { life: life || 0.5 }); }

    // Break a sprite frame into flying fragments.
    shatter(t, team, anim, i, x, y, scale, flip, dir) {
      const f = BC.frame(t, anim, i), img = A.img[BC.TEAMS[team].key + '_' + BC.PIECE[t]];
      if (!f || !img) return;
      const cols = 6, rows = Math.max(5, Math.round(6 * f[3] / f[2]));
      const cw = f[2] / cols, ch = f[3] / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const lx = (c + 0.5) * cw - f[4], ly = (r + 0.5) * ch - f[5];
        const wx = x + (flip ? -lx : lx) * scale, wy = y + ly * scale;
        const ang = Math.atan2(ly + f[3] * 0.5, lx) + (Math.random() - 0.5) * 0.9;
        const sp = 70 + Math.random() * 170;
        this.shards.push({
          img, sx: f[0] + c * cw, sy: f[1] + r * ch, sw: cw, sh: ch, x: wx, y: wy, floor: y + Math.random() * 6, flip,
          vx: Math.cos(ang) * sp + dir * (80 + Math.random() * 120), vy: Math.sin(ang) * sp - 120 - Math.random() * 120,
          rot: 0, vr: (Math.random() - 0.5) * 16, scale, age: 0, life: 1.3 + Math.random() * 0.7,
        });
      }
    }
    ghost(t, team, anim, i, x, y, o, life) { this.ghosts.push({ t, team, anim, i, x, y, o: Object.assign({}, o), age: 0, life: life || 0.25 }); }
    update(dt, real) {
      this.flashA = Math.max(0, this.flashA - (real === undefined ? dt : real) * 4.5);
      for (const list of [this.items, this.texts, this.ghosts]) {
        for (let i = list.length - 1; i >= 0; i--) { list[i].age += dt; if (list[i].age >= list[i].life) list.splice(i, 1); }
      }
      for (let i = this.bits.length - 1; i >= 0; i--) {
        const b = this.bits[i];
        b.age += dt;
        if (b.age >= b.life) { this.bits.splice(i, 1); continue; }
        if (b.g) b.vy += b.g * dt;
        if (b.drag) { const k = Math.max(0, 1 - b.drag * dt); b.vx *= k; b.vy *= k; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.floor !== undefined && b.y > b.floor) { b.y = b.floor; b.vy *= -0.4; b.vx *= 0.6; if (b.spin) b.spin *= 0.6; }
      }
      for (let i = this.shards.length - 1; i >= 0; i--) {
        const s = this.shards[i];
        s.age += dt;
        if (s.age >= s.life) { this.shards.splice(i, 1); continue; }
        s.vy += 720 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
        if (s.y > s.floor) { s.y = s.floor; s.vy *= -0.36; s.vx *= 0.55; s.vr *= 0.5; if (Math.abs(s.vy) < 30) { s.vy = 0; s.vr = 0; } }
      }
    }
    drawItem(ctx, it) {
      if (it.age < 0) return;
      const fr = BC.fxAnim(it.name, it.tint);
      if (!fr) return;
      const i = Math.min(fr.length - 1, (it.age / it.life * fr.length) | 0);
      BC.drawFx(ctx, it.name, it.tint, i, it.x, it.y, it);
      const f = fr[i];
      if (it.pillar && f[6]) {
        // the column runs on up out of the screen: repeat the top of the drawing above itself
        const th = Math.floor(f[3] * 0.4), x = Math.round(it.x) - f[4], top = Math.round(it.y) - f[5];
        ctx.imageSmoothingEnabled = false;
        for (let n = 1; n <= Math.ceil(700 / th); n++) ctx.drawImage(A.img.fx, f[0], f[1], f[2], th, x, top - n * th, f[2], th);
      }
    }
    // Effects that lie on the floor: call before the pieces standing on it are drawn.
    drawUnder(ctx) { for (const it of this.items) if (it.under) this.drawItem(ctx, it); }
    drawWorld(ctx) {
      for (const g of this.ghosts) BC.drawSprite(ctx, g.t, g.team, g.anim, g.i, g.x, g.y, Object.assign({}, g.o, { alpha: 0.5 * (1 - g.age / g.life), white: 0.6 }));
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      for (const s of this.shards) {
        ctx.save();
        ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.scale((s.flip ? -1 : 1) * s.scale, s.scale);
        ctx.globalAlpha = Math.min(1, (s.life - s.age) * 3);
        ctx.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, -s.sw / 2, -s.sh / 2, s.sw, s.sh);
        ctx.restore();
      }
      ctx.restore();
      for (const it of this.items) if (!it.under) this.drawItem(ctx, it);
      for (const b of this.bits) {
        const k = b.age / b.life;
        if (b.spark) {
          const d = SPARK[Math.round(Math.atan2(b.vy, b.vx) / (Math.PI / 4)) & 7];
          BC.drawFx(ctx, 'spark_' + d[0], b.tint, k * 4, b.x, b.y, { flip: d[1], flipY: d[2] });
        } else {
          const n = BC.fxAnim(b.name, b.tint).length;
          BC.drawFx(ctx, b.name, b.tint, b.spin ? (b.age * b.spin + b.ph) % n : k * n, b.x, b.y, { flip: b.flip, alpha: b.spin && k > 0.8 ? (1 - k) * 5 : 1 });
        }
      }
    }
    drawScreen(ctx) {
      for (const t of this.texts) {
        const k = t.age / t.life, pop = t.age < 0.12 ? 1 + (1 - t.age / 0.12) * 0.9 : 1;
        const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
        ctx.save();
        ctx.translate(Math.round(t.x), Math.round(t.y - (t.rise || 0) * k));
        if (t.rot) ctx.rotate(t.rot);
        ctx.scale(pop, pop);
        ctx.globalAlpha = a;
        if (t.img) { ctx.imageSmoothingEnabled = false; ctx.drawImage(t.img, -t.img.width * t.s / 2, -t.img.height * t.s / 2, t.img.width * t.s, t.img.height * t.s); ctx.restore(); continue; }
        BC.text(ctx, t.str, 0, -3.5 * t.s, { a: 'c', s: t.s, c: t.c || '#fff', o: t.o || '#1a0c16', g: t.g });
        ctx.restore();
      }
      if (this.flashA > 0.01) { ctx.globalAlpha = Math.min(1, this.flashA); ctx.fillStyle = this.flashCol; ctx.fillRect(0, 0, 960, 540); ctx.globalAlpha = 1; }
    }
  }
  BC.Fx = Fx;

  // A red seal stamp with one character, rendered chunky like a pixel hanko.
  const stamps = {};
  BC.stamp = function (ch) {
    if (stamps[ch]) return stamps[ch];
    const m = BC.mk(30, 30), c = m.ctx;
    c.fillStyle = '#d0202c'; c.fillRect(0, 0, 30, 30);
    c.clearRect(2, 2, 26, 26); c.fillStyle = '#d0202c';
    c.font = 'bold 23px "Hiragino Mincho ProN","Yu Mincho","Songti SC","Noto Serif CJK JP",serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(ch, 15, 16);
    stamps[ch] = m.cv;
    return m.cv;
  };
})();
