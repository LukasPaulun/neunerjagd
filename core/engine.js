/* Spiel-Laufzeit: besitzt Spielschleife, Overlay (Start/Pause/Ende), Pause-Knopf,
   Bestleistung. Das Spiel liefert nur Logik und Zeichnung (siehe ARCHITEKTUR.md). */
import { VW, VH, HUD, resetTransform } from './stage.js';
import { C } from './theme.js';
import { vibrate } from './util.js';
import * as store from './store.js';
import * as audio from './audio.js';

/* Titel zur Punktzahl aus def.titles = [[minScore, 'Titel'], …] (aufsteigend). */
export function rankTitle(def, score) {
  let t = '';
  for (const [min, name] of def.titles || []) if (score >= min) t = name;
  return t;
}

/* Geschützte Leerzeichen, damit Zahl und Wort nicht getrennt umbrechen („+9“, „−18“, „3 Leben“). */
const NB = '\u00a0';
export function nobreak(s) {
  return String(s)
    .replace(/ (?=[+−-]?\d)/g, NB)                                   // Wort +9 / Wort 18
    .replace(/(\d[\d.,]*\s?%?) (?=[A-Za-zÄÖÜäöüß(])/g, (m, a) => a + NB); // 3 Leben, 90 Sekunden
}
const END_DELAY = 800;   // ms: Knopf am Ende nimmt erst danach Eingaben an (wer noch tippt, startet nicht versehentlich neu)

/* sh = { ctx, ov: {root, t, p, r, btn, best}, pauseB }  ->  Bildschirm-Objekt für main.js */
export function mountGame(def, sh) {
  const { ctx, ov, pauseB } = sh;
  let state = 'intro', last = 0, raf = 0, frames = 0, inst = null;
  /* Ton: Polka je Spiel leicht anders transponiert; Tempo steigt mit der Spielzeit,
     bis das Spiel selbst api.audio.setIntensity() aufruft. */
  const tonart = [0, 2, -2, 3, -3][[...def.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 5];
  let playT = 0, ownIntensity = false, btnT = 0;

  const bestLine = () => { const b = store.getBest(def.id).score; ov.best.textContent = b ? `Bestleistung auf diesem Gerät: ${b}` : ''; };
  const setRules = lines => {
    ov.r.replaceChildren();
    (lines || []).forEach((l, i) => { if (i) ov.r.append(document.createElement('br')); ov.r.append(nobreak(l)); });
    ov.r.hidden = !lines || !lines.length;
  };
  const showOverlay = (title, text, rules, btn, delay = 0) => {
    ov.t.textContent = title; ov.p.textContent = nobreak(text); setRules(rules); ov.btn.textContent = btn;
    clearTimeout(btnT); ov.btn.disabled = delay > 0;
    if (delay > 0) btnT = setTimeout(() => { ov.btn.disabled = false; }, delay);
    pauseB.hidden = true; ov.root.hidden = false;
  };

  function paint() { if (!C.bg || !inst) return; resetTransform(); inst.draw(ctx); }

  function loop(ts) {
    if (state !== 'play') return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    inst.step(dt); frames++; playT += dt;
    if (!ownIntensity) audio.setIntensity(playT / 90);
    paint();
    raf = requestAnimationFrame(loop);
  }
  function run() { state = 'play'; ov.root.hidden = true; pauseB.hidden = false; last = performance.now(); raf = requestAnimationFrame(loop); }
  function start() {
    inst.reset(); playT = 0; audio.setIntensity(0);
    audio.playMusic('polka', { tonart, restart: true, place: def.id });
    run();
  }
  function pause() {
    if (state !== 'play') return;
    state = 'pause'; cancelAnimationFrame(raf); audio.pauseMusic();
    showOverlay('Pause', def.pauseText || 'Das Spiel ruht. Der Stammtisch wartet.', null, 'Weiter');
  }
  function end(res = {}) {
    if (state !== 'play') return;
    state = 'over'; cancelAnimationFrame(raf);
    const score = Math.round(res.score || 0);
    const title = res.title || rankTitle(def, score) || def.name;
    const rekord = store.setBest(def.id, score, title);
    audio.stopMusic(); audio.sfx(rekord ? 'tusch' : 'traurig');
    showOverlay(title, res.text || `${score} Punkte.`, null, def.againLabel || 'Nochmal', END_DELAY);
    bestLine(); paint();
  }

  const api = {
    id: def.id, VW, VH, HUD, C, ctx,
    end, pause, vibrate,
    get state() { return state; },
    requestDraw: paint,
    best: () => store.getBest(def.id),
    sfx: (name, opts) => audio.sfx(name, opts),
    audio: {
      sfx: (name, opts) => audio.sfx(name, opts),
      setIntensity: x => { ownIntensity = true; audio.setIntensity(x); },
    },
    load: (key, fallback) => store.load(def.id, key, fallback),
    save: (key, value) => store.save(def.id, key, value),
  };
  inst = def.create(api);
  inst.reset();
  audio.setIntensity(0); audio.playMusic('polka', { tonart, place: def.id });
  showOverlay(def.name, def.intro || '', def.rules, def.startLabel || 'Start');
  bestLine();
  paint();

  return {
    kind: 'spiel', def,
    draw: paint,
    onPointer(ev) { if (state === 'play' && inst.onPointer) inst.onPointer(ev); },
    onButton() { if (ov.btn.disabled) return; if (state === 'pause') { audio.resumeMusic(); run(); } else if (state !== 'play') start(); },
    onPause: pause,
    onHidden: pause,
    unmount() { clearTimeout(btnT); ov.btn.disabled = false; audio.stopMusic(); state = 'dead'; cancelAnimationFrame(raf); pauseB.hidden = true; ov.root.hidden = true; try { inst.destroy && inst.destroy(); } catch (e) { console.error(e); } },
    /* nur für Tests */
    debug: {
      get state() { return state; }, get frames() { return frames; }, test: def.test || {},
      forceEnd() { if (state !== 'play') return; if (inst.forceEnd) inst.forceEnd(); if (state === 'play') end({ score: 0, text: 'Testabbruch.' }); },
    },
  };
}
