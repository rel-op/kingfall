// Takedowns: when a piece is captured the camera pushes in and the attacker performs
// its signature combo on the board, fighting-game style. One routine per piece type.
(function () {
  'use strict';
  const BC = window.BC, V = BC.view;
  const SEAL = { p: '突', n: '駆', b: '聖', r: '砕', q: '華', k: '斬' };

  BC.takedown = async function (G, A, Vc, o) {
    const T = BC.TEAMS[A.c], fx = G.fx, sfx = BC.audio.sfx, home = { u: A.u, v: A.v };
    const dir = Math.sign(Vc.u - A.u) || (A.c === 0 ? 1 : -1);
    const quick = BC.opts.fights === 'quick';
    const pos = (p) => V.project(p.u, p.v + BC.FEET);
    const chest = (p) => { const q = pos(p); return { x: q.x, y: q.y - 44 * q.s - p.hop * 46 * q.s, s: q.s }; };
    const near = Vc.u - dir * 0.95, far = Vc.u - dir * 2.1;
    const ang = (a) => (dir > 0 ? a : Math.PI - a);
    G.fight = { a: A, v: Vc, rays: 0 }; G.combo = 0;
    if (quick) G.speed = Math.max(G.speed, 1.7);
    if (A.m < 7) await G.morph(A, 7);
    if (o.mate) { G.splash = { a: A, v: Vc, age: 0, life: 1.2 }; sfx('taiko'); await G.wait(1.1); }

    // approach, then push the camera in while the victim wakes up
    const start = A.t === 'p' || A.t === 'q' ? far : A.t === 'n' ? Vc.u - dir * 2.6 : A.t === 'b' ? Vc.u - dir * 1.9 : Vc.u - dir * 1.7;
    await G.walk(A, start, Vc.v, { jump: A.t === 'n' ? 0.9 : 0, speed: 10, trail: A.t === 'q' });
    A.flip = dir < 0; Vc.flip = dir > 0; Vc.mT = 7; Vc.anim = 'idle';
    sfx('zoom', 0.7); sfx('taiko', 0.9);
    const mid = pos(Vc), c0 = { x: G.cam.x, y: G.cam.y, z: G.cam.z };
    const c1 = { x: mid.x - dir * 34 * mid.s, y: mid.y - 46 * mid.s, z: Math.min(2.5, 1.95 / mid.s) };
    // keep the zoomed view inside the painted backdrop
    c1.x = BC.clamp(c1.x, 480 / c1.z - 20, 980 - 480 / c1.z); c1.y = BC.clamp(c1.y, 270 / c1.z - 10, 550 - 270 / c1.z);
    const camTo = (a, b, d) => G.tween(d, (k) => { G.cam.x = BC.lerp(a.x, b.x, k); G.cam.y = BC.lerp(a.y, b.y, k); G.cam.z = BC.lerp(a.z, b.z, k); G.dim = BC.lerp(a === c0 ? 0 : 0.62, b === c0 ? 0 : 0.62, k); G.bars = G.dim / 0.62; G.hudK = 1 - G.bars; }, BC.ease.io);
    await camTo(c0, c1, 0.3);
    await G.until(() => Vc.m === 7);

    const frames = async (from, to, d) => { A.anim = 'attack'; A.fi = from; await G.tween(d, (k) => { A.fi = Math.min(to, Math.floor(from + (to - from + 1) * k)); }); A.fi = to; };
    const hit = (pow, d) => {
      d = d || dir; G.combo++;
      const c = chest(Vc);
      Vc.anim = 'hit'; Vc.at = 0; Vc.white = Math.min(1, 0.35 + pow * 0.5);
      G.freeze = 0.05 + 0.035 * pow; G.shake(3 + 3.5 * pow);
      fx.sparks(c.x, c.y, 10 + pow * 8, ['#ffffff', T.glow, T.trim], 170 + pow * 60, 0.35);
      fx.ring(c.x, c.y, 22 + pow * 12, '#ffffff', 0.22, 0.9);
      fx.glow(c.x, c.y, 36 + pow * 18, T.trim, 0.2);
      sfx(pow >= 1.5 ? 'hit_heavy' : 'hit', 0.9);
      if (G.combo > 1) { fx.texts = fx.texts.filter((t) => !t.combo); fx.text(G.combo + ' HITS', 480, 84, { s: 3, g: ['#fff3a0', '#ff8a2a'], life: 0.8, combo: true }); }
      const u0 = Vc.u;
      G.tween(0.16, (k) => { Vc.u = u0 + d * 0.11 * pow * k; }, BC.ease.out);
    };
    const finish = async (d, drift, lift) => {
      d = d || dir; G.combo++;
      drift = drift === undefined ? 0.85 : drift; lift = lift || 0.9;
      const c = chest(Vc);
      G.freeze = 0.26; G.shake(12); fx.flash(0.85); G.fight.rays = 1;
      sfx('hit_heavy'); sfx('ko');
      Vc.m = 0; Vc.mT = 0; Vc.white = 1.6; // the blow turns it back to stone
      fx.sparks(c.x, c.y, 46, ['#ffffff', T.glow, T.trim, T.main], 320, 0.6);
      fx.star(c.x, c.y, 80, '#ffffff', 0.4, 8); fx.ring(c.x, c.y, 90, T.trim, 0.45, 0.9);
      G.slow = 0.4;
      const z0 = G.cam.z;
      G.tween(0.4, (k) => { G.cam.z = z0 * (1 + 0.09 * Math.sin(Math.PI * k)); });
      const u0 = Vc.u, h0 = Vc.hop;
      await G.tween(0.3, (k) => { Vc.u = u0 + d * drift * k; Vc.hop = h0 * (1 - k) + Math.sin(Math.PI * k) * lift; Vc.rot = d * k * 1.3; });
      G.slow = 1;
      const q = pos(Vc), st = BC.TEAMS[Vc.c].stone;
      fx.shatter(Vc.t, Vc.c, 'morph', 0, q.x, q.y, q.s, Vc.flip, d);
      Vc.hidden = true;
      fx.dust(q.x, q.y, 16, st[0]); fx.ring(q.x, q.y, 80, '#ffffff', 0.5);
      fx.parts.burst(q.x, q.y - 26, 34, { kind: 'sq', palette: st, sp: 240, life: 1.1, g: 620, s: 2, s2: 4, floor: q.y + 4, a0: Math.PI, spread: Math.PI });
      G.shake(9); fx.flash(0.35); sfx('shatter');
      fx.text(o.mate ? 'CHECKMATE' : 'SHATTERED', 480, 262, { s: o.mate ? 8 : 7, g: ['#ffffff', T.trim], o: T.ink, life: 1.25 });
      fx.texts.push({ img: BC.stamp(o.mate ? '詰' : SEAL[A.t]), x: 480 + (o.mate ? 318 : 262), y: 326, age: 0, life: 1.25, s: 3, rot: 0.14 });
      await G.wait(0.8);
      G.tween(0.3, (k) => { if (G.fight) G.fight.rays = 1 - k; });
    };
    const slashArc = (r, a0, a1, col, life, at) => { const c = at || chest(Vc); fx.arc(c.x - dir * 14, c.y, r, ang(a0), ang(a1), col || '#ffffff', life || 0.2); };

    // ---------------- signature routines ----------------
    if (A.t === 'p') {
      await G.walk(A, near, Vc.v, { speed: 13 }); A.flip = dir < 0;
      for (let i = 0; i < 3; i++) {
        sfx('thrust', 0.8); await frames(2, 4, 0.08);
        const c = chest(Vc); fx.line(c.x - dir * 60, c.y + (i - 1) * 6, c.x + dir * 22, c.y + (i - 1) * 6, T.trim, 0.14, 4);
        hit(0.6); await frames(5, 6, 0.07);
      }
      const u0 = A.u;
      await G.tween(0.14, (k) => { A.u = u0 - dir * 0.75 * k; A.hop = Math.sin(Math.PI * k) * 0.3; });
      A.hop = 0; sfx('charge', 0.5);
      const cA = chest(A); fx.star(cA.x + dir * 30, cA.y, 22, T.glow, 0.3, 4);
      await frames(1, 2, 0.24);
      sfx('slash_big'); A.fi = 4;
      const u1 = A.u, c = chest(Vc);
      fx.line(c.x - dir * 150, c.y, c.x + dir * 190, c.y, '#ffffff', 0.32, 9);
      await G.tween(0.12, (k) => { A.u = u1 + dir * 2.7 * k; G.ghostOf(A); }, BC.ease.out);
      await finish(-dir, 0.25, 1.4);
    } else if (A.t === 'n') {
      sfx('neigh', 0.8);
      await frames(1, 2, 0.3); await G.wait(0.14);
      sfx('gallop', 0.9); A.anim = 'move'; A.at = 0;
      const u0 = A.u; let struck = false;
      await G.tween(0.36, (k) => {
        A.u = u0 + dir * 4.9 * k; G.ghostOf(A);
        if (!struck && k > 0.5) { struck = true; hit(1.6); const c = chest(Vc); fx.line(c.x - dir * 90, c.y, c.x + dir * 90, c.y - 10, T.trim, 0.2, 7); }
      });
      A.flip = !A.flip; await G.wait(0.12);
      sfx('gallop', 0.9); A.anim = 'attack'; A.fi = 4;
      const u1 = A.u;
      await G.tween(0.17, (k) => { A.u = u1 - dir * 2.3 * k; G.ghostOf(A); });
      const u2 = A.u, c = chest(Vc);
      fx.line(c.x + dir * 170, c.y, c.x - dir * 150, c.y, '#ffffff', 0.3, 10); sfx('slash_big', 0.8);
      G.tween(0.34, (k) => { A.u = u2 - dir * 2.4 * k; }, BC.ease.out);
      await finish(-dir);
      A.flip = dir < 0;
    } else if (A.t === 'b') {
      const cast = async (w, pow, pre) => {
        sfx('charge', 0.6);
        const cA = chest(A); fx.glow(cA.x + dir * 8, cA.y - 46 * cA.s, 34, T.glow, pre);
        fx.parts.burst(cA.x + dir * 8, cA.y - 46, 12, { kind: 'star', col: T.glow, sp: 40, life: pre, s: 3, glow: true });
        await frames(1, 2, pre);
        await frames(3, 4, 0.09);
        const g = pos(Vc); fx.beam(g.x, g.y, w, T.glow, 0.45); fx.ring(g.x, g.y, w * 2.4, T.trim, 0.4); sfx('holy', 0.9);
      };
      await cast(22, 1.2, 0.26); hit(1.2); await frames(5, 6, 0.16);
      await cast(22, 1.2, 0.14); hit(1.2); await frames(5, 5, 0.12);
      const g = pos(Vc);
      fx.ring(g.x, g.y, 60, T.glow, 0.55); G.wait(0.14).then(() => fx.ring(g.x, g.y, 80, T.trim, 0.5));
      const d0 = G.dim; G.tween(0.4, (k) => { G.dim = BC.lerp(d0, 0.86, k); });
      sfx('charge'); await frames(1, 2, 0.5);
      fx.star(g.x, g.y - 150, 30, '#ffffff', 0.25, 4);
      await frames(3, 4, 0.08);
      fx.beam(g.x, g.y, 54, T.glow, 0.7); fx.ring(g.x, g.y, 190, '#ffffff', 0.6); sfx('holy');
      G.dim = 0.62;
      await finish();
    } else if (A.t === 'r') {
      const step = () => { G.shake(5); sfx('stomp', 0.9); const q = pos(A); fx.dust(q.x, q.y, 8); fx.ring(q.x, q.y, 40, '#ffffff', 0.3); };
      A.anim = 'move'; A.at = 0;
      const u0 = A.u; let n = 0;
      await G.tween(0.5, (k) => { A.u = BC.lerp(u0, near - dir * 0.15, k); if (k > (n + 1) * 0.33) { n++; step(); } });
      await frames(0, 2, 0.4);
      sfx('smash'); await frames(3, 4, 0.08);
      const q = pos(Vc);
      fx.ring(q.x - dir * 30, q.y, 120, T.trim, 0.5); fx.ring(q.x - dir * 30, q.y, 70, '#ffffff', 0.35); fx.dust(q.x - dir * 20, q.y, 18);
      fx.parts.burst(q.x - dir * 20, q.y, 24, { kind: 'sq', palette: ['#8a7a6a', '#c8b8a0', '#5a4a40'], sp: 260, life: 0.9, g: 700, s: 2, s2: 4, a0: Math.PI * 1.15, spread: Math.PI * 0.7, floor: q.y + 4 });
      hit(2.0); G.shake(11);
      const launch = G.tween(0.56, (k) => { Vc.hop = Math.sin(Math.PI * k) * 1.5; Vc.rot = -dir * Math.sin(Math.PI * k) * 0.5; });
      await frames(5, 6, 0.2);
      await frames(1, 2, 0.2);
      await launch; Vc.rot = 0;
      sfx('smash'); await frames(3, 4, 0.07);
      fx.ring(q.x, q.y, 170, '#ffffff', 0.55); fx.ring(q.x, q.y, 110, T.trim, 0.5);
      for (let i = -2; i <= 2; i++) fx.parts.burst(q.x + i * 22, q.y, 8, { kind: 'sq', palette: ['#8a7a6a', '#c8b8a0', '#5a4a40'], sp: 330, life: 1, g: 760, s: 3, s2: 5, a0: -Math.PI / 2 - 0.25, spread: 0.5, floor: q.y + 4 });
      await finish();
    } else if (A.t === 'q') {
      const cols = [T.trim, '#ffffff', T.light, T.glow];
      const blink = (u) => { let c = chest(A); fx.star(c.x, c.y, 34, T.glow, 0.22, 4); G.ghostOf(A); A.u = u; A.flip = !A.flip; c = chest(A); fx.star(c.x, c.y, 26, '#ffffff', 0.2, 4); sfx('dash', 0.7); };
      sfx('dash'); await G.walk(A, near, Vc.v, { speed: 22, trail: true }); A.flip = dir < 0;
      sfx('slash', 0.9); await frames(1, 3, 0.1); fx.line(chest(Vc).x - dir * 70, chest(Vc).y, chest(Vc).x + dir * 30, chest(Vc).y - 4, cols[0], 0.16, 5); hit(0.7);
      sfx('slash', 0.9); await frames(4, 5, 0.1); slashArc(74, -2.3, 0.7, cols[2], 0.2); hit(0.8);
      blink(Vc.u + dir * 0.95);
      sfx('slash', 0.9); await frames(2, 3, 0.07); fx.line(chest(Vc).x + dir * 70, chest(Vc).y, chest(Vc).x - dir * 30, chest(Vc).y, cols[3], 0.16, 5); hit(0.7, -dir);
      await frames(4, 5, 0.09); fx.arc(chest(Vc).x + dir * 14, chest(Vc).y, 74, ang(Math.PI + 2.3), ang(Math.PI - 0.7), cols[0], 0.2); hit(0.8, -dir);
      blink(Vc.u - dir * 0.95);
      sfx('flurry');
      for (let i = 0; i < 6; i++) {
        A.anim = 'attack'; A.fi = i % 2 ? 5 : 3;
        const a = -2.4 + Math.random() * 1.2, c = chest(Vc);
        fx.arc(c.x + (Math.random() - 0.5) * 20, c.y + (Math.random() - 0.5) * 24, 46 + Math.random() * 34, ang(a), ang(a + 2.2 + Math.random()), cols[i % 4], 0.16);
        hit(0.35); await G.wait(0.065);
      }
      A.fi = 6; await G.wait(0.1); A.fi = 7; await G.wait(0.22);
      const c = chest(Vc);
      sfx('burst'); fx.star(c.x, c.y, 130, T.glow, 0.5, 10); fx.star(c.x, c.y, 80, '#ffffff', 0.35, 6); fx.ring(c.x, c.y, 150, T.trim, 0.5, 0.9);
      fx.parts.burst(c.x, c.y, 40, { kind: 'petal', palette: [T.main, T.trim, '#ffffff', T.light], sp: 300, life: 1.1, g: 160, drag: 2.4 });
      await finish();
    } else {
      A.anim = 'move'; A.at = 0;
      const u0 = A.u;
      await G.tween(0.34, (k) => { A.u = BC.lerp(u0, near, k); });
      const tip = () => { const c = chest(A); return { x: c.x + dir * 8 * c.s, y: c.y - 64 * c.s }; };
      await frames(0, 2, 0.3);
      let s = tip(); fx.star(s.x, s.y, 20, '#ffffff', 0.25, 4);
      sfx('slash_big', 0.9); await frames(3, 5, 0.1);
      slashArc(104, -2.2, 0.9, T.trim, 0.26); hit(2.0);
      await frames(6, 7, 0.26);
      // the royal cut: one pass, a held breath, then the blow lands
      const d0 = G.dim; G.tween(0.25, (k) => { G.dim = BC.lerp(d0, 0.88, k); });
      sfx('charge', 0.7); await frames(1, 2, 0.34);
      s = tip(); fx.star(s.x, s.y, 34, '#ffffff', 0.3, 4); await G.wait(0.12);
      sfx('slash_big'); A.fi = 5;
      const u1 = A.u, c = chest(Vc);
      fx.line(c.x - dir * 260, c.y - 110, c.x + dir * 260, c.y + 90, '#ffffff', 0.75, 6); fx.flash(0.5);
      await G.tween(0.08, (k) => { A.u = u1 + dir * 2.3 * k; G.ghostOf(A); });
      Vc.anim = 'hit'; Vc.at = 0.2; A.fi = 6;
      await G.wait(0.42);
      A.fi = 7; G.dim = 0.62;
      await finish();
    }

    // pull back out and take the square
    A.anim = 'idle'; A.at = 0;
    const cNow = { x: G.cam.x, y: G.cam.y, z: G.cam.z };
    await G.tween(0.3, (k) => { G.cam.x = BC.lerp(cNow.x, 480, k); G.cam.y = BC.lerp(cNow.y, 270, k); G.cam.z = BC.lerp(cNow.z, 1, k); G.dim = 0.62 * (1 - k); G.bars = 1 - k; G.hudK = k; }, BC.ease.io);
    G.fight = null; G.dim = 0; G.bars = 0; G.hudK = 1;
    const dest = o.to || home;
    await G.walk(A, dest.u, dest.v, { speed: 12, jump: A.t === 'n' ? 0.9 : 0 });
    A.flip = A.c === 1;
    if (o.mate) await G.morph(A, 0);
  };
})();
