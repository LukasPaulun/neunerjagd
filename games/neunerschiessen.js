/* Neunerschießen – Schießbude. Karten flattern in drei Tiefenebenen über Wiese und Hecke.
   Tippen = der Neuntöter schießt einen Dorn an die Stelle. 8 Dornen, Nachladen = „Mischen“
   (nach unten wischen oder Tipp aufs Dornenbündel). 90 Sekunden. */
import { card, neuntoeter, dorn, rr, isDulle, RANKS, SUITS, WOOD } from '../core/draw.js';
import { hud, createPopups } from '../core/hud.js';
import { rand, pick, clamp } from '../core/util.js';

const DAUER = 90, MAG = 8, RELOAD = 0.55;
const MONO = '"IBM Plex Mono",monospace';
const THEKE = 556;                        // Oberkante der Schießbuden-Theke
const BUNDLE = { x: 44, y: 604, r: 30 };  // Dornenbündel = Mischen-Knopf
const BIRD = { x: 304, y: 537, s: 1.0 };
const P_ANDERE = 9, P_DULLE = 18;   // Dulle kostet doppelt

/* Tiefenebenen: Größe, Punkte, Flughöhe, Tempo, Spawn-Abstand */
const LAYERS = [
  { name: 'fern', s: .55, pts: 27, y0: 105, y1: 205, amp: 10, v: [42, 66], gap: 1.9 },
  { name: 'mittel', s: .82, pts: 18, y0: 262, y1: 335, amp: 14, v: [68, 104], gap: 1.6 },
  { name: 'nah', s: 1.15, pts: 9, y0: 398, y1: 462, amp: 16, v: [100, 148], gap: 2.1 },
];

export default {
  id: 'neunerschiessen',
  name: 'Neunerschießen',
  station: 'Schießbude',
  intro: 'Die Neuner flattern über Wiese und Hecke. Tippen Sie auf einen Neuner, der Neuntöter schießt einen Dorn genau dorthin. Je weiter weg, desto mehr Punkte. Ist der Vorrat leer, wischen Sie nach unten oder tippen Sie aufs Dornenbündel: Mischen.',
  rules: [
    'Neuner: nah +9 · mittel +18 · fern +27',
    `Andere Karte −${P_ANDERE} · Dulle (Herz-Zehn) −${P_DULLE}`,
    '8 Dornen · 90 Sekunden',
  ],
  startLabel: 'Anlegen',
  againLabel: 'Nochmal anlegen',
  pauseText: 'Feuerpause. Die Schießbude bleibt besetzt.',
  titles: [[0, 'Platzpatrone'], [150, 'Schützenbruder'], [350, 'Dornenschütze'], [600, 'Schützenkönig'], [900, 'Vereinsscharfrichter']],
  test: { sekunden: 8, gesten: ['tap', 'tap', 'tap', 'drag'], zone: [20, 80, 340, 540] },

  create(api) {
    const { VW, VH, HUD, C } = api;
    const pops = createPopups();
    let cards, falling, marks, tracers, score, nines, shots, hits, fouls, t, ammo, reloading, shake, shootAnim;
    let spawnT, gesture, ended;

    function reset() {
      cards = []; falling = []; marks = []; tracers = []; pops.clear();
      score = 0; nines = 0; shots = 0; hits = 0; fouls = 0; t = 0;
      ammo = MAG; reloading = 0; shake = 0; shootAnim = 0; gesture = null; ended = false;
      spawnT = [0.2, 0.6, 1.0];
      // ein paar Karten schon in der Luft, damit das Bild hinter dem Start-Overlay lebt
      for (let li = 0; li < 3; li++) for (let k = 0; k < 2; k++) { const c = spawn(li); c.x = rand(50, VW - 50); }
    }

    function makeCard(li, rank, suit, dir, x, baseY) {
      const L = LAYERS[li], lvl = 1 + t / DAUER * .6;
      const c = {
        li, rank, suit, dir, x, baseY,
        vx: dir * rand(L.v[0], L.v[1]) * lvl, ph: rand(0, 6), phv: rand(1.6, 2.6), fl: rand(0, 6), flv: rand(5, 8),
        amp: L.amp * rand(.7, 1.3), y: baseY, rot: 0, fx: 1,
      };
      cards.push(c); return c;
    }

    function spawn(li) {
      const L = LAYERS[li], dir = Math.random() < .5 ? 1 : -1;
      const nine = Math.random() < .5;
      let rank, suit;
      if (nine) { rank = '9'; suit = pick(SUITS); }
      else if (Math.random() < .12) { rank = '10'; suit = '♥'; }
      else { rank = pick(RANKS); suit = pick(SUITS); }
      return makeCard(li, rank, suit, dir, dir > 0 ? -30 : VW + 30, rand(L.y0, L.y1));
    }

    function finish(why) {
      if (ended) return; ended = true;
      const q = shots ? Math.round(hits / shots * 100) : 0;
      const text = `${why} ${nines} Neuner aufgespießt, ${fouls} Unschuldige getroffen, Trefferquote ${q} %. ${score} Punkte.`;
      api.end(score < 0 ? { score, text, title: 'Gefahr für den Verein' } : { score, text });
    }

    function startReload() {
      if (reloading > 0 || ammo >= MAG) return;
      reloading = RELOAD; api.vibrate(15);
    }

    function step(dt) {
      t += dt; pops.step(dt);
      if (shake > 0) shake -= dt; if (shootAnim > 0) shootAnim -= dt;
      if (reloading > 0) { reloading -= dt; if (reloading <= 0) { reloading = 0; ammo = MAG; } }
      const lvl = 1 + t / DAUER * .7;
      for (let li = 0; li < 3; li++) { spawnT[li] -= dt; if (spawnT[li] <= 0) { spawn(li); spawnT[li] = LAYERS[li].gap / lvl * rand(.7, 1.3); } }
      for (const c of cards) {
        c.x += c.vx * dt; c.ph += c.phv * dt; c.fl += c.flv * dt;
        c.y = c.baseY + Math.sin(c.ph) * c.amp;
        c.rot = Math.sin(c.ph * 1.3 + 1) * .3;
        c.fx = .55 + .45 * Math.abs(Math.cos(c.fl));          // Flattern wie Flügelschlag
      }
      cards = cards.filter(c => c.x > -60 && c.x < VW + 60);
      for (const f of falling) { f.vy += 900 * dt; f.y += f.vy * dt; f.x += f.vx * dt; f.rot += f.vr * dt; }
      falling = falling.filter(f => f.y < VH + 60);
      for (const m of marks) m.a -= dt / .35; marks = marks.filter(m => m.a > 0);
      for (const r of tracers) r.a -= dt / .14; tracers = tracers.filter(r => r.a > 0);
      if (t >= DAUER) finish('Zeit um.');
    }

    /* Treffertest in der Kartenebene (inverse Drehung), Mindestgröße 44×44 */
    function hitTest(c, x, y) {
      const s = LAYERS[c.li].s, dx = x - c.x, dy = y - c.y, co = Math.cos(-c.rot), si = Math.sin(-c.rot);
      const lx = dx * co - dy * si, ly = dx * si + dy * co;
      const hw = Math.max(22, 20 * s * c.fx + 5), hh = Math.max(22, 28 * s + 5);
      return Math.abs(lx) < hw && Math.abs(ly) < hh ? { lx, ly, d: Math.abs(lx) / hw + Math.abs(ly) / hh } : null;
    }

    function shoot(x, y) {
      if (reloading > 0) return;
      if (ammo <= 0) {
        shake = .35; api.vibrate([20, 40, 20]);
        pops.add(x, y - 10, 'Klack. Mischen!', C.bad);
        marks.push({ x, y, a: 1, kind: 'leer' });
        return;
      }
      ammo--; shots++; shootAnim = .14;
      tracers.push({ x0: BIRD.x - 30, y0: BIRD.y - 6, x1: x, y1: y, a: 1 });
      // nächste Ebene zuerst; innerhalb der Ebene die Karte, die näher an der Mitte getroffen ist
      let best = null;
      for (let li = 2; li >= 0 && !best; li--) {
        for (const c of cards) {
          if (c.li !== li) continue;
          const h = hitTest(c, x, y);
          if (h && (!best || h.d < best.h.d)) best = { c, h };
        }
      }
      if (!best) { marks.push({ x, y, a: 1, kind: 'miss' }); return; }
      const { c, h } = best; hits++;
      cards.splice(cards.indexOf(c), 1);
      const ang = Math.atan2(x - BIRD.x, -(y - BIRD.y)) - c.rot;   // Dorn zeigt in Schussrichtung
      falling.push({ ...c, fx: 1, thorn: { lx: h.lx, ly: h.ly, ang }, vy: -80, vx: c.vx * .3, vr: rand(-3, 3) });
      const L = LAYERS[c.li];
      if (c.rank === '9') {
        nines++; score += L.pts; marks.push({ x, y, a: 1, kind: 'ok' });
        pops.add(c.x, c.y - 26, `+${L.pts} aufgespießt`, C.ok); api.vibrate(15);
      } else {
        const d = isDulle(c.rank, c.suit); fouls++; score -= d ? P_DULLE : P_ANDERE;
        marks.push({ x, y, a: 1, kind: 'bad' }); api.vibrate(d ? 200 : 60);
        pops.add(c.x, c.y - 26, d ? `Die Dulle! −${P_DULLE}` : `Unschuldig: ${c.rank}${c.suit} −${P_ANDERE}`, C.bad);
      }
    }

    function onPointer(ev) {
      if (ev.type === 'down') {
        gesture = { id: ev.id, x: ev.x, y: ev.y, t, done: false };
        if (Math.hypot(ev.x - BUNDLE.x, ev.y - BUNDLE.y) < BUNDLE.r + 10) { gesture.done = true; if (ammo >= MAG) pops.add(VW / 2, THEKE - 20, 'Schon gemischt.', C.ink); else startReload(); return; }
        if (ev.y > HUD && ev.y < THEKE - 4) shoot(ev.x, ev.y);
      } else if (ev.type === 'move' && gesture && !gesture.done && ev.id === gesture.id && ev.pressed !== false) {
        const dx = ev.x - gesture.x, dy = ev.y - gesture.y;
        if (dy > 55 && dy > Math.abs(dx) * 1.3 && t - gesture.t < .5) { gesture.done = true; startReload(); }
      } else if (ev.type === 'up' || ev.type === 'cancel') gesture = null;
    }

    /* ---------- Zeichnen ---------- */
    function wave(ctx, base, off, a1, k1, a2, k2, bottom) {
      ctx.beginPath(); ctx.moveTo(0, bottom);
      for (let x = 0; x <= VW + 6; x += 6) ctx.lineTo(x, base + a1 * Math.sin((x + off) * k1) + a2 * Math.sin((x + off) * k2 + 1.7));
      ctx.lineTo(VW, bottom); ctx.closePath();
    }

    function drawCard(ctx, c) {
      const s = LAYERS[c.li].s;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      ctx.save(); ctx.scale(c.fx, 1); card(ctx, 0, 0, 0, c.rank, c.suit, s); ctx.restore();
      if (c.thorn) { const k = Math.max(s, .8); dorn(ctx, c.thorn.lx - Math.sin(c.thorn.ang) * 16 * k, c.thorn.ly + Math.cos(c.thorn.ang) * 16 * k, 38 * k, c.thorn.ang, 8 * k, WOOD); }
      ctx.restore();
    }

    function layerCards(ctx, li) {
      for (const c of cards) if (c.li === li) drawCard(ctx, c);
      for (const f of falling) if (f.li === li) drawCard(ctx, f);
    }

    function scene(ctx) {
      // Himmel + Wolken (fernste Ebene, sehr langsam)
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, VW, VH);
      ctx.save(); ctx.fillStyle = C.line; ctx.globalAlpha = .6;
      for (let i = 0; i < 4; i++) {
        const x = (i * 131 + t * 5) % (VW + 140) - 70, y = HUD + 30 + (i * 37) % 70;
        ctx.beginPath(); ctx.ellipse(x, y, 34 + i * 4, 11, 0, 0, Math.PI * 2); ctx.ellipse(x + 18, y - 7, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      // ferne Hügel
      ctx.save(); ctx.fillStyle = C.thorn; ctx.globalAlpha = .16; wave(ctx, 238, t * 3, 14, .018, 7, .041, VH); ctx.fill(); ctx.restore();
      layerCards(ctx, 0);
      // mittlere Ebene: Hecke mit Bäumen
      ctx.save(); const off = t * 9;
      for (let i = 0; i < 3; i++) {
        const x = ((i * 151 + 40 - off) % (VW + 90) + VW + 90) % (VW + 90) - 45;
        ctx.fillStyle = WOOD; ctx.fillRect(x - 3, 330, 6, 46);
        ctx.fillStyle = C.thorn; ctx.globalAlpha = .45; ctx.beginPath(); ctx.arc(x, 322, 22, 0, Math.PI * 2); ctx.moveTo(x - 14 + 15, 334); ctx.arc(x - 14, 334, 15, 0, Math.PI * 2); ctx.moveTo(x + 14 + 15, 334); ctx.arc(x + 14, 334, 15, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = C.thorn; ctx.globalAlpha = .34; wave(ctx, 372, off, 5, .09, 4, .17, VH); ctx.fill(); ctx.globalAlpha = 1;
      for (let i = 0; i < 9; i++) { const x = ((i * 43 - off) % VW + VW) % VW; dorn(ctx, x, 374 + 4 * Math.sin((x + off) * .09), 9, (i % 2 ? .5 : -.5), 3, WOOD); }
      ctx.restore();
      layerCards(ctx, 1);
      // nahe Ebene: Wiese mit Grasbüscheln
      ctx.save(); const off2 = t * 20;
      ctx.fillStyle = C.thorn; ctx.globalAlpha = .5; wave(ctx, 500, off2, 6, .03, 3, .11, VH); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = C.thorn; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const x = ((i * 37 - off2) % (VW + 20) + VW + 20) % (VW + 20) - 10, y = 512 + (i * 13) % 30;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y - 11); ctx.moveTo(x, y); ctx.lineTo(x + 1, y - 14); ctx.moveTo(x, y); ctx.lineTo(x + 6, y - 10); ctx.stroke();
      }
      ctx.restore();
      layerCards(ctx, 2);
    }

    function theke(ctx) {
      // Schießbuden-Theke: Holzbrett, darunter Ablage für Dornen
      ctx.save();
      ctx.fillStyle = C.veil; ctx.fillRect(0, THEKE, VW, VH - THEKE);
      ctx.fillStyle = WOOD; ctx.fillRect(0, THEKE, VW, 11);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, THEKE + 11, VW, 3);
      ctx.restore();
      // Neuntöter auf der Theke
      const sa = shootAnim > 0 ? shootAnim / .14 : 0;
      neuntoeter(ctx, BIRD.x, BIRD.y - sa * 3, { scale: BIRD.s, facing: -1, mouth: sa * .7, wing: sa ? -.6 : Math.sin(t * 2) * .15 });
      // Mischen-Knopf (Dornenbündel)
      const empty = ammo <= 0 && reloading <= 0, pulse = empty ? .5 + .5 * Math.sin(t * 10) : 0;
      ctx.save();
      ctx.beginPath(); ctx.arc(BUNDLE.x, BUNDLE.y, BUNDLE.r, 0, Math.PI * 2);
      ctx.fillStyle = C.bg; ctx.fill(); ctx.lineWidth = 2 + pulse * 2; ctx.strokeStyle = empty ? C.bad : C.line; ctx.stroke();
      for (let i = -2; i <= 2; i++) dorn(ctx, BUNDLE.x + i * 3, BUNDLE.y + 14, 30, i * .18, 5, WOOD);
      ctx.fillStyle = C.ch; ctx.fillRect(BUNDLE.x - 9, BUNDLE.y + 2, 18, 4);
      if (reloading > 0) { ctx.beginPath(); ctx.strokeStyle = C.ch; ctx.lineWidth = 3; ctx.arc(BUNDLE.x, BUNDLE.y, BUNDLE.r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - reloading / RELOAD)); ctx.stroke(); }
      ctx.restore();
      // Dornenvorrat
      const sx = shake > 0 ? Math.sin(shake * 70) * 4 : 0;
      ctx.save(); ctx.translate(sx, 0);
      ctx.font = `600 11px ${MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = empty ? C.bad : C.muted;
      ctx.fillText(reloading > 0 ? 'MISCHEN …' : empty ? 'LEER: WISCHEN ODER BÜNDEL' : 'DORNEN', 88, 588);
      const shown = reloading > 0 ? Math.floor(MAG * (1 - reloading / RELOAD)) : ammo;
      for (let i = 0; i < MAG; i++) {
        const x = 96 + i * 25;
        if (i < shown) dorn(ctx, x, 628, 30, 0, 9, WOOD);
        else { ctx.globalAlpha = .35; dorn(ctx, x, 628, 30, 0, 9, C.muted); ctx.globalAlpha = 1; }
      }
      ctx.restore();
    }

    function effects(ctx) {
      ctx.save(); ctx.lineCap = 'round';
      for (const r of tracers) { ctx.globalAlpha = r.a * .7; ctx.strokeStyle = WOOD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r.x0 + (r.x1 - r.x0) * (1 - r.a) * .6, r.y0 + (r.y1 - r.y0) * (1 - r.a) * .6); ctx.lineTo(r.x1, r.y1); ctx.stroke(); }
      for (const m of marks) {
        const p = 1 - m.a, col = m.kind === 'ok' ? C.ok : m.kind === 'bad' ? C.bad : m.kind === 'leer' ? C.muted : C.ink;
        ctx.globalAlpha = m.a; ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(m.x, m.y, 6 + p * 14, 0, Math.PI * 2); ctx.stroke();
        if (m.kind !== 'leer') { const k = 5; ctx.beginPath(); ctx.moveTo(m.x - k, m.y - k); ctx.lineTo(m.x + k, m.y + k); ctx.moveTo(m.x + k, m.y - k); ctx.lineTo(m.x - k, m.y + k); ctx.stroke(); }
      }
      ctx.restore();
    }

    function draw(ctx) {
      scene(ctx);
      theke(ctx);
      effects(ctx);
      pops.draw(ctx);
      const left = Math.ceil(clamp(DAUER - t, 0, DAUER)), q = shots ? Math.round(hits / shots * 100) + '%' : '–';
      hud(ctx, [
        { x: 12, label: 'PUNKTE', value: score, color: score < 0 ? C.bad : C.ch },
        { x: 110, label: 'ZEIT', value: left, color: left <= 10 ? C.bad : C.ink },
        { x: 190, label: 'NEUNER', value: nines },
        { x: 282, label: 'QUOTE', value: q },
      ]);
    }

    return { reset, step, draw, onPointer, forceEnd: () => finish('Testabbruch.') };
  },
};
