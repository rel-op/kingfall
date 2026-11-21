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

  // ---------- effects ----------
  class Fx {
    constructor() { this.parts = new BC.Parts(); this.items = []; this.texts = []; this.shards = []; this.ghosts = []; this.flashA = 0; this.flashCol = '#fff'; }
    add(o) { o.age = 0; this.items.push(o); return o; }
    arc(x, y, r, a0, a1, col, life, o) { return this.add(Object.assign({ k: 'arc', x, y, r, a0, a1, col, life: life || 0.2 }, o)); }
    beam(x, y, w, col, life) { return this.add({ k: 'beam', x, y, w, col, life: life || 0.4 }); }
    ring(x, y, r, col, life, flat) { return this.add({ k: 'ring', x, y, r, col, life: life || 0.4, flat: flat === undefined ? 0.36 : flat }); }
    line(x0, y0, x1, y1, col, life, w) { return this.add({ k: 'line', x: x0, y: y0, x1, y1, col, life: life || 0.3, w: w || 5 }); }
    star(x, y, r, col, life, n) { return this.add({ k: 'star', x, y, r, col, life: life || 0.4, n: n || 8 }); }
    glow(x, y, r, col, life) { return this.add({ k: 'glow', x, y, r, col, life: life || 0.3 }); }
    flash(a, col) { this.flashA = Math.max(this.flashA, a); this.flashCol = col || '#fff'; }
    // Pop-up text in screen space. o: s scale, c colour, o outline, life, g gradient, rise
    text(str, x, y, o) { this.texts.push(Object.assign({ str, x, y, age: 0, life: 0.9, s: 2 }, o)); }
    sparks(x, y, n, cols, sp, life) {
      this.parts.burst(x, y, n, { kind: 'spark', palette: cols, sp: sp || 160, life: life || 0.35, g: 240, drag: 2, s: 1, s2: 2, glow: true });
    }
    dust(x, y, n, col) {
      this.parts.burst(x, y, n, { kind: 'smoke', col: col || '#e8dcc8', sp: 46, life: 0.5, a0: Math.PI, spread: Math.PI, drag: 3, s: 2, s1: 9, al: 0.5 });
    }
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
      this.parts.update(dt);
      this.flashA = Math.max(0, this.flashA - (real === undefined ? dt : real) * 4.5);
      for (const list of [this.items, this.texts, this.ghosts]) {
        for (let i = list.length - 1; i >= 0; i--) { list[i].age += dt; if (list[i].age >= list[i].life) list.splice(i, 1); }
      }
      for (let i = this.shards.length - 1; i >= 0; i--) {
        const s = this.shards[i];
        s.age += dt;
        if (s.age >= s.life) { this.shards.splice(i, 1); continue; }
        s.vy += 720 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
        if (s.y > s.floor) { s.y = s.floor; s.vy *= -0.36; s.vx *= 0.55; s.vr *= 0.5; if (Math.abs(s.vy) < 30) { s.vy = 0; s.vr = 0; } }
      }
    }
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
      this.parts.draw(ctx);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.parts.a) {
        if (!p.glow) continue;
        ctx.globalAlpha = 0.35 * (1 - p.age / p.life);
        ctx.fillStyle = p.col || '#fff';
        ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 5, 5);
      }
      for (const it of this.items) {
        const k = it.age / it.life, a = 1 - k;
        ctx.globalAlpha = 1;
        if (it.k === 'arc') {
          const sw = Math.min(1, k * 3.2), ae = it.a0 + (it.a1 - it.a0) * sw, ccw = it.a1 < it.a0;
          const as = it.a0 + (it.a1 - it.a0) * Math.max(0, k * 1.6 - 0.6);
          if (Math.abs(ae - as) < 0.25) continue;
          const mid = (as + ae) / 2, th = it.th || 0.2;
          const g = ctx.createRadialGradient(it.x, it.y, it.r * 0.55, it.x, it.y, it.r);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, it.col); g.addColorStop(1, '#ffffff');
          ctx.globalAlpha = Math.min(1, a * 1.6);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(it.x, it.y, it.r, as, ae, ccw);
          ctx.arc(it.x - Math.cos(mid) * it.r * th, it.y - Math.sin(mid) * it.r * th, it.r * (1 - th * 0.35), ae, as, !ccw);
          ctx.closePath(); ctx.fill();
        } else if (it.k === 'beam') {
          const w = it.w * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85 * 0.7);
          const g = ctx.createLinearGradient(it.x - w, 0, it.x + w, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, it.col); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.7, it.col); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = Math.min(1, a * 1.8);
          ctx.fillStyle = g; ctx.fillRect(it.x - w, -400, w * 2, it.y + 400);
          const e = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, w * 2.2);
          e.addColorStop(0, '#ffffff'); e.addColorStop(0.4, it.col); e.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = e; ctx.save(); ctx.translate(it.x, it.y); ctx.scale(1, 0.4); ctx.translate(-it.x, -it.y); ctx.fillRect(it.x - w * 3, it.y - w * 3, w * 6, w * 6); ctx.restore();
        } else if (it.k === 'ring') {
          const r = it.r * BC.ease.out(k);
          ctx.globalAlpha = a; ctx.strokeStyle = it.col; ctx.lineWidth = Math.max(0.5, 5 * a);
          ctx.beginPath(); ctx.ellipse(it.x, it.y, r, r * it.flat, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = a * 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(0.5, 2 * a);
          ctx.beginPath(); ctx.ellipse(it.x, it.y, r * 0.8, r * 0.8 * it.flat, 0, 0, Math.PI * 2); ctx.stroke();
        } else if (it.k === 'line') {
          const grow = Math.min(1, k * 6);
          ctx.globalAlpha = Math.min(1, a * 2.5); ctx.strokeStyle = it.col; ctx.lineCap = 'round';
          ctx.lineWidth = it.w * (1 - k * 0.8);
          ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(it.x + (it.x1 - it.x) * grow, it.y + (it.y1 - it.y) * grow); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(0.5, it.w * 0.35 * (1 - k));
          ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(it.x + (it.x1 - it.x) * grow, it.y + (it.y1 - it.y) * grow); ctx.stroke();
        } else if (it.k === 'star') {
          const r = it.r * (0.3 + 0.7 * BC.ease.out(k));
          ctx.globalAlpha = a; ctx.fillStyle = it.col;
          ctx.beginPath();
          for (let i = 0; i < it.n * 2; i++) {
            const ang = (i / (it.n * 2)) * Math.PI * 2 + it.age * 1.5, rr = i % 2 ? r * 0.16 : r * (i % 4 ? 0.7 : 1);
            ctx.lineTo(it.x + Math.cos(ang) * rr, it.y + Math.sin(ang) * rr);
          }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(it.x, it.y, r * 0.2 * a, 0, 7); ctx.fill();
        } else if (it.k === 'glow') {
          const r = it.r * (0.6 + 0.4 * k), g = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, r);
          g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, it.col); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(it.x - r, it.y - r, r * 2, r * 2);
        }
      }
      ctx.restore();
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
