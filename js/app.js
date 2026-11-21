// Installing the game as an app: offline support, the install offer, and noticing a new version.
(function () {
  'use strict';
  const BC = window.BC, APP = BC.app = { prompt: null };
  // only a real web address can be installed, not a file opened from disk
  const web = location.protocol === 'https:' || (location.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname));
  // read once at load, before the F key can put an ordinary tab into full screen
  APP.installed = !!(window.matchMedia && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) || navigator.standalone === true;
  APP.ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Chrome, Edge and Android hand over an install prompt the page may raise once, from a tap
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); APP.prompt = e; });
  window.addEventListener('appinstalled', () => { APP.prompt = null; APP.installed = true; });
  // What the title menu should offer: 'prompt' (one tap), 'ios' (show the steps), or nothing.
  APP.offer = () => (APP.installed || !web ? null : APP.prompt ? 'prompt' : APP.ios ? 'ios' : null);
  APP.install = function () { const p = APP.prompt; APP.prompt = null; try { if (p) Promise.resolve(p.prompt()).catch(() => {}); } catch (e) { /* the browser withdrew the offer */ } };
  // True once a newer copy of the game has been saved while this one was running; a restart switches to it.
  APP.fresh = false;
  APP.restart = () => location.reload();
  if (web && 'serviceWorker' in navigator) {
    const sw = navigator.serviceWorker;
    // the offline script takes charge once on a first visit; any take-over after that is a new version
    let held = sw.controller ? 1 : 0;
    sw.addEventListener('controllerchange', () => { if (held++) APP.fresh = true; });
    window.addEventListener('load', () => {
      sw.register('sw.js').then((reg) => {
        // an installed app is put aside rather than closed, so look for a new version each time it comes back
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      }).catch(() => {});
    });
  }
})();
