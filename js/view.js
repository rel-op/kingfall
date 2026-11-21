// Assets, the perspective board projection, and the three arenas.
(function () {
  'use strict';
  const BC = window.BC;

  // ---------- assets ----------
  const A = BC.assets = { img: {}, white: {}, total: 0, done: 0 };
  const PIECE = BC.PIECE = { p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king' };
  BC.PIECE_NAMES = { p: 'PAWN', n: 'KNIGHT', b: 'BISHOP', r: 'ROOK', q: 'QUEEN', k: 'KING' };
  BC.TEAMS = [
    { key: 'sun', name: 'SUN', full: 'SUN KINGDOM', main: '#f2432f', dark: '#8f1a26', light: '#ff9a6a', trim: '#ffd23e', glow: '#ffe9a0', ink: '#2a0d16', stone: ['#f6ecd6', '#d6c4a2', '#9c8468'] },
    { key: 'moon', name: 'MOON', full: 'MOON KINGDOM', main: '#3f6dff', dark: '#1c2a8a', light: '#8fb8ff', trim: '#48e8d8', glow: '#b8fff6', ink: '#0b0a22', stone: ['#8b93c9', '#5c63a1', '#383c70'] },
  ];
  function loadImg(name, src) {
    A.total++;
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => { A.img[name] = im; A.done++; res(im); };
      im.onerror = () => { A.done++; res(null); };
      im.src = src;
    });
  }
  BC.loadAssets = function () {
    const jobs = [];
    for (const team of ['sun', 'moon']) for (const k in PIECE) {
      jobs.push(loadImg(team + '_' + PIECE[k], `assets/sprites/${team}_${PIECE[k]}.png`).then((im) => {
        if (!im) return;
        // A pure white copy of each sheet, for hit flashes.
        const m = BC.mk(im.width, im.height);
        m.ctx.drawImage(im, 0, 0);
        m.ctx.globalCompositeOperation = 'source-in';
        m.ctx.fillStyle = '#fff'; m.ctx.fillRect(0, 0, im.width, im.height);
        A.white[team + '_' + PIECE[k]] = m.cv;
      }));
      jobs.push(loadImg('face_' + team + '_' + PIECE[k], `assets/portraits/${team}_${PIECE[k]}.png`));
    }
    for (const e of BC.ENVS) { jobs.push(loadImg('bg_' + e.key, `assets/bg/${e.key}_board.png`)); jobs.push(loadImg('stage_' + e.key, `assets/bg/${e.key}_battle.png`)); }
    jobs.push(loadImg('logo', 'assets/logo.png'));
    jobs.push(loadImg('fx', 'assets/fx.png'));
    return Promise.all(jobs);
  };

  // ---------- projection: a board lying flat, seen from the long side ----------
  // Board space: u runs left to right (0..8), v runs far to near (0..8).
  const V = BC.view = { cx: 480, yNear: 506, yFar: 150, sFar: 0.8, TW: 64, orient: 'side' };
  const kk = () => 1 / V.sFar - 1;
  const yh = () => (V.yFar - V.yNear * V.sFar) / (1 - V.sFar);
  V.sAt = (v) => 1 / (1 + kk() * (8 - v) / 8);
  V.project = (u, v) => { const s = V.sAt(v), h = yh(); return { x: V.cx + (u - 4) * V.TW * s, y: h + (V.yNear - h) * s, s }; };
  V.unproject = (x, y) => {
    const h = yh(), s = (y - h) / (V.yNear - h);
    return { u: 4 + (x - V.cx) / (V.TW * s), v: 8 - (1 / s - 1) * 8 / kk() };
  };
  // Side-on: the Sun army (white) starts on the left, the a-file is the far row.
  V.sqUV = (sq) => (V.orient === 'side' ? { u: 7 - (sq >> 3) + 0.5, v: (sq & 7) + 0.5 } : { u: (sq & 7) + 0.5, v: (sq >> 3) + 0.5 });
  V.uvSq = (u, v) => {
    const cu = Math.floor(u), cv = Math.floor(v);
    if (cu < 0 || cu > 7 || cv < 0 || cv > 7) return -1;
    return V.orient === 'side' ? (7 - cu) * 8 + cv : cv * 8 + cu;
  };
  V.quad = (ctx, u0, v0, u1, v1) => {
    const a = V.project(u0, v0), b = V.project(u1, v0), c = V.project(u1, v1), d = V.project(u0, v1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
  };

  // ---------- arenas ----------
  BC.ENVS = [
    {
      key: 'sakura', name: 'SAKURA KEEP', tag: 'SPRING MORNING AT THE CASTLE',
      light: ['#f3c2c6', '#e2a1ab', '#fde0dd', '#d48b98'], dark: ['#4e9c84', '#3b7f6e', '#6cb89c', '#2f6a5e'],
      frame: ['#b3262e', '#e2553f', '#6f1320', '#ffd23e'], sky: '#ffe9d2', shade: 'rgba(40,10,40,0.16)',
      grade: ['rgba(255,214,170,0.10)', 'rgba(60,20,70,0.30)'], accent: '#ff9ec0',
    },
    {
      key: 'ember', name: 'EMBER FORGE', tag: 'NIGHT ABOVE THE VOLCANO',
      light: ['#dd9550', '#c2713a', '#f6bd72', '#a85a30'], dark: ['#6a2636', '#521a2a', '#853445', '#3e1220'],
      frame: ['#2a1c26', '#57404c', '#120a12', '#ff8a2a'], sky: '#ff7a30', shade: 'rgba(0,0,0,0.1)',
      grade: ['rgba(255,110,30,0.13)', 'rgba(20,0,10,0.46)'], accent: '#ffb347',
    },
    {
      key: 'frost', name: 'FROSTMOON ABBEY', tag: 'MIDNIGHT ON THE FROZEN LAKE',
      light: ['#b7dcf0', '#93c2e2', '#e2f6ff', '#7aaed4'], dark: ['#4a6cbc', '#3855a0', '#6a8cd8', '#2b4386'],
      frame: ['#c9d8ec', '#ffffff', '#7f93b8', '#48e8d8'], sky: '#9fe8ff', shade: 'rgba(4,8,40,0.12)',
      grade: ['rgba(120,170,255,0.12)', 'rgba(6,8,50,0.44)'], accent: '#b8fff6',
    },
  ];

  // Smooth value noise for marble.
  function noiseFn(seed) {
    const r = BC.rng(seed), tab = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) tab[i] = r();
    const h = (x, y) => tab[((x * 73) ^ (y * 151) ^ (x * y * 7)) & 4095];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }

  const N = 64, M = 30, TEX = N * 8 + M * 2;
  // The board as a flat pixel texture: stone squares with veins, bevels and a small inlay.
  function boardTexture(env, seed) {
    const m = BC.mk(TEX, TEX), ctx = m.ctx, img = ctx.createImageData(TEX, TEX), d = img.data;
    const n1 = noiseFn(seed), n2 = noiseFn(seed + 7), rnd = BC.rng(seed + 3);
    const L = env.light.map(BC.rgb), D = env.dark.map(BC.rgb), F = env.frame.map(BC.rgb);
    const jit = []; for (let i = 0; i < 64; i++) jit.push(rnd() * 0.16 - 0.08);
    const put = (x, y, c, k) => { const o = (y * TEX + x) * 4; d[o] = c[0] * k; d[o + 1] = c[1] * k; d[o + 2] = c[2] * k; d[o + 3] = 255; };
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const bx = x - M, by = y - M;
      if (bx < 0 || by < 0 || bx >= N * 8 || by >= N * 8) {
        // frame: lacquered rail with a bevel, a trim line and studs
        const e = Math.min(x, y, TEX - 1 - x, TEX - 1 - y), inner = M - 1 - e;
        let c = F[0], k = 1 + (n1(x / 30, y / 6) - 0.5) * 0.14;
        if (e < 2) c = F[2]; else if (e < 4) c = F[1];
        else if (inner < 2) c = F[2]; else if (inner < 4) c = F[1];
        else if (e === 14 || e === 15) c = F[3];
        const along = (x < M || x >= TEX - M) ? y : x;
        if (e >= 9 && e <= 20 && ((along - M + 3200) % N) >= 29 && ((along - M + 3200) % N) <= 34 && Math.abs(e - 14.5) + Math.abs(((along - M + 3200) % N) - 31.5) < 5) c = F[3];
        put(x, y, c, k);
        continue;
      }
      const tu = (bx / N) | 0, tv = (by / N) | 0, lx = bx % N, ly = by % N;
      const sq = V.orient === 'side' ? (7 - tu) * 8 + tv : tv * 8 + tu;
      const isDark = (((sq >> 3) + (sq & 7)) & 1) === 1;
      const P = isDark ? D : L;
      const a = n1(bx / 26 + tu * 3.1, by / 26 + tv * 1.7) * 0.65 + n2(bx / 9, by / 9) * 0.35;
      let c = a < 0.36 ? P[1] : a > 0.66 ? P[2] : P[0];
      const vein = Math.abs(n2(bx / 34 + 9, by / 34 + 4) - 0.5);
      if (vein < 0.018) c = P[3]; else if (vein < 0.03 && a > 0.5) c = P[2];
      const e = Math.min(lx, ly, N - 1 - lx, N - 1 - ly);
      if (lx === 0 || ly === 0) c = P[2]; else if (lx === N - 1 || ly === N - 1) c = P[3];
      else if (e === 1) c = (lx === 1 || ly === 1) ? P[2] : P[1];
      const dm = Math.abs(lx - 31.5) + Math.abs(ly - 31.5);
      if (dm > 12.5 && dm < 14.5) c = P[isDark ? 2 : 1]; else if (dm < 3) c = P[isDark ? 2 : 3];
      if ((lx < 4 || lx > N - 5) && (ly < 4 || ly > N - 5) && e >= 2) c = P[3];
      put(x, y, c, 1 + jit[tv * 8 + tu]);
    }
    ctx.putImageData(img, 0, 0);
    const big = BC.mk(TEX * 2, TEX * 2);
    big.ctx.drawImage(m.cv, 0, 0, TEX * 2, TEX * 2);
    return big.cv;
  }

  // Project the texture onto the screen one scanline at a time (a classic floor mapper), at full HD.
  const boardCache = {};
  BC.boardCanvas = function (env) {
    const key = env.key + V.orient;
    if (boardCache[key]) return boardCache[key];
    const tex = boardTexture(env, env.key.length * 977 + 11);
    const out = BC.mk(1920, 1080), ctx = out.ctx;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const mg = M / N, top = V.project(0, -mg), bot = V.project(0, 8 + mg);
    const L0 = V.project(-mg, 8 + mg), R0 = V.project(8 + mg, 8 + mg), Lt = V.project(-mg, -mg), Rt = V.project(8 + mg, -mg);
    // soft contact shadow under the slab
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.moveTo(Lt.x * 2, Lt.y * 2); ctx.lineTo(Rt.x * 2, Rt.y * 2); ctx.lineTo(R0.x * 2, R0.y * 2 + 30); ctx.lineTo(L0.x * 2, L0.y * 2 + 30); ctx.closePath(); ctx.fill();
    ctx.restore();
    // front face of the slab
    const fh = 34, g = ctx.createLinearGradient(0, bot.y * 2, 0, bot.y * 2 + fh);
    g.addColorStop(0, env.frame[2]); g.addColorStop(0.15, env.frame[0]); g.addColorStop(1, env.frame[2]);
    ctx.fillStyle = g; ctx.fillRect(L0.x * 2, bot.y * 2 - 1, (R0.x - L0.x) * 2, fh);
    ctx.fillStyle = env.frame[3]; ctx.fillRect(L0.x * 2, bot.y * 2 + 8, (R0.x - L0.x) * 2, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(L0.x * 2, bot.y * 2 + fh - 6, (R0.x - L0.x) * 2, 6);
    for (let Y = Math.floor(top.y * 2); Y < Math.ceil(bot.y * 2); Y++) {
      const p = V.unproject(V.cx, (Y + 0.5) / 2), s = V.sAt(p.v);
      const ty = Math.max(0, Math.min(TEX * 2 - 1, (p.v * N + M) * 2));
      const x0 = V.cx + (-mg - 4) * V.TW * s, w = (8 + mg * 2) * V.TW * s;
      ctx.drawImage(tex, 0, ty, TEX * 2, 1, x0 * 2, Y, w * 2, 1.2);
    }
    // depth shading: the far end sits a little in shadow, the near edge catches light
    const sh = ctx.createLinearGradient(0, top.y * 2, 0, bot.y * 2);
    sh.addColorStop(0, 'rgba(10,6,30,0.34)'); sh.addColorStop(0.55, 'rgba(10,6,30,0)'); sh.addColorStop(1, 'rgba(255,240,220,0.08)');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.moveTo(Lt.x * 2, Lt.y * 2); ctx.lineTo(Rt.x * 2, Rt.y * 2); ctx.lineTo(R0.x * 2, R0.y * 2); ctx.lineTo(L0.x * 2, L0.y * 2); ctx.closePath(); ctx.fill();
    boardCache[key] = out.cv;
    return out.cv;
  };

  // ---------- living atmosphere per arena ----------
  class Ambient {
    constructor(env) { this.env = env; this.p = new BC.Parts(); this.t = 0; this.acc = 0; for (let i = 0; i < 90; i++) this.update(0.1); }
    spawn() {
      const k = this.env.key, P = this.p;
      if (k === 'sakura') P.add({ kind: 'petal', x: Math.random() * 1100 - 100, y: -10, vx: 22 + Math.random() * 30, vy: 26 + Math.random() * 26, life: 14, sway: 26, swf: 1.5 + Math.random() * 2, ph: Math.random() * 6, col: ['#ffd0e0', '#ff9ec0', '#ffffff', '#ffb7d0'][(Math.random() * 4) | 0], z: Math.random() });
      else if (k === 'ember') P.add({ kind: 'sq', x: Math.random() * 960, y: 550, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 60, life: 5 + Math.random() * 4, sway: 22, swf: 2 + Math.random() * 3, ph: Math.random() * 6, cols: ['#fff3a0', '#ffb347', '#ff6a2a', '#a8232e', '#521a2a'], s: Math.random() < 0.3 ? 2 : 1, z: Math.random(), glow: true });
      else P.add({ kind: 'sq', x: Math.random() * 1100 - 100, y: -10, vx: 8 + Math.random() * 16, vy: 30 + Math.random() * 40, life: 14, sway: 14, swf: 1 + Math.random() * 2, ph: Math.random() * 6, col: Math.random() < 0.5 ? '#ffffff' : '#cfe9ff', s: Math.random() < 0.25 ? 2 : 1, z: Math.random() });
    }
    update(dt) {
      this.t += dt; this.acc += dt * (this.env.key === 'sakura' ? 7 : this.env.key === 'ember' ? 9 : 14);
      while (this.acc > 1) { this.acc--; this.spawn(); }
      this.p.update(dt);
    }
    // Soft light drawn over the scene: sun shafts, forge glow, or aurora.
    light(ctx) {
      const t = this.t, k = this.env.key;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (k === 'sakura') {
        for (let i = 0; i < 4; i++) {
          const x = 150 + i * 190 + Math.sin(t * 0.25 + i) * 30, a = 0.05 + 0.03 * Math.sin(t * 0.6 + i * 2);
          const g = ctx.createLinearGradient(x, 0, x - 160, 540);
          g.addColorStop(0, `rgba(255,236,190,${a * 1.6})`); g.addColorStop(1, 'rgba(255,236,190,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + 70, -10); ctx.lineTo(x - 90, 540); ctx.lineTo(x - 230, 540); ctx.closePath(); ctx.fill();
        }
      } else if (k === 'ember') {
        for (const [x, y, r] of [[60, 520, 300], [900, 520, 300], [480, 600, 420]]) {
          const a = 0.16 + 0.06 * Math.sin(t * 2.1 + x);
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(255,120,30,${a})`); g.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const y = 30 + i * 22 + Math.sin(t * 0.4 + i) * 8, a = 0.07 + 0.04 * Math.sin(t * 0.7 + i * 1.7);
          const g = ctx.createLinearGradient(0, y - 30, 0, y + 60);
          g.addColorStop(0, 'rgba(80,255,190,0)'); g.addColorStop(0.5, `rgba(${i === 1 ? '170,120,255' : '80,255,200'},${a})`); g.addColorStop(1, 'rgba(80,255,190,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(0, y - 30);
          for (let x = 0; x <= 960; x += 40) ctx.lineTo(x, y - 30 + Math.sin(x * 0.012 + t * 0.5 + i * 2) * 14);
          for (let x = 960; x >= 0; x -= 40) ctx.lineTo(x, y + 60 + Math.sin(x * 0.01 + t * 0.4 + i) * 18);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }
    // Flickering firelight painted onto the backdrop's own lanterns and braziers (backdrop pixel positions).
    fires(ctx) {
      const L = { sakura: [[118, 184, 26], [280, 141, 18], [428, 141, 18], [629, 141, 18], [763, 141, 18], [913, 376, 26]],
        ember: [[278, 96, 46], [689, 96, 46], [100, 312, 54], [873, 312, 54], [95, 150, 60], [845, 150, 40]] }[this.env.key];
      if (!L) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      L.forEach(([x, y, r], i) => {
        const wx = -24 + x * 1.05, wy = -14 + y * 1.05, f = 0.75 + 0.25 * Math.sin(this.t * (7 + i) + i * 2) * Math.sin(this.t * 3.1 + i);
        const g = ctx.createRadialGradient(wx, wy, 0, wx, wy, r * f);
        g.addColorStop(0, this.env.key === 'ember' ? 'rgba(255,170,60,0.55)' : 'rgba(255,220,150,0.5)'); g.addColorStop(1, 'rgba(255,120,30,0)');
        ctx.fillStyle = g; ctx.fillRect(wx - r, wy - r, r * 2, r * 2);
      });
      ctx.restore();
    }
    draw(ctx, front) {
      for (const q of this.p.a) {
        if ((q.z > 0.55) !== front) continue;
        const k = q.age / q.life;
        ctx.fillStyle = q.cols ? q.cols[Math.min(q.cols.length - 1, (k * q.cols.length) | 0)] : q.col;
        const s = (q.s || 1) * (front ? 2 : 1);
        if (q.kind === 'petal') {
          const f = ((q.age * 6 + q.ph) | 0) & 3;
          ctx.fillRect(q.x, q.y, f === 2 ? s : s * 2, f === 0 ? s : s * (f === 2 ? 2 : 1));
        } else ctx.fillRect(q.x, q.y, s, s);
        if (q.glow) { ctx.globalAlpha = 0.25 * (1 - k); ctx.fillRect(q.x - s, q.y - s, s * 3, s * 3); ctx.globalAlpha = 1; }
      }
    }
  }
  BC.Ambient = Ambient;
})();
