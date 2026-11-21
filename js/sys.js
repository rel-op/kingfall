// Input (mouse, keyboard, gamepads), audio, saves and options.
(function () {
  'use strict';
  const BC = window.BC;

  // ---------- options and saves (browser local storage) ----------
  const store = { get(k) { try { return JSON.parse(localStorage.getItem('kingfall.' + k)); } catch (e) { return null; } },
    put(k, v) { try { localStorage.setItem('kingfall.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem('kingfall.' + k); } catch (e) { /* storage unavailable */ } } };
  BC.save = store;
  BC.opts = Object.assign({ hints: true, fights: 'full', orient: 'side', music: 0.5, sfx: 0.8, bloom: true }, store.get('opts') || {});
  BC.saveOpts = () => store.put('opts', BC.opts);

  // ---------- audio ----------
  const AU = BC.audio = { ctx: null, buf: {}, log: [], cur: null, el: null, want: null };
  AU.unlock = function () {
    if (AU.ctx || !window.BC_SFX) { if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume(); if (AU.want && !AU.cur) AU.music(AU.want); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    AU.ctx = new Ctx(); AU.gain = AU.ctx.createGain(); AU.gain.connect(AU.ctx.destination); AU.volumes();
    for (const name in window.BC_SFX) {
      const bin = atob(window.BC_SFX[name]), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      AU.ctx.decodeAudioData(arr.buffer, (b) => { AU.buf[name] = b; }, () => {});
    }
    if (AU.want) AU.music(AU.want);
  };
  AU.volumes = function () { if (AU.gain) AU.gain.gain.value = BC.opts.sfx; if (AU.el) AU.el.volume = BC.opts.music * 0.7; };
  AU.sfx = function (name, vol, rate) {
    AU.log.push({ t: BC.now || 0, name, vol: vol === undefined ? 1 : vol });
    const b = AU.buf[name];
    if (!AU.ctx || !b || BC.manual) return;
    const s = AU.ctx.createBufferSource(), g = AU.ctx.createGain();
    s.buffer = b; s.playbackRate.value = rate || 0.96 + Math.random() * 0.08;
    g.gain.value = vol === undefined ? 1 : vol;
    s.connect(g); g.connect(AU.gain); s.start();
  };
  // key: one track, looped; or a list of tracks, each played AU.REPEAT times before the next takes over, starting on any one of them.
  AU.REPEAT = 3;
  AU.music = function (key) {
    const list = [].concat(key), id = list.join('+'), url = (n) => 'assets/music/' + list[n] + '.mp3';
    AU.want = key;
    AU.log.push({ t: BC.now || 0, music: id });
    if (!AU.ctx || BC.manual || AU.cur === id) return;
    if (AU.el) {
      const old = AU.el; let v = old.volume; old.onended = old.ontimeupdate = null;
      const f = setInterval(() => { v -= 0.05; if (v <= 0) { clearInterval(f); old.pause(); } else old.volume = v; }, 40);
    }
    AU.cur = id;
    let i = (Math.random() * list.length) | 0;
    const el = AU.el = new Audio(url(i));
    el.loop = list.length === 1; el.volume = BC.opts.music * 0.7; AU.track = list[i];
    if (list.length > 1) {
      // have the next track ready, so the hand-over has no wait
      const ready = () => { AU.next = new Audio(url((i + 1) % list.length)); AU.next.preload = 'auto'; };
      // the same player carries on with the next track: a phone lets a player that has already played start again by itself
      let busy = false;
      AU.plays = 1;
      const next = () => {
        if (busy || AU.el !== el) return;
        if (AU.plays < AU.REPEAT) { AU.plays++; el.currentTime = 0; }   // the same theme again, from the top
        else { AU.plays = 1; busy = true; i = (i + 1) % list.length; AU.track = list[i]; el.src = url(i); ready(); }
        el.volume = BC.opts.music * 0.7; el.play().catch(() => {});
      };
      el.onplaying = () => { busy = false; };
      el.onended = next;
      // some tracks stop dead at the end, so the last second is faded; and a browser that stalls just short of
      // the end never says the track ended, so the hand-over is made here too
      el.ontimeupdate = () => {
        const left = el.duration - el.currentTime;
        if (busy || !(left >= 0)) return;
        if (left < 0.3) next(); else el.volume = BC.opts.music * 0.7 * Math.min(1, left / 1.2);
      };
      ready();
    }
    el.play().catch(() => { AU.cur = null; });
  };

  // ---------- input ----------
  const IN = BC.input = { pads: [], q: [] };
  const emit = (ev) => { IN.q.push(ev); };
  IN.padCount = () => IN.pads.length;
  const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
  IN.init = function (canvas) {
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 960, y: (e.clientY - r.top) / r.height * 540 }; };
    window.addEventListener('keydown', (e) => {
      AU.unlock();
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (KEYS[k]) { emit({ type: 'dir', dx: KEYS[k][0], dy: KEYS[k][1] }); e.preventDefault(); }
      else if (k === 'Enter' || k === ' ') { emit({ type: 'ok' }); e.preventDefault(); }
      else if (k === 'Backspace' || k === 'x') emit({ type: 'back' });
      else if (k === 'Escape' || k === 'p') emit({ type: 'menu' });
      else if (k === 'h') emit({ type: 'hint' });
      else if (k === 't') emit({ type: 'tip' });
      else if (k === 'f') BC.fullscreen();
    });
    // Pointer events cover mouse, finger and pen alike. A finger has no hover, so it sends no 'move'.
    canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') emit(Object.assign({ type: 'move' }, pos(e))); });
    canvas.addEventListener('pointerdown', (e) => {
      AU.unlock();
      if (e.pointerType === 'touch') BC.touch = true;
      emit(Object.assign({ type: e.button === 2 ? 'back' : 'ok', mouse: true }, pos(e))); e.preventDefault();
    });
    // phones only let sound start as a finger lifts
    window.addEventListener('pointerup', () => AU.unlock());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  // Standard-mapping gamepads. With two connected, pad 1 is Sun and pad 2 is Moon.
  const held = {};
  IN.poll = function (dt) {
    const list = (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter((g) => g && g.connected);
    IN.pads = list;
    list.forEach((g, pad) => {
      const st = held[g.index] || (held[g.index] = { b: {}, dir: null, rep: 0 });
      const btn = (i, type) => {
        const down = !!(g.buttons[i] && g.buttons[i].pressed);
        if (down && !st.b[i]) { AU.unlock(); emit({ type, pad }); }
        st.b[i] = down;
      };
      btn(0, 'ok'); btn(1, 'back'); btn(2, 'hint'); btn(3, 'tip'); btn(9, 'menu'); btn(8, 'menu');
      const p = (i) => g.buttons[i] && g.buttons[i].pressed;
      let dx = (p(15) ? 1 : 0) - (p(14) ? 1 : 0), dy = (p(13) ? 1 : 0) - (p(12) ? 1 : 0);
      const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
      if (!dx && !dy) { if (Math.abs(ax) > 0.55 && Math.abs(ax) >= Math.abs(ay)) dx = Math.sign(ax); else if (Math.abs(ay) > 0.55) dy = Math.sign(ay); }
      const key = dx + ',' + dy;
      if (!dx && !dy) st.dir = null;
      else if (st.dir !== key) { st.dir = key; st.rep = 0.26; emit({ type: 'dir', dx, dy, pad }); }
      else if ((st.rep -= dt) <= 0) { st.rep = 0.1; emit({ type: 'dir', dx, dy, pad }); }
    });
  };
  BC.fullscreen = function () {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };
})();
