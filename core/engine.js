/* Spiel-Laufzeit: besitzt Spielschleife, Overlay (Start/Pause/Ende), Pause-Knopf,
   Bestleistung. Das Spiel liefert nur Logik und Zeichnung (siehe ARCHITEKTUR.md). */
import { VW, VH, HUD, resetTransform } from './stage.js';
import { C } from './theme.js';
import { vibrate } from './util.js';
import * as store from './store.js';

/* Titel zur Punktzahl aus def.titles = [[minScore, 'Titel'], …] (aufsteigend). */
export function rankTitle(def, score) {
  let t = '';
  for (const [min, name] of def.titles || []) if (score >= min) t = name;
  return t;
}

/* sh = { ctx, ov: {root, t, p, r, btn, best}, pauseB }  ->  Bildschirm-Objekt für main.js */
export function mountGame(def, sh) {
  const { ctx, ov, pauseB } = sh;
  let state = 'intro', last = 0, raf = 0, frames = 0, inst = null;

  const bestLine = () => { const b = store.getBest(def.id).score; ov.best.textContent = b ? `Bestleistung auf diesem Gerät: ${b}` : ''; };
  const setRules = lines => {
    ov.r.replaceChildren();
    (lines || []).forEach((l, i) => { if (i) ov.r.append(document.createElement('br')); ov.r.append(l); });
    ov.r.hidden = !lines || !lines.length;
  };
  const showOverlay = (title, text, rules, btn) => {
    ov.t.textContent = title; ov.p.textContent = text; setRules(rules); ov.btn.textContent = btn;
    pauseB.hidden = true; ov.root.hidden = false;
  };

  function paint() { if (!C.bg || !inst) return; resetTransform(); inst.draw(ctx); }

  function loop(ts) {
    if (state !== 'play') return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    inst.step(dt); frames++;
    paint();
    raf = requestAnimationFrame(loop);
  }
  function run() { state = 'play'; ov.root.hidden = true; pauseB.hidden = false; last = performance.now(); raf = requestAnimationFrame(loop); }
  function start() { inst.reset(); run(); }
  function pause() {
    if (state !== 'play') return;
    state = 'pause'; cancelAnimationFrame(raf);
    showOverlay('Pause', def.pauseText || 'Das Spiel ruht. Der Stammtisch wartet.', null, 'Weiter');
  }
  function end(res = {}) {
    if (state !== 'play') return;
    state = 'over'; cancelAnimationFrame(raf);
    const score = Math.round(res.score || 0);
    const title = res.title || rankTitle(def, score) || def.name;
    store.setBest(def.id, score, title);
    showOverlay(title, res.text || `${score} Punkte.`, null, def.againLabel || 'Nochmal');
    bestLine(); paint();
  }

  const api = {
    id: def.id, VW, VH, HUD, C, ctx,
    end, pause, vibrate,
    get state() { return state; },
    requestDraw: paint,
    best: () => store.getBest(def.id),
    load: (key, fallback) => store.load(def.id, key, fallback),
    save: (key, value) => store.save(def.id, key, value),
  };
  inst = def.create(api);
  inst.reset();
  showOverlay(def.name, def.intro || '', def.rules, def.startLabel || 'Start');
  bestLine();
  paint();

  return {
    kind: 'spiel', def,
    draw: paint,
    onPointer(ev) { if (state === 'play' && inst.onPointer) inst.onPointer(ev); },
    onButton() { if (state === 'pause') run(); else if (state !== 'play') start(); },
    onPause: pause,
    onHidden: pause,
    unmount() { state = 'dead'; cancelAnimationFrame(raf); pauseB.hidden = true; ov.root.hidden = true; try { inst.destroy && inst.destroy(); } catch (e) { console.error(e); } },
    /* nur für Tests */
    debug: {
      get state() { return state; }, get frames() { return frames; }, test: def.test || {},
      forceEnd() { if (state !== 'play') return; if (inst.forceEnd) inst.forceEnd(); if (state === 'play') end({ score: 0, text: 'Testabbruch.' }); },
    },
  };
}
