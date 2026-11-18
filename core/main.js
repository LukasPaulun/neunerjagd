/* Einstieg: Bühne, Eingabe, Routing zwischen Hub (Menü/Oberwelt) und Spielen. */
import { VW, VH, initStage, resetTransform } from './stage.js';
import { C, onThemeChange } from './theme.js';
import { attachInput } from './input.js';
import { mountGame, rankTitle } from './engine.js';
import * as store from './store.js';
import * as audio from './audio.js';
import { parse, onRoute, go, validId } from './router.js';
import REGISTRY from '../games/registry.js';
import hubModule from './oberwelt.js';   // Hub: Oberwelt (Stammtischdorf)
import listModule from './menu.js';      // Ersatz-Hub als Liste: #/liste (Fehlersuche, Barrierefreiheit)

const $ = id => document.getElementById(id);
const sh = {
  ov: { root: $('ov'), t: $('ov-t'), p: $('ov-p'), r: $('ov-r'), btn: $('start'), best: $('best') },
  pauseB: $('pauseB'),
};
const titleEl = $('title'), eyebrow = $('eyebrow'), back = $('back'), hubEl = $('hub');

let current = null;            // aktueller Bildschirm {draw, onPointer, onButton?, onPause?, onHidden?, unmount, debug?}
let token = 0;
let lastKind = '';             // Art des vorigen Bildschirms ('spiel' -> Oberwelt stellt den Vogel vor die Station)
const redraw = () => { if (current && C.bg) { resetTransform(); current.draw(sh.ctx); } };

sh.ctx = initStage($('stage'), $('cv'), redraw);
onThemeChange(redraw);
try { document.fonts && document.fonts.ready.then(redraw); } catch (e) {}
attachInput($('cv'), ev => current && current.onPointer && current.onPointer(ev));

/* Start-/Weiter-Knopf: click und touchend, gegen Doppelauslösung entprellt */
let trig = 0;
const press = e => { if (e && e.cancelable && e.type === 'touchend') e.preventDefault(); const n = Date.now(); if (n - trig < 500) return; trig = n; current && current.onButton && current.onButton(); };
sh.ov.btn.addEventListener('click', press);
sh.ov.btn.addEventListener('touchend', press, { passive: false });
sh.pauseB.addEventListener('click', () => current && current.onPause && current.onPause());
document.addEventListener('visibilitychange', () => { if (document.hidden && current && current.onHidden) current.onHidden(); });
document.addEventListener('gesturestart', e => e.preventDefault());

/* Ton: Lautsprecher-Knopf in der Kopfzeile (alles an -> nur Effekte -> aus), Tipp-Geräusch für DOM-Knöpfe */
const TON = {
  an: ['Ton an', 'Ton: alles an. Tippen für: nur Effekte', '<path d="M3 9.5h4l5-4v13l-5-4H3z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'],
  effekte: ['Nur Effekte', 'Ton: nur Effekte, Musik aus. Tippen für: Ton aus', '<path d="M9 17.5V6l10-2v11.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor"/><circle cx="16.5" cy="15.5" r="2.5" fill="currentColor"/><path d="M3.5 3.5l17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'],
  aus: ['Ton aus', 'Ton: aus. Tippen für: alles an', '<path d="M3 9.5h4l5-4v13l-5-4H3z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'],
};
const tonB = $('ton'), tonL = $('ton-lbl');
let tonT = 0;
function showTon(m, flash) {
  const [lbl, aria, svg] = TON[m];
  tonB.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>`;
  tonB.dataset.mode = m; tonB.setAttribute('aria-label', aria); tonB.title = lbl;
  if (flash) { tonL.textContent = lbl; tonL.hidden = false; clearTimeout(tonT); tonT = setTimeout(() => { tonL.hidden = true; }, 1400); }
}
showTon(audio.getMode(), false);
tonB.addEventListener('click', () => { audio.unlock(); showTon(audio.cycleMode(), true); audio.sfx('tap'); });
document.addEventListener('pointerdown', e => {
  const b = e.target && e.target.closest && e.target.closest('button, a');
  if (b && b !== tonB) audio.sfx('tap');
}, { capture: true, passive: true });

/* Spiele laden: registry.js liefert ids, Module werden einzeln importiert, damit ein
   kaputtes Spiel nicht die ganze Sammlung lahmlegt. */
const games = new Map();
async function loadGame(id) {
  if (games.has(id)) return games.get(id);
  const mod = await import(`../games/${id}.js`);
  const def = mod.default;
  if (!def || def.id !== id || typeof def.create !== 'function') throw new Error(`Spiel "${id}": ungültiger Export (id/create)`);
  games.set(id, def);
  return def;
}
const ready = Promise.all(REGISTRY.map(id => loadGame(id).catch(err => { console.error(`Spiel "${id}" nicht ladbar:`, err); return null; })));

function setHeader(title, inGame) {
  titleEl.textContent = title; document.title = title;
  eyebrow.hidden = inGame; back.hidden = !inGame;
}

async function route(r) {
  const my = ++token;
  if (current) { lastKind = current.kind; current.unmount(); current = null; }
  await ready;
  if (my !== token) return;
  if (r.view === 'spiel') {
    let def = null;
    try { def = await loadGame(r.id); } catch (e) { console.error(e); }
    if (my !== token) return;
    if (!def) { go('#/'); return; }
    store.setLast(def.id);
    setHeader(def.name, true);
    current = mountGame(def, sh);
  } else {
    setHeader('Der Stammtisch', !!r.liste);
    audio.playMusic('dorf');
    sh.ov.root.hidden = true; sh.pauseB.hidden = true;
    const list = REGISTRY.map(id => games.get(id)).filter(Boolean).map(d => {
      const b = store.getBest(d.id);
      return { id: d.id, name: d.name, station: d.station, best: { score: b.score, title: b.title || rankTitle(d, b.score) } };
    });
    let raf = 0;
    const mod = r.liste ? listModule : hubModule;
    const scr = mod.mount({
      el: hubEl, games: list, from: store.getLast(), fromGame: lastKind === 'spiel', ctx: sh.ctx, C, VW, VH,
      open: id => go('#/spiel/' + id),
      /* Schleife für animierte Hubs: fn(dt) wird pro Frame aufgerufen, danach gezeichnet. */
      loop(fn) { let last = performance.now(); const f = ts => { const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; fn(dt); redraw(); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); },
    });
    current = { kind: 'hub', hub: r.liste ? 'liste' : 'oberwelt', hubDebug: scr.debug || null, draw: c => scr.draw(c), onPointer: ev => scr.onPointer && scr.onPointer(ev), unmount: () => { cancelAnimationFrame(raf); scr.unmount(); } };
  }
  redraw();
}

/* Test-Hook (tests/smoke.py) */
window.__stammtisch = {
  get view() { return current ? current.kind : 'laden'; },
  get hub() { return current && current.kind === 'hub' ? current.hubDebug : null; },
  get hubName() { return current && current.kind === 'hub' ? current.hub : null; },
  get gameId() { return current && current.def ? current.def.id : null; },
  get state() { return current && current.debug ? current.debug.state : null; },
  get frames() { return current && current.debug ? current.debug.frames : 0; },
  get test() { return current && current.debug ? current.debug.test : {}; },
  forceEnd() { current && current.debug && current.debug.forceEnd(); },
  audio: audio.debug,
  ton: { cycle: () => audio.cycleMode(), get mode() { return audio.getMode(); } },
  registry: REGISTRY,
  ready,
};

onRoute(route);
route(parse());
