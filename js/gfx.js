// Pixel-art toolkit: integer drawing primitives, bitmap font, particles.
(function () {
  'use strict';
  const BC = window.BC = window.BC || {};
  BC.W = 640; BC.H = 360;

  BC.mk = function (w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { cv, ctx };
  };

  BC.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  BC.lerp = (a, b, t) => a + (b - a) * t;
  BC.ease = {
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: (t) => { const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };
  BC.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  BC.rgb = rgb;
  BC.mix = function (a, b, t) {
    const x = rgb(a), y = rgb(b);
    const h = (i) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0');
    return '#' + h(0) + h(1) + h(2);
  };

  // Painter: every shape lands on whole pixels, so nothing is ever anti-aliased.
  class G {
    constructor(ctx, ox, oy) { this.c = ctx; this.ox = ox || 0; this.oy = oy || 0; }
    r(x, y, w, h, col) {
      w = Math.round(w); h = Math.round(h);
      if (w <= 0 || h <= 0) return;
      this.c.fillStyle = col;
      this.c.fillRect(Math.round(x) + this.ox, Math.round(y) + this.oy, w, h);
    }
    p(x, y, col) { this.r(x, y, 1, 1, col); }
    e(cx, cy, rx, ry, col) {
      cx = Math.round(cx); cy = Math.round(cy); rx = Math.round(rx); ry = Math.round(ry);
      this.c.fillStyle = col;
      for (let dy = -ry; dy <= ry; dy++) {
        const k = dy / (ry + 0.5);
        const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - k * k)));
        this.c.fillRect(cx - hw + this.ox, cy + dy + this.oy, hw * 2 + 1, 1);
      }
    }
    l(x0, y0, x1, y1, col, th) {
      th = th || 1;
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const off = Math.floor(th / 2);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      this.c.fillStyle = col;
      for (let i = 0; i < 400; i++) {
        this.c.fillRect(x0 - off + this.ox, y0 - off + this.oy, th, th);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    poly(pts, col) {
      let minY = Infinity, maxY = -Infinity;
      for (const q of pts) { minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); }
      minY = Math.floor(minY); maxY = Math.ceil(maxY);
      this.c.fillStyle = col;
      for (let y = minY; y < maxY; y++) {
        const yc = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
            xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
          }
        }
        xs.sort((p, q) => p - q);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          const xa = Math.round(xs[i]), xb = Math.round(xs[i + 1]);
          this.c.fillRect(xa + this.ox, y + this.oy, Math.max(1, xb - xa), 1);
        }
      }
    }
    ring(cx, cy, r, col, th) {
      cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r); th = th || 1;
      this.c.fillStyle = col;
      for (let k = 0; k < th; k++) {
        const rr = r - k;
        if (rr < 1) break;
        let x = rr, y = 0, err = 1 - rr;
        while (x >= y) {
          for (const [px, py] of [[x, y], [y, x], [-x, y], [-y, x], [x, -y], [y, -x], [-x, -y], [-y, -x]]) {
            this.c.fillRect(cx + px + this.ox, cy + py + this.oy, 1, 1);
          }
          y++;
          if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
        }
      }
    }
  }
  BC.G = G;

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  BC.bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

  // Vertical gradient in hard colour bands with ordered dithering between them.
  BC.ditherGrad = function (ctx, x, y, w, h, cols) {
    const img = ctx.createImageData(w, h), d = img.data;
    const c = cols.map(rgb), n = cols.length - 1;
    for (let j = 0; j < h; j++) {
      const t = (j / Math.max(1, h - 1)) * n;
      const i0 = Math.min(n - 1, Math.floor(t)), fr = t - i0;
      for (let i = 0; i < w; i++) {
        const q = fr > BC.bayer(i, j) ? c[i0 + 1] : c[i0];
        const o = (j * w + i) * 4;
        d[o] = q[0]; d[o + 1] = q[1]; d[o + 2] = q[2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, x, y);
  };

  // ---- 5x7 bitmap font (ASCII 32..95, five column bytes per glyph, bit 0 at the top) ----
  const FONT = '0000000000' + '00005F0000' + '0007000700' + '147F147F14' + '242A7F2A12' + '2313086462' + '3649552250' +
    '0005030000' + '001C224100' + '0041221C00' + '14083E0814' + '08083E0808' + '0050300000' + '0808080808' + '0060600000' +
    '2010080402' + '3E5149453E' + '00427F4000' + '4261514946' + '2141454B31' + '1814127F10' + '2745454539' + '3C4A494930' +
    '0171090503' + '3649494936' + '064949291E' + '0036360000' + '0056360000' + '0814224100' + '1414141414' + '0041221408' +
    '0201510906' + '324979413E' + '7E1111117E' + '7F49494936' + '3E41414122' + '7F4141221C' + '7F49494941' + '7F09090901' +
    '3E4149497A' + '7F0808087F' + '00417F4100' + '2040413F01' + '7F08142241' + '7F40404040' + '7F020C027F' + '7F0408107F' +
    '3E4141413E' + '7F09090906' + '3E4151215E' + '7F09192946' + '4649494931' + '01017F0101' + '3F4040403F' + '1F2040201F' +
    '3F4038403F' + '6314081463' + '0708700807' + '6151494543' + '007F414100' + '0204081020' + '0041417F00' + '0402010204' +
    '4040404040';
  function glyph(ch) {
    let i = ch.charCodeAt(0) - 32;
    if (i < 0 || i > 63) i = 31;
    const out = [];
    for (let k = 0; k < 5; k++) out.push(parseInt(FONT.substr(i * 10 + k * 2, 2), 16));
    return out;
  }
  const tcache = new Map();
  function textCanvas(str, col, outline, grad) {
    const key = str + '|' + col + '|' + (outline || '') + '|' + (grad ? grad.join() : '');
    let cv = tcache.get(key);
    if (cv) return cv;
    if (tcache.size > 800) tcache.clear();
    const m = BC.mk(str.length * 6 + 2, 9), c = m.ctx;
    const rows = grad ? [0, 1, 2, 3, 4, 5, 6].map((y) => BC.mix(grad[0], grad[1], y / 6)) : null;
    const plot = (ox, oy, color) => {
      for (let i = 0; i < str.length; i++) {
        const gl = glyph(str[i]);
        for (let x = 0; x < 5; x++) for (let y = 0; y < 7; y++) {
          if (gl[x] & (1 << y)) {
            c.fillStyle = color || rows[y];
            c.fillRect(1 + i * 6 + x + ox, 1 + y + oy, 1, 1);
          }
        }
      }
    };
    if (outline) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) plot(dx, dy, outline);
    plot(0, 0, grad ? null : col);
    tcache.set(key, m.cv);
    return m.cv;
  }
  BC.textW = (str, s) => (String(str).length * 6 - 1) * (s || 1);
  // opt: c colour, s scale, a align (l/c/r), o outline colour, sh shadow colour, g [top,bottom] gradient
  BC.text = function (ctx, str, x, y, opt) {
    opt = opt || {};
    str = String(str).toUpperCase();
    const s = opt.s || 1, w = BC.textW(str, s);
    const x0 = Math.round(opt.a === 'c' ? x - w / 2 : opt.a === 'r' ? x - w : x), y0 = Math.round(y);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (opt.sh) {
      const sc = textCanvas(str, opt.sh, null, null);
      ctx.drawImage(sc, 0, 0, sc.width, sc.height, x0, y0, sc.width * s, sc.height * s);
    }
    const cv = textCanvas(str, opt.c || '#ffffff', opt.o, opt.g);
    ctx.drawImage(cv, 0, 0, cv.width, cv.height, x0 - s, y0 - s, cv.width * s, cv.height * s);
    ctx.imageSmoothingEnabled = smooth;
    return w;
  };

  // ---- particles ----
  class Parts {
    constructor() { this.a = []; }
    add(o) {
      o.age = 0; o.life = o.life || 1; o.vx = o.vx || 0; o.vy = o.vy || 0; o.s = o.s || 1; o.kind = o.kind || 'sq';
      this.a.push(o);
      return o;
    }
    burst(x, y, n, o) {
      for (let i = 0; i < n; i++) {
        const a = (o.a0 !== undefined ? o.a0 : 0) + Math.random() * (o.spread !== undefined ? o.spread : Math.PI * 2);
        const sp = (o.sp || 60) * (0.35 + Math.random() * 0.65);
        const cols = o.palette;
        this.add(Object.assign({}, o, {
          x: x + (Math.random() - 0.5) * (o.jx || 0), y: y + (Math.random() - 0.5) * (o.jy || 0),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: (o.life || 0.5) * (0.6 + Math.random() * 0.4),
          col: cols ? cols[(Math.random() * cols.length) | 0] : o.col,
          s: o.s2 ? o.s + ((Math.random() * (o.s2 - o.s + 1)) | 0) : o.s,
        }));
      }
    }
    update(dt) {
      const a = this.a;
      for (let i = a.length - 1; i >= 0; i--) {
        const p = a[i];
        p.age += dt;
        if (p.age >= p.life) { a[i] = a[a.length - 1]; a.pop(); continue; }
        if (p.g) p.vy += p.g * dt;
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.sway) p.x += Math.sin(p.age * (p.swf || 3) + (p.ph || 0)) * p.sway * dt;
        if (p.floor !== undefined && p.y > p.floor) { p.y = p.floor; p.vy *= -0.4; p.vx *= 0.6; }
      }
    }
    draw(ctx) {
      for (const p of this.a) {
        const k = p.age / p.life;
        ctx.fillStyle = p.cols ? p.cols[Math.min(p.cols.length - 1, (k * p.cols.length) | 0)] : p.col;
        const x = Math.round(p.x), y = Math.round(p.y);
        const s = p.shrink ? Math.max(1, Math.round(p.s * (1 - k))) : p.s;
        if (p.kind === 'sq') ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s);
        else if (p.kind === 'spark') {
          for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(p.x - p.vx * 0.012 * i), Math.round(p.y - p.vy * 0.012 * i), s, s);
        } else if (p.kind === 'petal') {
          const f = ((p.age * 7 + (p.ph || 0)) | 0) & 3;
          if (f === 0) ctx.fillRect(x, y, 2, 1);
          else if (f === 1) { ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1); }
          else if (f === 2) ctx.fillRect(x, y, 1, 2);
          else { ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y + 1, 1, 1); }
        } else if (p.kind === 'star') {
          const q = Math.max(0, Math.round(s * Math.sin(Math.PI * k)));
          ctx.fillRect(x - q, y, q * 2 + 1, 1); ctx.fillRect(x, y - q, 1, q * 2 + 1);
        } else if (p.kind === 'ring') {
          const g = new G(ctx, 0, 0);
          g.ring(x, y, p.r0 + (p.r1 - p.r0) * BC.ease.out(k), ctx.fillStyle, k > 0.6 ? 1 : p.th || 2);
        } else if (p.kind === 'smoke') {
          const q = Math.round(p.s + (p.s1 - p.s) * k);
          ctx.globalAlpha = (1 - k) * (p.al || 0.6);
          ctx.fillRect(x - (q >> 1), y - (q >> 1), q, q);
          ctx.globalAlpha = 1;
        }
      }
    }
  }
  BC.Parts = Parts;
})();
