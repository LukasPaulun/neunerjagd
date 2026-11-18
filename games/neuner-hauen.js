/* Neuner hauen – Mechanik à la Whack-a-Mole auf der Stammtischplatte.
   9 Löcher im 3×3-Raster, Karten tauchen auf. Neuner antippen: Der Neuntöter stößt herab
   und spießt ihn auf (+9). Andere Karte −1 Leben, Dulle −2. 60 s oder 3 Leben. */
import { card, neuntoeter, dorn, dornAst, dornSlot, rr, isDulle, RANKS, SUITS, WOOD } from '../core/draw.js';
import { hudBar, hudLabel, hudValue, hudHearts, createPopups } from '../core/hud.js';
import { clamp, lerp, rand, pick } from '../core/util.js';

const DAUER = 60;
const COLS = [66, 180, 294], ROWS = [212, 352, 492];   // Lochmitten (Weltkoordinaten)
const CS = 1.3;                                         // Kartengröße in den Löchern (52 × 73)
const HOLE_RX = 40, HOLE_RY = 13;
const BRANCH = 598, NT = 9;                             // Dornast unten, 9 Dornen
const TABLE = { x: 8, y: 66, w: 344, h: 492 };
const MONO = '"IBM Plex Mono",monospace';
/* Popup-Farben auf dem (festfarbigen) Holz: hell, damit sie hell wie dunkel lesbar sind */
const P_OK = '#e4f5d2', P_GOLD = '#ffd65a', P_BAD = '#ffc2b6', P_ESC = '#f3ece2';
const SWOOP = 0.34, CONTACT = 0.12, FLY = 0.36;         // Vogel-Stoß gesamt, Kontakt, Karten-Flug zum Dorn

/* Schwierigkeit über die Runde, p = 0..1.
   Anfangs gemütlich, zum Ende hin (p²) deutlich schärfer: kürzer oben, mehr falsche Karten. */
const tune = p => { const q = p * p; return {
  every: lerp(0.95, 0.32, p),        // s zwischen zwei Karten
  hold: lerp(1.20, 0.62, p) - 0.18 * q, // s ganz oben (am Ende ca. 0,44 s)
  rise: lerp(0.17, 0.09, p),         // s Auf- bzw. Abtauchen
  maxUp: Math.round(lerp(2, 6, p)),  // Karten gleichzeitig
  nine: lerp(0.52, 0.40, p) - 0.04 * q, // Anteil Neuner
  dulle: lerp(0.04, 0.12, p) + 0.04 * q, // Anteil Dulle (sonst andere Karten)
}; };
const SERIE = [3, 6, 9];             // Serienbonus nach 3, 6, 9+ Neunern in Folge (gedeckelt)

export default {
  id: 'neuner-hauen',
  name: 'Neuner hauen',
  station: 'Wirtshaus „Zum Stammtisch“',
  intro: 'Aus der Stammtischplatte tauchen Karten auf. Tippen Sie jeden Neuner an, bevor er wieder abtaucht: Der Neuntöter stößt herab und spießt ihn auf. Alle anderen Karten lassen Sie bitte in Ruhe.',
  rules: [`Neuner +9 · drei in Folge: Serienbonus +${SERIE[0]} bis +${SERIE[2]}`, 'Andere Karte −1 · Dulle (Herz-Zehn) −2', '3 Leben · 60 Sekunden'],
  startLabel: 'Auf den Tisch hauen',
  againLabel: 'Nächste Runde',
  pauseText: 'Der Wirt wischt kurz über den Tisch.',
  titles: [[0, 'Laufkundschaft'], [90, 'Stammgast'], [200, 'Tischklopfer'], [320, 'Neunerhauer'], [450, 'Hüter der Tischplatte']],
  test: { sekunden: 6, gesten: ['tap'], zone: [26, 150, 334, 510] },

  create(api) {
    const { VW, VH, HUD, C } = api;
    const pops = createPopups({ outline: 'rgba(38,20,8,.82)' });   // dunkler Rand: lesbar auf hellem wie dunklem Holz
    const holes = [];
    for (const y of ROWS) for (const x of COLS) holes.push({ x, y });
    let t, score, lives, streak, nines, esc, fouls, spawnT, spiked, flyers, birds, bursts, flashes, shake, redT, last;

    function reset() {
      t = 0; score = 0; lives = 3; streak = 0; nines = 0; esc = 0; fouls = 0; spawnT = 0.5;
      spiked = []; flyers = []; birds = []; bursts = []; flashes = []; shake = 0; redT = 0; last = [];
      pops.clear();
      for (const h of holes) { h.c = null; h.cool = 0; }
    }

    /* Ausfahrgrad 0..1 einer Karte */
    function ext(c) {
      if (c.foul != null) return Math.max(0, 1 - c.foul / 0.22) * c.foulFrom;
      const a = c.age;
      if (a < c.rise) return a / c.rise;
      if (a < c.rise + c.hold) return 1;
      return Math.max(0, 1 - (a - c.rise - c.hold) / c.rise);
    }
    const cardY = (h, e) => h.y + 40 - 72 * e;

    function spawn(k) {
      const free = holes.filter(h => !h.c && h.cool <= 0);
      if (!free.length || holes.filter(h => h.c).length >= k.maxUp) return false;
      const h = pick(free);
      let rank, suit;
      if (Math.random() < k.nine) { rank = '9'; suit = pick(SUITS); }
      else if (Math.random() < k.dulle / (1 - k.nine)) { rank = '10'; suit = '♥'; }
      else { do { rank = pick(RANKS); suit = pick(SUITS); } while (isDulle(rank, suit)); }
      h.c = { rank, suit, age: 0, rise: k.rise, hold: k.hold * rand(0.85, 1.15), foul: null, foulFrom: 1 };
      return true;
    }

    function breakStreak() { streak = 0; last = []; }

    function hitNine(h) {
      const c = h.c, e = ext(c), y = cardY(h, e);
      h.c = null; h.cool = 0.18;
      const side = h.x < VW / 2 ? 1 : (h.x > VW / 2 ? -1 : (Math.random() < .5 ? -1 : 1));
      const tx = h.x, ty = Math.min(y, h.y - 26);
      birds.push({ t: 0, sx: tx + side * 150, sy: ty - 210, cx: tx, cy: ty - 6, ex: tx - side * 170, ey: ty - 170 });
      const slot = dornSlot(spiked.length + flyers.length, BRANCH, NT);
      flyers.push({ t: -CONTACT, s: c.suit, x0: tx, y0: ty, y00: y, x1: slot.x, y1: slot.y, r: slot.r });
      bursts.push({ t: -CONTACT + 0.02, x: tx, y: ty });
      nines++; streak++; last.push(c.suit);
      score += 9; pops.add(tx, ty - 50, '+9', P_OK);
      if (streak % 3 === 0) {
        const n = Math.min(3, streak / 3), bonus = SERIE[n - 1];
        score += bonus;
        pops.add(tx, ty - 74, ['Dreier', 'Sechser', 'Neuner-Serie'][n - 1] + `! +${bonus}`, P_GOLD);
        api.vibrate([15, 30, 15]); api.sfx('neuner', { pitch: 1.5 }); api.sfx('prompt');
        last = [];
      } else { api.vibrate(15); api.sfx('neuner', { pitch: 1 + (streak % 3) * 0.12 }); }
    }

    function foul(h) {
      const c = h.c, dulle = isDulle(c.rank, c.suit);
      c.foulFrom = ext(c); c.foul = 0;
      lives -= dulle ? 2 : 1; fouls++;
      breakStreak();
      shake = dulle ? 0.35 : 0.22; redT = dulle ? 0.45 : 0.2;
      flashes.push({ h, t: 0, col: 'bad' });
      api.vibrate(dulle ? [90, 50, 150] : 80); api.sfx(dulle ? 'dulle' : 'falsch');
      pops.add(h.x, h.y - 80, dulle ? 'Die Dulle! −2' : `Foul: ${c.rank}${c.suit} −1`, P_BAD);
      if (dulle) pops.add(h.x, h.y - 102, 'Die haut man nicht.', P_BAD);
    }

    function escape(h) {
      esc++; breakStreak();
      flashes.push({ h, t: 0, col: 'muted' });
      pops.add(h.x, h.y - 30, 'entwischt', P_ESC);
    }

    function finish(why) {
      api.end({ score, text: `${why} ${nines} Neuner aufgespießt, ${esc} entwischt, ${fouls} ${fouls === 1 ? 'Foul' : 'Fouls'}. ${score} Punkte.` });
    }

    function step(dt) {
      t += dt; pops.step(dt);
      if (shake > 0) shake -= dt; if (redT > 0) redT -= dt;
      const k = tune(clamp(t / DAUER, 0, 1));
      api.audio.setIntensity(t / DAUER);
      spawnT -= dt;
      if (spawnT <= 0) spawnT = spawn(k) ? k.every * rand(0.8, 1.2) : 0.08;
      for (const h of holes) {
        if (h.cool > 0) h.cool -= dt;
        const c = h.c; if (!c) continue;
        if (c.foul != null) { c.foul += dt; if (c.foul >= 0.3) { h.c = null; h.cool = 0.25; } continue; }
        c.age += dt;
        if (c.age >= c.rise * 2 + c.hold) { h.c = null; h.cool = 0.25; if (c.rank === '9') escape(h); }
      }
      for (const b of birds) b.t += dt; birds = birds.filter(b => b.t < SWOOP);
      for (const b of bursts) b.t += dt; bursts = bursts.filter(b => b.t < 0.22);
      for (const f of flashes) f.t += dt; flashes = flashes.filter(f => f.t < 0.35);
      for (const f of flyers) { f.t += dt; if (f.t >= FLY && !f.done) { f.done = true; spiked.push(f.s); } }
      flyers = flyers.filter(f => !f.done);
      if (lives <= 0) finish('Drei Fouls. Der Wirt bittet Sie, den Tisch zu verlassen.');
      else if (t >= DAUER) finish('Feierabend.');
    }

    /* ---------- Zeichnen ---------- */

    /* Vereinslogo: Stammtisch mit Wurzeln, eingebrannt ins Holz */
    function logo(ctx, x, y, s) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.strokeStyle = 'rgba(40,22,10,.42)'; ctx.fillStyle = 'rgba(40,22,10,.42)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      rr(ctx, -30, -16, 60, 6, 2); ctx.fill();                                   // Platte
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-20, -10); ctx.lineTo(-20, 6); ctx.moveTo(20, -10); ctx.lineTo(20, 6); ctx.stroke(); // Beine
      ctx.lineWidth = 1.8; ctx.beginPath();                                       // Wurzeln
      for (const lx of [-20, 20]) {
        ctx.moveTo(lx, 5); ctx.quadraticCurveTo(lx - 3, 12, lx - 12, 16);
        ctx.moveTo(lx, 5); ctx.quadraticCurveTo(lx + 1, 13, lx + 3, 19);
        ctx.moveTo(lx, 5); ctx.quadraticCurveTo(lx + 5, 11, lx + 13, 14);
        ctx.moveTo(lx - 7, 13); ctx.lineTo(lx - 10, 19);
      }
      ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-48, 22); ctx.quadraticCurveTo(0, 18, 48, 22); ctx.stroke(); // Erdlinie
      ctx.restore();
    }

    function table(ctx) {
      const { x, y, w, h } = TABLE;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.18)'; rr(ctx, x + 2, y + 5, w, h, 16); ctx.fill();          // Schatten
      ctx.fillStyle = '#93623d'; rr(ctx, x, y, w, h, 16); ctx.fill();
      ctx.save(); rr(ctx, x, y, w, h, 16); ctx.clip();
      // Bretter (längs) mit leichter Tönung und Maserung
      const n = 5, bw = w / n;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(255,230,190,.05)' : 'rgba(60,30,10,.06)'; ctx.fillRect(x + i * bw, y, bw, h);
        ctx.strokeStyle = 'rgba(60,32,14,.22)'; ctx.lineWidth = 1;
        for (let g = 0; g < 3; g++) {
          const gx = x + i * bw + 12 + g * 20 + (i * 7 % 9);
          ctx.beginPath(); ctx.moveTo(gx, y);
          ctx.bezierCurveTo(gx + 6, y + h * .3, gx - 6, y + h * .6, gx + 3, y + h); ctx.stroke();
        }
        if (i) { ctx.strokeStyle = 'rgba(45,24,10,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + i * bw, y); ctx.lineTo(x + i * bw, y + h); ctx.stroke(); }
      }
      // Astloch und Bierglas-Ring
      ctx.fillStyle = 'rgba(55,28,12,.35)'; ctx.beginPath(); ctx.ellipse(x + 3.5 * bw, y + 434, 6, 9, .2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(55,28,12,.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 40, y + 30, 17, .5, Math.PI * 2.3); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = WOOD; ctx.lineWidth = 3; rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 15); ctx.stroke();
      logo(ctx, VW / 2, y + 36, 1.15);
      ctx.restore();
    }

    function holeBack(ctx, h) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,225,180,.18)'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 3, HOLE_RX + 5, HOLE_RY + 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1d120a'; ctx.beginPath(); ctx.ellipse(h.x, h.y, HOLE_RX, HOLE_RY, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2414'; ctx.beginPath(); ctx.ellipse(h.x, h.y - 4, HOLE_RX - 4, HOLE_RY - 6, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function holeFront(ctx, h) {
      ctx.save();
      ctx.strokeStyle = WOOD; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(h.x, h.y, HOLE_RX, HOLE_RY, 0, 0, Math.PI); ctx.stroke();
      ctx.restore();
    }

    function holeCard(ctx, h) {
      const c = h.c; if (!c) return;
      const e = ext(c); if (e <= 0) return;
      let x = h.x, rot = 0;
      if (c.foul != null) { x += Math.sin(c.foul * 70) * 5 * (1 - c.foul / 0.3); rot = Math.sin(c.foul * 50) * .08; }
      ctx.save();
      ctx.beginPath(); ctx.rect(h.x - 60, h.y - 160, 120, 160); ctx.clip();
      card(ctx, x, cardY(h, e), rot, c.rank, c.suit, CS);
      if (c.foul != null) {
        ctx.globalAlpha = .35 * (1 - c.foul / 0.3); ctx.fillStyle = C.bad;
        rr(ctx, x - 26, cardY(h, e) - 36.4, 52, 72.8, 7.8); ctx.fill();
      }
      ctx.restore();
    }

    const easeIn = p => p * p, easeOut = p => 1 - (1 - p) * (1 - p);

    function drawBird(ctx, b) {
      let x, y, vx, vy, wing;
      if (b.t < CONTACT) {
        const p = easeIn(b.t / CONTACT); x = lerp(b.sx, b.cx, p); y = lerp(b.sy, b.cy, p); vx = b.cx - b.sx; vy = b.cy - b.sy; wing = -0.6;
      } else {
        const p = easeOut((b.t - CONTACT) / (SWOOP - CONTACT)); x = lerp(b.cx, b.ex, p); y = lerp(b.cy, b.ey, p); vx = b.ex - b.cx; vy = b.ey - b.cy; wing = Math.sin(b.t * 60);
      }
      const facing = vx >= 0 ? 1 : -1, a = Math.atan2(vy, vx), rot = facing > 0 ? a : a - Math.PI;
      const alpha = b.t > SWOOP - 0.1 ? (SWOOP - b.t) / 0.1 : 1;
      // Fahrtstreifen beim Herabstoßen
      if (b.t < CONTACT + 0.04) {
        ctx.save(); ctx.strokeStyle = C.muted; ctx.globalAlpha = .45; ctx.lineWidth = 2; ctx.lineCap = 'round';
        const len = Math.hypot(vx, vy) || 1, ux = vx / len, uy = vy / len;
        for (const o of [-10, 0, 10]) { ctx.beginPath(); ctx.moveTo(x - ux * 30 - uy * o, y - uy * 30 + ux * o); ctx.lineTo(x - ux * 70 - uy * o, y - uy * 70 + ux * o); ctx.stroke(); }
        ctx.restore();
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      neuntoeter(ctx, 0, 0, { facing, scale: 1.15, wing, mouth: b.t >= CONTACT ? 0.3 : 0, alpha });
      ctx.restore();
    }

    function drawFlyer(ctx, f) {
      if (f.t < 0) { // vor dem Kontakt: Karte springt hoch, wartet auf den Schnabel
        const p = clamp(1 + f.t / CONTACT, 0, 1);
        card(ctx, f.x0, lerp(f.y00, f.y0, easeOut(p)) - 4 * p, 0, '9', f.s, CS);
        return;
      }
      const p = clamp(f.t / FLY, 0, 1), e = p * p * (3 - 2 * p);
      const x = lerp(f.x0, f.x1, e), y = lerp(f.y0, f.y1, e) - Math.sin(Math.PI * p) * 70;
      card(ctx, x, y, f.r * e + p * Math.PI * 2 * (f.x1 < f.x0 ? -1 : 1), '9', f.s, lerp(CS, .7, e));
    }

    function drawBurst(ctx, b) {
      if (b.t < 0) return;
      const p = b.t / 0.22;
      ctx.save(); ctx.globalAlpha = 1 - p;
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + .3, r = 30 + p * 26;
        dorn(ctx, b.x + Math.sin(a) * r, b.y - Math.cos(a) * r, 10 + 10 * (1 - p), a, 6, C.thorn);
      }
      ctx.restore();
    }

    function drawFlash(ctx, f) {
      const p = f.t / 0.35, h = f.h;
      ctx.save(); ctx.globalAlpha = (1 - p) * .9; ctx.strokeStyle = f.col === 'bad' ? C.bad : C.muted; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, HOLE_RX + 4 + p * 16, HOLE_RY + 4 + p * 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    function hud(ctx) {
      hudBar(ctx);
      hudLabel(ctx, 12, 'PUNKTE'); hudLabel(ctx, 100, 'SERIE'); hudLabel(ctx, 190, 'ZEIT'); hudLabel(ctx, 288, 'LEBEN');
      hudValue(ctx, 12, score, C.ch);
      // Serie: drei Kärtchen, gefüllt mit den Farben der aktuellen Dreierserie
      for (let i = 0; i < 3; i++) {
        const x = 100 + i * 16, y = 27, s = last[i]; ctx.lineWidth = 1;
        if (s) {
          ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 13, 18); ctx.strokeStyle = '#111'; ctx.strokeRect(x + .5, y + .5, 12, 17);
          ctx.fillStyle = (s === '♥' || s === '♦') ? '#c0261b' : '#111'; ctx.font = '10px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillText(s, x + 6.5, y + 13); ctx.textAlign = 'left';
        } else { ctx.strokeStyle = C.muted; ctx.strokeRect(x + .5, y + .5, 12, 17); }
      }
      if (streak >= 3) { ctx.font = `600 12px ${MONO}`; ctx.fillStyle = C.gold; ctx.textAlign = 'left'; ctx.fillText('×' + streak, 151, 42); }
      const rest = Math.max(0, DAUER - t);
      hudValue(ctx, 190, Math.ceil(rest) + 's', rest <= 10 ? C.bad : C.ink);
      hudHearts(ctx, 288, lives);
      // Zeitleiste unter dem HUD
      ctx.fillStyle = C.line; ctx.fillRect(0, HUD, VW, 3);
      ctx.fillStyle = rest <= 10 ? C.bad : C.ch; ctx.fillRect(0, HUD, VW * rest / DAUER, 3);
    }

    function draw(ctx) {
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, VW, VH);
      ctx.save();
      if (shake > 0) ctx.translate(Math.sin(t * 90) * 5 * shake / 0.35, Math.cos(t * 70) * 3 * shake / 0.35);
      dornAst(ctx, BRANCH, NT);
      table(ctx);
      if (C.dark) { ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(ctx, TABLE.x, TABLE.y, TABLE.w, TABLE.h, 16); ctx.fill(); }
      spiked.forEach((s, i) => { const p = dornSlot(i, BRANCH, NT); card(ctx, p.x, p.y, p.r, '9', s, .7); });
      for (const h of holes) { holeBack(ctx, h); holeCard(ctx, h); holeFront(ctx, h); }
      for (const f of flashes) drawFlash(ctx, f);
      for (const f of flyers) drawFlyer(ctx, f);
      for (const b of bursts) drawBurst(ctx, b);
      for (const b of birds) drawBird(ctx, b);
      ctx.restore();
      if (redT > 0) { ctx.save(); ctx.globalAlpha = Math.min(.28, redT); ctx.strokeStyle = C.bad; ctx.lineWidth = 18; ctx.strokeRect(0, 0, VW, VH); ctx.restore(); }
      pops.draw(ctx);
      hud(ctx);
    }

    /* Tippen: sofort bei 'down', jede Zelle hat eine große Trefferfläche (ca. 110 × 140) */
    function onPointer(ev) {
      if (ev.type !== 'down') return;
      let best = null, bd = 1e9;
      for (const h of holes) {
        const dx = Math.abs(ev.x - h.x), dy = Math.abs(ev.y - (h.y - 40));
        if (dx > 57 || dy > 80) continue;
        const d = dx * dx + dy * dy * .6; if (d < bd) { bd = d; best = h; }
      }
      if (!best || !best.c || best.c.foul != null) return;
      if (ext(best.c) < 0.15) return;           // gerade erst aufgetaucht / fast weg: zählt nicht
      if (best.c.rank === '9') hitNine(best); else foul(best);
    }

    return { reset, step, draw, onPointer, forceEnd: () => finish('Testabbruch.') };
  },
};
