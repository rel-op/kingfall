// Installing the game as an app: offline support and the install offer.
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
  if (web && 'serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
})();
