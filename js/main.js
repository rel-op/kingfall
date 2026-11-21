// Boot, the frame loop, scene switching and the glow pass.
(function () {
  'use strict';
  const BC = window.BC;
  const canvas = BC.canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  BC.now = 0;

  function fit() {
    const s = Math.min(window.innerWidth / 16, window.innerHeight / 9);
    canvas.style.width = Math.floor(s * 16) + 'px'; canvas.style.height = Math.floor(s * 9) + 'px';
    BC.compact = s * 16 < 780;   // phone-sized: menus are drawn larger
  }
  window.addEventListener('resize', fit); window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  fit();

  // Soft glow: a blurred, contrast-boosted copy of the frame added back over itself.
  let bl = null;
  const canFilter = 'filter' in CanvasRenderingContext2D.prototype;
  BC.bloom = function (c) {
    if (!BC.opts.bloom || !canFilter) return;
    if (!bl) bl = BC.mk(480, 270);
    const b = bl.ctx;
    b.imageSmoothingEnabled = true;
    b.globalCompositeOperation = 'copy';
    b.filter = 'blur(5px) contrast(1.7) brightness(0.72)';
    b.drawImage(canvas, 0, 0, 480, 270);
    b.filter = 'none';
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.3; c.imageSmoothingEnabled = true;
    c.drawImage(bl.cv, 0, 0, 960, 540);
    c.restore();
  };

  // Lower-third caption, used by the trailer and for big announcements.
  BC.cap = null;
  BC.caption = (str, sub, life) => { BC.cap = { str, sub, age: 0, life: life || 3 }; };
  function drawCaption() {
    const c = BC.cap, k = c.age / c.life, inn = BC.ease.out(Math.min(1, c.age / 0.25)), a = k > 0.86 ? 1 - (k - 0.86) / 0.14 : 1;
    ctx.save(); ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, 0, 960, 0);
    g.addColorStop(0, 'rgba(8,4,16,0.92)'); g.addColorStop(0.62, 'rgba(8,4,16,0.8)'); g.addColorStop(1, 'rgba(8,4,16,0)');
    ctx.fillStyle = g; ctx.fillRect(-960 * (1 - inn), 418, 960, c.sub ? 76 : 58);
    ctx.fillStyle = '#f2432f'; ctx.fillRect(-960 * (1 - inn), 418, 700, 3);
    ctx.fillStyle = '#ffd23e'; ctx.fillRect(-960 * (1 - inn), 423, 520, 1);
    BC.text(ctx, c.str, 44 - 80 * (1 - inn), 432, { s: 4, g: ['#fff8d0', '#ffb62e'], o: '#2a0d16' });
    if (c.sub) BC.text(ctx, c.sub, 46 - 80 * (1 - inn), 470, { s: 2, c: '#e8dcf4', o: '#05030a' });
    ctx.restore();
  }

  let fade = 1, next = null;
  BC.fadeTo = (v) => { fade = v; };
  BC.go = function (scene) { if (!BC.scene || BC.manual) { BC.scene = scene; fade = BC.manual ? 0 : 1; } else next = scene; };

  function update(dt) {
    BC.now += dt; BC.ui.t += dt;
    if (BC.cap && (BC.cap.age += dt) >= BC.cap.life) BC.cap = null;
    if (BC.fadeOut) fade = Math.min(1, fade + dt * BC.fadeOut);
    BC.input.poll(dt);
    const q = BC.input.q; BC.input.q = [];
    for (const ev of q) { if (BC.ui.stack.length) BC.ui.input(ev); else if (BC.scene) BC.scene.input(ev); }
    if (next) { fade += dt * 4; if (fade >= 1) { BC.scene = next; next = null; } } else if (fade > 0 && !BC.fadeOut) fade = Math.max(0, fade - dt * 3);
    if (BC.scene && !(BC.ui.stack.length && (BC.scene.mode === 'play' || BC.scene.mode === 'think'))) BC.scene.update(dt);
  }
  function draw() {
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (BC.scene) BC.scene.draw(ctx);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    BC.ui.draw(ctx);
    if (BC.cap) drawCaption();
    if (fade > 0.01) { ctx.fillStyle = `rgba(5,3,10,${Math.min(1, fade)})`; ctx.fillRect(0, 0, 960, 540); }
  }
  // Fixed-step entry point so recordings are frame-exact.
  BC.tick = function (dt) { update(dt); draw(); };

  let last = 0;
  function loop(ts) {
    if (!BC.manual) { const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts; BC.tick(dt); }
    requestAnimationFrame(loop);
  }

  ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.fillStyle = '#07050c'; ctx.fillRect(0, 0, 960, 540);
  BC.text(ctx, 'KINGFALL', 480, 240, { a: 'c', s: 6, c: '#ffd23e' });
  BC.text(ctx, 'LOADING', 480, 300, { a: 'c', s: 2, c: '#cfc0e0' });
  BC.view.orient = BC.opts.orient;
  BC.input.init(canvas);
  const q = new URLSearchParams(location.search);
  BC.manual = q.has('manual');
  BC.loadAssets().then(() => {
    if (q.has('game')) BC.go(new BC.Game({ env: +(q.get('env') || 0), clock: +(q.get('clock') || 0), fen: q.get('fen'),
      // for testing: ai=1..16 picks the opponent, you=moon swaps sides, coach=0..2
      ai: q.has('ai') ? { level: +q.get('ai') || 3, side: q.get('you') === 'moon' ? 0 : 1, coach: q.has('coach') ? +q.get('coach') : 2 } : null }));
    else BC.go(new BC.Title());
    BC.ready = true;
    requestAnimationFrame(loop);
  });
})();
