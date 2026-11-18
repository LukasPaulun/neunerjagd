/* Oberwelt (Hub): das Stammtischdorf. Der Neuntöter hüpft dorthin, wo man hintippt
   (Raster-A* mit Wegglättung), die Kamera folgt. Stationen kommen aus games/registry.js
   (hub.games) plus der Stationstabelle STATIONEN in oberwelt-welt.js.
   Schnittstelle wie core/menu.js: mount(hub) -> { draw(ctx), onPointer(ev), unmount(), debug }. */
import { neuntoeter } from './draw.js';
import { C } from './theme.js';
import * as store from './store.js';
import * as audio from './audio.js';
import { clamp, dist, pick } from './util.js';
import { WW, WH, START, STATIONEN, VEREINSHEIM, FELD, buildWorld, drawGround, schild, laufNeuner } from './oberwelt-welt.js';

const SPEED = 150;          // Welt-Einheiten pro Sekunde
const BIRD_R = 8;           // Kollisionsradius des Vogels
const CELL = 15;            // Rastergröße der Wegfindung
const TRIGGER = 20;         // Radius des Eingangsbereichs vor einer Station
const KEY = 'oberwelt';     // Speicher: stammtisch-oberwelt-pos, stammtisch-oberwelt-hinweis

export default {
  mount(hub) {
    const { el, games, VW, VH } = hub;

    /* ---------- Welt ---------- */
    const stations = [];
    for (const g of games) {
      const p = STATIONEN[g.id];
      if (!p) continue;
      stations.push({ kind: 'spiel', id: g.id, name: g.name, station: g.station, best: g.best, x: p.x, y: p.y, bau: p.bau });
    }
    stations.push({ kind: 'liste', id: 'vereinsheim', name: 'Vereinsheim', station: 'Bestenliste', x: VEREINSHEIM.x, y: VEREINSHEIM.y, bau: VEREINSHEIM.bau });
    const world = buildWorld(stations);
    const colliders = world.colliders;

    function collides(x, y, r) {
      if (x < r + 4 || y < r + 4 || x > WW - r - 4 || y > WH - r - 4) return true;
      for (const c of colliders) {
        if (c.t === 'r') { if (x > c.x0 - r && x < c.x1 + r && y > c.y0 - r && y < c.y1 + r) return true; }
        else if (c.t === 'c') { const dx = x - c.x, dy = y - c.y, rr = c.r + r; if (dx * dx + dy * dy < rr * rr) return true; }
        else { const dx = (x - c.x) / (c.rx + r), dy = (y - c.y) / (c.ry + r); if (dx * dx + dy * dy < 1) return true; }
      }
      return false;
    }

    /* ---------- Wegfindung: Raster + A* + Glättung ---------- */
    const cols = Math.ceil(WW / CELL), rows = Math.ceil(WH / CELL), N = cols * rows;
    const blocked = new Uint8Array(N);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) blocked[j * cols + i] = collides((i + .5) * CELL, (j + .5) * CELL, BIRD_R + 1) ? 1 : 0;
    const cellOf = (x, y) => clamp(Math.floor(y / CELL), 0, rows - 1) * cols + clamp(Math.floor(x / CELL), 0, cols - 1);
    const center = k => ({ x: (k % cols + .5) * CELL, y: ((k / cols | 0) + .5) * CELL });

    function nearestFree(k) {
      if (!blocked[k]) return k;
      const seen = new Uint8Array(N), q = [k]; seen[k] = 1;
      for (let h = 0; h < q.length && h < 4000; h++) {
        const c = q[h], ci = c % cols, cj = c / cols | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
          const n = j * cols + i; if (seen[n]) continue; seen[n] = 1;
          if (!blocked[n]) return n; q.push(n);
        }
      }
      return -1;
    }
    function lineFree(a, b) {
      const d = dist(a.x, a.y, b.x, b.y), n = Math.ceil(d / 4);
      for (let s = 1; s <= n; s++) { const f = s / n; if (collides(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, BIRD_R)) return false; }
      return true;
    }
    function astar(s, g) {
      const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
      const heap = []; // [f, k]
      const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      const gi = g % cols, gj = g / cols | 0;
      const h = k => { const dx = Math.abs(k % cols - gi), dy = Math.abs((k / cols | 0) - gj); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
      gs[s] = 0; push(h(s), s);
      while (heap.length) {
        const [, c] = pop();
        if (c === g) break;
        if (closed[c]) continue; closed[c] = 1;
        const ci = c % cols, cj = c / cols | 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
          const n = j * cols + i; if (blocked[n] || closed[n]) continue;
          if (di && dj && (blocked[cj * cols + i] || blocked[j * cols + ci])) continue;
          const ng = gs[c] + (di && dj ? Math.SQRT2 : 1);
          if (ng < gs[n]) { gs[n] = ng; came[n] = c; push(ng + h(n), n); }
        }
      }
      if (s !== g && came[g] < 0) return null;
      const out = []; for (let k = g; k !== s && k >= 0; k = came[k]) out.push(k);
      return out.reverse();
    }
    /* -> Liste von Wegpunkten (ohne Startpunkt) oder null */
    function findPath(from, to) {
      let goal = { x: to.x, y: to.y };
      if (collides(goal.x, goal.y, BIRD_R)) { const k = nearestFree(cellOf(goal.x, goal.y)); if (k < 0) return null; goal = center(k); }
      if (lineFree(from, goal)) return [goal];
      const s = nearestFree(cellOf(from.x, from.y)), g = nearestFree(cellOf(goal.x, goal.y));
      if (s < 0 || g < 0) return null;
      const cells = astar(s, g); if (!cells) return null;
      const pts = [from, ...cells.map(center)];
      pts[pts.length - 1] = goal;
      if (pts.length === 1) pts.push(goal);
      const out = []; let i = 0;
      while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !lineFree(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
      return out;
    }

    /* ---------- Startposition ---------- */
    const byId = id => stations.find(s => s.id === id);
    let pos = null;
    const back = hub.fromGame && byId(hub.from);
    if (back) pos = { ...back.front };
    else {
      const saved = store.load(KEY, 'pos', null);
      if (saved && typeof saved.x === 'number' && !collides(saved.x, saved.y, BIRD_R)) pos = { x: saved.x, y: saved.y };
    }
    if (!pos || collides(pos.x, pos.y, BIRD_R)) pos = { ...START };
    const bird = { x: pos.x, y: pos.y, facing: back && back.x < WW / 2 ? 1 : -1, hop: 0, path: [], moving: false };
    const savePos = () => store.save(KEY, 'pos', { x: Math.round(bird.x), y: Math.round(bird.y) });

    const camFor = (prompt) => ({
      x: clamp(bird.x - VW / 2, 0, WW - VW),
      y: clamp(bird.y - VH * (prompt ? .38 : .55), 0, WH - VH),
    });
    const cam = camFor(false);

    let hopN = 0;
    let t = 0, pending = null, promptFor = null, dismissed = null, marker = null, panelOpen = false;
    let dragId = null, dragT = 0, dragFrom = null;
    const neun = { x: (FELD.x0 + FELD.x1) / 2, y: (FELD.y0 + FELD.y1) / 2 + 20, tx: 0, ty: 0, wait: 0, run: false, suit: pick(['♣', '♠', '♥', '♦']), facing: 1 };
    neun.tx = neun.x; neun.ty = neun.y;

    /* ---------- DOM: Hinweis, Liste-Link, Eingangskarte, Bestenliste ---------- */
    el.className = 'ow'; el.hidden = false;
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const liste = mk('a', 'ow-liste', 'Liste'); liste.href = '#/liste'; liste.setAttribute('aria-label', 'Alle Spiele als Liste');
    const hint = mk('div', 'ow-hint', 'Tippen Sie, wohin der Neuntöter hüpfen soll.');
    hint.hidden = !!store.load(KEY, 'hinweis', false);
    /* iPhone: Lautlos-Schalter stellt Web Audio stumm. Hinweis einmal zeigen (beim Zeigen gemerkt). */
    const hints = mk('div', 'ow-hints');
    hints.append(hint);
    if (audio.isIOS() && !store.load('ton', 'hinweis', false)) {
      const tonHint = mk('div', 'ow-hint ow-ton');
      const x = mk('button', null, '×'); x.type = 'button'; x.setAttribute('aria-label', 'Hinweis schließen');
      tonHint.append(mk('span', null, 'Kein Ton? Lautlos-Schalter am iPhone prüfen.'), x);
      tonHint.addEventListener('click', () => { tonHint.remove(); });
      hints.append(tonHint);
      store.save('ton', 'hinweis', true);
    }
    const cardEl = mk('div', 'ow-card'); cardEl.hidden = true; cardEl.setAttribute('role', 'dialog');
    const panel = mk('div', 'ow-panel'); panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Bestenliste');
    el.append(liste, hints, cardEl, panel);

    const bestText = b => b && b.score ? `${b.score} · ${b.title || '–'}` : 'noch keine Wertung';

    function showPrompt(s) {
      promptFor = s; dismissed = null;
      cardEl.replaceChildren();
      const txt = mk('div', 'ow-card-txt');
      txt.append(mk('div', 'ow-card-k', s.kind === 'spiel' ? s.station : 'Vereinsheim'),
        mk('h3', null, s.kind === 'spiel' ? s.name : 'Bestenliste'),
        mk('div', 'ow-card-best', s.kind === 'spiel' ? 'Bestleistung: ' + bestText(s.best) : 'Alle Bestleistungen dieses Geräts'));
      const btn = mk('button', 'big ow-go', s.kind === 'spiel' ? 'Spielen' : 'Eintreten'); btn.type = 'button';
      btn.addEventListener('click', () => {
        if (s.kind === 'spiel') { bird.x = s.front.x; bird.y = s.front.y; savePos(); hub.open(s.id); }
        else openPanel();
      });
      cardEl.append(txt, btn);
      if (cardEl.hidden) audio.sfx('prompt');
      cardEl.hidden = false;
    }
    function hidePrompt() { if (promptFor) { dismissed = promptFor; promptFor = null; } cardEl.hidden = true; }

    function openPanel() {
      hidePrompt(); panelOpen = true;
      panel.replaceChildren();
      const head = mk('div', 'ow-panel-head');
      head.append(mk('h2', null, 'Bestenliste'), mk('p', 'rules', 'Amtlich beglaubigte Bestleistungen dieses Geräts. Einsprüche bitte schriftlich beim Vorstand.'));
      const ul = mk('ul', 'ow-rows');
      for (const g of games) {
        const li = mk('li', 'ow-row' + (g.best.score ? '' : ' leer'));
        const l = mk('div'); l.append(mk('div', 'ow-row-name', g.name), mk('div', 'ow-row-station', g.station || ''));
        const r = mk('div', 'ow-row-r'); r.append(mk('div', 'ow-row-score', g.best.score ? String(g.best.score) : '–'), mk('div', 'ow-row-title', g.best.score ? (g.best.title || '') : 'noch keine Wertung'));
        li.append(l, r); ul.append(li);
      }
      if (!games.length) ul.append(mk('li', 'rules', 'Keine Spiele registriert.'));
      const close = mk('button', 'big ow-close', 'Schließen'); close.type = 'button';
      close.addEventListener('click', closePanel);
      panel.append(head, ul, close);
      panel.hidden = false;
      close.focus({ preventScroll: true });
    }
    function closePanel() { panelOpen = false; panel.hidden = true; }

    /* ---------- Bewegung ---------- */
    function walkTo(target, station) {
      const p = findPath(bird, target);
      marker = { x: target.x, y: target.y, t: 0, ok: !!p };
      if (!p) return false;
      bird.path = p; bird.moving = true; pending = station || null;
      if (promptFor && promptFor !== station) hidePrompt();
      return true;
    }
    function stationAt(x, y) {
      let best = null;
      for (const s of stations) {
        const [x0, y0, x1, y1] = s.hit, sg = s.signBox;
        const inHit = x > x0 && x < x1 && y > y0 && y < y1;
        const inSign = sg && x > sg[0] - 4 && x < sg[2] + 4 && y > sg[1] - 4 && y < sg[3] + 4;
        if ((inHit || inSign) && (!best || s.y > best.y)) best = s;
      }
      return best;
    }
    function tapWorld(x, y) {
      if (!hint.hidden) { hint.hidden = true; store.save(KEY, 'hinweis', true); }
      const s = stationAt(x, y);
      if (s) {
        if (dist(bird.x, bird.y, s.door.x, s.door.y) < TRIGGER && !bird.moving) { showPrompt(s); return; }
        walkTo(s.door, s);
      } else { hidePrompt(); walkTo({ x, y }, null); }
    }

    function step(dt) {
      t += dt;
      if (marker) { marker.t += dt; if (marker.t > .6) marker = null; }
      dragT -= dt;
      // Vogel
      let budget = SPEED * dt;
      while (bird.path.length && budget > 0) {
        const w = bird.path[0], dx = w.x - bird.x, dy = w.y - bird.y, d = Math.hypot(dx, dy);
        if (Math.abs(dx) > .5) bird.facing = dx > 0 ? 1 : -1;
        if (d <= budget) { bird.x = w.x; bird.y = w.y; budget -= d; bird.hop += d * .1; bird.path.shift(); }
        else { bird.x += dx / d * budget; bird.y += dy / d * budget; bird.hop += budget * .1; budget = 0; }
      }
      if (bird.moving) { const h = Math.floor(bird.hop / Math.PI); if (h !== hopN) { hopN = h; audio.sfx('hop'); } }
      if (bird.moving && !bird.path.length) {
        bird.moving = false; bird.hop = 0; hopN = 0; savePos();
        if (pending && dist(bird.x, bird.y, pending.door.x, pending.door.y) < 6) showPrompt(pending);
        pending = null;
      }
      // Eingangsbereiche
      const inside = stations.find(s => dist(bird.x, bird.y, s.door.x, s.door.y) < TRIGGER) || null;
      if (!inside) dismissed = null;
      if (promptFor && inside !== promptFor) hidePrompt(), dismissed = null;
      if (inside && !promptFor && !bird.moving && dismissed !== inside && !panelOpen) showPrompt(inside);
      // Neuner auf dem Feld
      const nb = dist(neun.x, neun.y, bird.x, bird.y);
      neun.run = nb < 80;
      if (neun.run) { neun.tx = neun.x + (neun.x - bird.x) / nb * 60; neun.ty = neun.y + (neun.y - bird.y) / nb * 60; neun.wait = .6; }
      else if ((neun.wait -= dt) < 0 && dist(neun.x, neun.y, neun.tx, neun.ty) < 3) { neun.tx = FELD.x0 + 24 + Math.random() * (FELD.x1 - FELD.x0 - 48); neun.ty = FELD.y0 + 40 + Math.random() * (FELD.y1 - FELD.y0 - 50); neun.wait = 1 + Math.random() * 2.5; }
      neun.tx = clamp(neun.tx, FELD.x0 + 14, FELD.x1 - 14); neun.ty = clamp(neun.ty, FELD.y0 + 30, FELD.y1 - 6);
      if (neun.wait <= 0 || neun.run) {
        const dx = neun.tx - neun.x, dy = neun.ty - neun.y, d = Math.hypot(dx, dy), v = (neun.run ? 95 : 28) * dt;
        if (d > .5) { const k = Math.min(1, v / d); neun.x += dx * k; neun.y += dy * k; if (Math.abs(dx) > .3) neun.facing = dx > 0 ? 1 : -1; }
      }
      // Kamera
      const ct = camFor(!!promptFor), k = 1 - Math.exp(-dt * 5);
      cam.x += (ct.x - cam.x) * k; cam.y += (ct.y - cam.y) * k;
    }

    /* ---------- Zeichnen ---------- */
    const birdThing = {
      get y() { return bird.y; },
      draw(ctx) {
        const hop = bird.moving ? Math.abs(Math.sin(bird.hop)) * 7 : 0;
        const bob = bird.moving ? 0 : Math.sin(t * 2.6) * .8;
        ctx.fillStyle = 'rgba(30,40,25,.22)'; ctx.beginPath(); ctx.ellipse(bird.x, bird.y + 1, 13 - hop * .6, 4, 0, 0, Math.PI * 2); ctx.fill();
        neuntoeter(ctx, bird.x, bird.y - 14 - hop + bob, { facing: bird.facing, scale: .62, wing: bird.moving ? Math.sin(bird.hop * 2) * .5 : Math.sin(t * 1.3) * .08 });
      },
    };
    const neunThing = { get y() { return neun.y; }, draw(ctx) { laufNeuner(ctx, neun.x, neun.y, t, neun.run, neun.suit, neun.facing); } };

    function draw(ctx) {
      const v = { x0: cam.x - 4, y0: cam.y - 4, x1: cam.x + VW + 4, y1: cam.y + VH + 4 };
      const vis = th => !th.bbox || (th.bbox[2] > v.x0 && th.bbox[0] < v.x1 && th.bbox[3] > v.y0 && th.bbox[1] < v.y1);
      ctx.save(); ctx.translate(-cam.x, -cam.y);
      drawGround(ctx, v, t);
      if (marker) {
        const p = marker.t / .6; ctx.globalAlpha = 1 - p; ctx.strokeStyle = marker.ok ? (C.dark ? '#e8c96b' : '#8c3b1f') : '#a3291c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(marker.x, marker.y, 6 + p * 10, 3 + p * 4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }
      const list = world.things.filter(vis);
      list.push(birdThing);
      if (neun.x > v.x0 - 20 && neun.x < v.x1 + 20 && neun.y > v.y0 && neun.y < v.y1 + 40) list.push(neunThing);
      list.sort((a, b) => a.y - b.y);
      for (const th of list) th.draw(ctx, t);
      ctx.restore();
      if (C.dark) {
        ctx.fillStyle = 'rgba(10,16,30,.36)'; ctx.fillRect(0, 0, VW, VH);
        ctx.save(); ctx.translate(-cam.x, -cam.y);
        for (const th of list) if (th.light) th.light(ctx);
        ctx.restore();
      }
      ctx.save(); ctx.translate(-cam.x, -cam.y);
      for (const s of stations) {
        const sx = s.signAt.x, sy = s.signAt.y;
        if (sx < v.x0 - 100 || sx > v.x1 + 100 || sy < v.y0 || sy > v.y1 + 60) { s.signBox = null; continue; }
        s.signBox = schild(ctx, sx, sy, s.name, s.kind === 'spiel' ? bestText(s.best) : 'Bestenliste', s === promptFor || s.id === hub.from);
      }
      ctx.restore();
    }

    /* ---------- Eingabe ---------- */
    function onPointer(ev) {
      if (panelOpen) return;
      const wx = ev.x + cam.x, wy = ev.y + cam.y;
      if (ev.type === 'down') { dragId = ev.id; dragFrom = { x: ev.x, y: ev.y }; dragT = .12; tapWorld(wx, wy); }
      else if (ev.type === 'move' && ev.pressed && ev.id === dragId) {
        // Halten und Ziehen: Ziel folgt dem Finger
        if (dragFrom && dist(ev.x, ev.y, dragFrom.x, dragFrom.y) > 14 && dragT <= 0) { dragT = .12; hidePrompt(); walkTo({ x: wx, y: wy }, null); }
      } else if (ev.type === 'up' || ev.type === 'cancel') { if (ev.id === dragId) dragId = null; }
    }

    const stop = hub.loop(step);
    step(0);

    return {
      draw, onPointer,
      unmount() { stop(); if (!bird.moving) savePos(); el.replaceChildren(); el.className = ''; el.hidden = true; },
      /* nur für Tests (window.__stammtisch.hub) */
      debug: {
        stations: stations.map(s => s.id),
        get bird() { return { x: bird.x, y: bird.y, moving: bird.moving }; },
        get prompt() { return promptFor ? promptFor.id : null; },
        get panel() { return panelOpen; },
        door: id => { const s = byId(id); return s ? { ...s.door } : null; },
        /* Bildschirmpunkt (Weltkoordinaten der Bühne 360×640) auf einer Station, oder null wenn nicht sichtbar */
        screenPoint(id) {
          const s = byId(id); if (!s) return null;
          const x = s.x - cam.x, y = s.y - s.B.d / 2 - cam.y;
          return x > 10 && x < VW - 10 && y > 10 && y < VH - 10 ? { x, y } : null;
        },
        toScreen: (x, y) => ({ x: x - cam.x, y: y - cam.y }),
      },
    };
  },
};
