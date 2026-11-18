/* Flatterflug – Mechanik à la Flappy Bird, eigene Grafik und eigene Regeln.
   Tippen = Flügelschlag, sonst Schwerkraft. Der Neuntöter fliegt durch Lücken zwischen
   Kartensäulen. Neuner in der Lücke werden aufgespießt (+9), jede passierte Säule +1.
   Dulle, Säule, Boden (Dornenhecke) oder Decke berühren = Ende. */
import { card, neuntoeter, dorn, WOOD, RANKS, SUITS, isDulle } from '../core/draw.js';
import { hud, createPopups } from '../core/hud.js';
import { clamp, lerp, rand, pick } from '../core/util.js';

/* --- Physik und Schwierigkeit (Weltkoordinaten, Sekunden) --- */
const G = 1450;          // Schwerkraft px/s²
const FLAP = 420;        // Flügelschlag: vy wird auf -FLAP gesetzt (Gipfelhöhe ≈ 61 px)
const VMAX = 620;        // maximale Fallgeschwindigkeit
const BX = 96;           // feste x-Position des Vogels
const BR = 12;           // Trefferkreis des Vogels (nur Körper und Kopf, Schwanz/Schnabel nachsichtig)
const CW = 44;           // Breite einer Kartensäule (Trefferzone)
const SPACING = 215;     // Abstand der Säulen (px)
const GROUND = 588;      // Oberkante der Dornenhecke
const THORN = 40;        // Abstand der Dornen in der Hecke
const DULLE_H = 50;      // zusätzliche Lückenhöhe, wenn die Dulle in der Lücke steht
const RAMP = 40;         // nach so vielen Säulen ist die volle Schwierigkeit erreicht
const diff = n => clamp(n / RAMP, 0, 1);
const speedAt = d => 135 + 55 * d;      // 135 → 190 px/s
const gapAt = d => 172 - 42 * d;        // 172 → 130 px freie Lücke
const shiftAt = d => 120 + 50 * d;      // max. Versatz der Lückenmitte zur vorigen Säule
const dulleChance = n => (n < 6 ? 0 : 0.12 + 0.1 * diff(n));
const NINE_CHANCE = 0.6;

export default {
  id: 'flatterflug',
  name: 'Flatterflug',
  station: 'Windwiese',
  intro: 'Tippen Sie irgendwo aufs Spielfeld: Jeder Tipp ist ein Flügelschlag. Fliegen Sie durch die Lücken der Kartensäulen und spießen Sie die Neuner unterwegs auf.',
  rules: ['Säule passiert +1 · Neuner aufgespießt +9', 'Säule, Hecke, Decke oder Dulle berühren: Ende'],
  startLabel: 'Abheben',
  againLabel: 'Nochmal flattern',
  pauseText: 'Der Neuntöter rastet auf einem Weidezaunpfahl.',
  titles: [[0, 'Nesthocker'], [20, 'Ästling'], [60, 'Flatterwart'], [150, 'Luftschriftführer'], [300, 'Ehrenvorsitzender der Lüfte']],
  test: { sekunden: 8, gesten: ['tap', 'hold', 'hold'], zone: [20, 120, 280, 560] },

  create(api) {
    const { VW, VH, HUD, C } = api;
    const pops = createPopups();
    let bird, cols, spiked, flying, score, passed, nines, t, dist, started, dead, deadT, why, shake, flash, pulse, lastGapY, lastThorn, best;

    function reset() {
      bird = { y: 300, vy: 0, flapT: 0, ph: 0, mouth: 0, hurt: 0 };
      cols = []; spiked = []; flying = []; pops.clear();
      score = 0; passed = 0; nines = 0; t = 0; dist = 0; started = false; dead = false; deadT = 0; why = '';
      shake = 0; flash = 0; pulse = 0; lastGapY = 330; lastThorn = 0; best = api.best().score || 0;
    }

    /* --- Säulen --- */
    function stackCards(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        let rank, suit;
        do { rank = pick(RANKS); suit = pick(SUITS); } while (isDulle(rank, suit));
        out.push({ rank, suit, r: i ? rand(-.06, .06) : 0, dx: i ? rand(-2, 2) : 0 });
      }
      return out;
    }
    function spawnCol(x) {
      const n = passed + cols.length, d = diff(n), gap = gapAt(d);
      const dul = Math.random() < dulleChance(n);
      const open = gap + (dul ? DULLE_H : 0);
      // Lage der gesamten Öffnung: Mitte der freien Lücke in Reichweite der vorigen Lücke
      const side = dul ? (Math.random() < .5 ? 1 : -1) : 0;   // 1 = Dulle unten, -1 = Dulle oben
      const lo = HUD + 34 + open / 2, hi = GROUND - 34 - open / 2;
      const freeOff = side * DULLE_H / 2;                       // Versatz freie Mitte → Öffnungsmitte
      const s = shiftAt(d);
      const freeY = clamp(lastGapY + rand(-s, s), lo - freeOff, hi - freeOff);
      lastGapY = freeY;
      const mid = freeY + freeOff, top = mid - open / 2, bot = mid + open / 2;
      let item = null;
      if (dul) item = { kind: 'dulle', y: side > 0 ? bot - 25 : top + 25 };
      if (Math.random() < NINE_CHANCE) item = item ? [item, { kind: 'nine', y: freeY, suit: pick(SUITS) }] : { kind: 'nine', y: freeY, suit: pick(SUITS) };
      const items = item ? [].concat(item) : [];
      cols.push({
        x, top, bot, freeY, items, done: false,
        upper: stackCards(Math.ceil((top - HUD + 40) / 44) + 1),
        lower: stackCards(Math.ceil((VH - bot) / 44) + 1),
      });
    }

    /* Kreis (Vogel) gegen Rechteck */
    function hitRect(cx, cy, r, x0, y0, x1, y1) {
      const nx = clamp(cx, x0, x1), ny = clamp(cy, y0, y1);
      return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
    }

    function die(reason, dulle) {
      if (dead) return;
      dead = true; deadT = 0; why = reason; shake = .35; flash = 1; bird.hurt = 1.2;
      bird.vy = Math.max(bird.vy, -120);
      api.vibrate(dulle ? [120, 60, 200] : 120); api.sfx(dulle ? 'dulle' : 'falsch');
      pops.add(BX + 60, bird.y - 36, dulle ? 'Die Dulle!' : 'Autsch!', C.bad);
    }
    function finish() {
      const n = nines === 1 ? '1 Neuner' : `${nines} Neuner`;
      const s = passed === 1 ? '1 Säule' : `${passed} Säulen`;
      api.end({ score, text: `${why} ${s} passiert, ${n} aufgespießt, ${score} Punkte.` });
    }

    function step(dt) {
      t += dt; pops.step(dt);
      if (shake > 0) shake -= dt; if (flash > 0) flash -= dt * 2.2; if (pulse > 0) pulse -= dt;
      if (bird.hurt > 0) bird.hurt -= dt; if (bird.mouth > 0) bird.mouth -= dt * 3;
      bird.flapT = Math.max(0, bird.flapT - dt);
      bird.ph += dt * (bird.flapT > 0 ? 34 : 6);

      // Aufgespießte Neuner fliegen zur Hecke
      for (const f of flying) { f.p += dt / .6; if (f.p >= 1 && !f.done) { f.done = true; spiked.push({ k: f.k, suit: f.suit }); } }
      flying = flying.filter(f => !f.done);
      spiked = spiked.filter(s => s.k * THORN - dist > -40);

      if (dead) {
        deadT += dt;
        bird.vy = Math.min(VMAX, bird.vy + G * dt); bird.y = Math.min(GROUND - 8, bird.y + bird.vy * dt);
        if (deadT > 1.1) finish();
        return;
      }

      api.audio.setIntensity(diff(passed));
      const v = started ? speedAt(diff(passed)) : speedAt(0);
      dist += v * dt;
      if (!started) { bird.y = 300 + Math.sin(t * 3) * 8; bird.vy = 0; return; }

      bird.vy = Math.min(VMAX, bird.vy + G * dt);
      bird.y += bird.vy * dt;

      // Säulen bewegen, erzeugen, abbauen
      for (const c of cols) c.x -= v * dt;
      const last = cols[cols.length - 1];
      if (!last) spawnCol(VW + 60); else if (last.x < VW + 40 - SPACING + CW) spawnCol(last.x + SPACING);
      cols = cols.filter(c => c.x > -CW);

      // Kollisionen: Vogel-Trefferkreis etwas vor der Mitte (Körper + Kopf)
      const cx = BX + 2, cy = bird.y + 1;
      if (cy - BR < HUD) { bird.y = HUD + BR; return die('Zu hoch geflogen. Über dem Stammtisch ist die Luft dünn.'); }
      if (cy + BR > GROUND) { bird.y = GROUND - BR; return die('In der Dornenhecke gelandet. Falsche Seite des Dorns.'); }
      for (const c of cols) {
        const x0 = c.x - CW / 2, x1 = c.x + CW / 2;
        if (hitRect(cx, cy, BR, x0, -999, x1, c.top) || hitRect(cx, cy, BR, x0, c.bot, x1, 9999)) return die('Gegen die Kartensäule geflattert.');
        for (const it of c.items) {
          const iy = it.y + (it.kind === 'nine' ? Math.sin(t * 3 + c.x * .02) * 6 : 0);
          if (it.kind === 'dulle') {
            if (hitRect(cx, cy, BR, c.x - 15, iy - 21, c.x + 15, iy + 21)) return die('Die Dulle berührt man nicht.', true);
          } else if (!it.taken && Math.hypot(c.x - cx, iy - cy) < 28) {
            it.taken = true; nines++; score += 9; pulse = .5; bird.mouth = 1;
            pops.add(BX + 70, cy - 30, '+9 aufgespießt', C.ok); api.vibrate(25); api.sfx('neuner');
            let k = Math.ceil((dist + c.x + 60) / THORN); k = Math.max(k, lastThorn + 1); lastThorn = k;
            flying.push({ k, suit: it.suit, p: 0, wx: dist + c.x, wy: iy });
          }
        }
        if (!c.done && c.x + CW / 2 < cx - BR) {
          c.done = true; passed++; score += 1; if (pulse <= 0) pulse = .25;
          if (!c.items.some(i => i.kind === 'nine' && i.taken)) pops.add(BX + 40, cy - 30, '+1', C.muted);
        }
      }
    }

    /* --- Zeichnen --- */
    function landschaft(ctx) {
      ctx.save();
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, VW, VH);
      // weiche Wolken (wie Neunerjagd-Hintergrund), langsam
      ctx.fillStyle = C.line; ctx.globalAlpha = .5;
      for (let i = 0; i < 5; i++) {
        const x = ((i * 157 - dist * .08) % (VW + 120) + VW + 120) % (VW + 120) - 60;
        ctx.beginPath(); ctx.arc(x, HUD + 50 + (i * 61) % 200, 22 + i * 6, 0, Math.PI * 2); ctx.fill();
      }
      // ferne Hügel (Windwiese)
      ctx.globalAlpha = .55; ctx.beginPath(); ctx.moveTo(0, VH);
      for (let x = 0; x <= VW; x += 8) { const w = (x + dist * .2) * .012; ctx.lineTo(x, 500 + Math.sin(w) * 18 + Math.sin(w * 2.3 + 1) * 9); }
      ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.thorn; ctx.globalAlpha = .12; ctx.beginPath(); ctx.moveTo(0, VH);
      for (let x = 0; x <= VW; x += 8) { const w = (x + dist * .45) * .018; ctx.lineTo(x, 548 + Math.sin(w) * 12 + Math.sin(w * 1.7 + 2) * 6); }
      ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
      // Windstriche
      ctx.globalAlpha = .9; ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const x = VW + 40 - ((dist * 1.6 + i * 131) % (VW + 120)), y = HUD + 40 + (i * 83) % 420;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 14, y - 4, x + 30, y); ctx.stroke();
      }
      ctx.restore();
    }

    function saeule(ctx, c) {
      // obere Säule: äußere Karten zuerst, Kante zuletzt (liegt oben)
      for (let i = c.upper.length - 1; i >= 0; i--) { const k = c.upper[i]; card(ctx, c.x + k.dx, c.top - 31 - i * 44, k.r, k.rank, k.suit, 1.1); }
      for (let i = c.lower.length - 1; i >= 0; i--) { const k = c.lower[i]; card(ctx, c.x + k.dx, c.bot + 31 + i * 44, k.r, k.rank, k.suit, 1.1); }
      for (const it of c.items) {
        if (it.kind === 'dulle') {
          // Heiligenschein: die Dulle steht unberührbar in der Lücke
          ctx.save(); ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.globalAlpha = .55 + Math.sin(t * 5) * .25;
          ctx.beginPath(); ctx.ellipse(c.x, it.y, 27, 33, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
          card(ctx, c.x, it.y, Math.sin(t * 2) * .05, '10', '♥', .85);
        } else if (!it.taken) {
          const y = it.y + Math.sin(t * 3 + c.x * .02) * 6;
          card(ctx, c.x, y, Math.sin(t * 2.4 + c.x) * .15, '9', it.suit, .75);
        }
      }
    }

    function hecke(ctx) {
      ctx.save();
      const off = dist % 30;
      ctx.fillStyle = C.thorn; ctx.globalAlpha = .3; ctx.beginPath();
      ctx.rect(0, GROUND + 14, VW, VH - GROUND);
      for (let x = -off - 30; x < VW + 30; x += 30) ctx.moveTo(x + 22, GROUND + 18), ctx.arc(x, GROUND + 18, 22, 0, Math.PI * 2);
      ctx.fill(); ctx.globalAlpha = 1;
      // Ast mit Dornen
      ctx.strokeStyle = WOOD; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
      for (let x = 0; x <= VW; x += 12) { const y = GROUND + 20 + Math.sin((x + dist) * .03) * 3; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.restore();
      const k0 = Math.floor(dist / THORN), occupied = new Map(spiked.map(s => [s.k, s]));
      for (let k = k0; k * THORN - dist < VW + 30; k++) {
        const x = k * THORN - dist, base = GROUND + 20 + Math.sin(k * THORN * .03) * 3, ang = k % 2 ? .3 : -.3;
        dorn(ctx, x, base, 24, ang);
        const s = occupied.get(k);
        if (s) { card(ctx, x + Math.sin(ang) * 14, base - 16, ang, '9', s.suit, .55); dorn(ctx, x, base, 24, ang, 4); }
      }
      for (const f of flying) {
        const p = clamp(f.p, 0, 1), e = p * p * (3 - 2 * p), tx = f.k * THORN, ty = GROUND + 4;
        card(ctx, lerp(f.wx, tx, e) - dist, lerp(f.wy, ty, e) - Math.sin(Math.PI * p) * 60, p * 7, '9', f.suit, .75 - .2 * p);
      }
    }

    function vogel(ctx) {
      const ang = dead ? Math.min(1.3, .4 + deadT * 2) : started ? clamp(bird.vy / VMAX * 1.1, -.45, 1.1) : Math.sin(t * 3) * .05;
      const wing = bird.flapT > 0 || !started ? Math.sin(bird.ph) : -.4 + Math.sin(bird.ph) * .25;
      ctx.save(); ctx.translate(BX, bird.y); ctx.rotate(ang);
      neuntoeter(ctx, 0, 0, { facing: 1, scale: .8, wing: dead ? 0 : wing, mouth: dead ? .6 : Math.max(0, bird.mouth), hurt: bird.hurt });
      ctx.restore();
    }

    function hinweis(ctx) {
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const a = .5 + Math.sin(t * 4) * .3;
      ctx.strokeStyle = C.ch; ctx.lineWidth = 2.5; ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(VW / 2, 418, 16 + (t * 30) % 14, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = C.ch; ctx.beginPath(); ctx.arc(VW / 2, 418, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.ink; ctx.font = '700 20px "Alegreya Sans",sans-serif'; ctx.fillText('Tippen Sie zum Flattern.', VW / 2, 380);
      ctx.fillStyle = C.muted; ctx.font = '16px "Alegreya Sans",sans-serif'; ctx.fillText('Jeder Tipp ein Flügelschlag.', VW / 2, 464);
      ctx.restore();
    }

    function draw(ctx) {
      ctx.save();
      if (shake > 0) ctx.translate(Math.sin(t * 90) * 5 * shake / .35, Math.cos(t * 77) * 4 * shake / .35);
      landschaft(ctx);
      for (const c of cols) saeule(ctx, c);
      hecke(ctx);
      vogel(ctx);
      if (!started && !dead) hinweis(ctx);
      pops.draw(ctx);
      ctx.restore();
      if (flash > 0) { ctx.save(); ctx.fillStyle = C.bad; ctx.globalAlpha = clamp(flash, 0, 1) * .28; ctx.fillRect(0, 0, VW, VH); ctx.restore(); }
      hud(ctx, [
        { x: 12, label: 'PUNKTE', value: score, color: pulse > 0 ? C.gold : C.ch },
        { x: 110, label: 'SÄULEN', value: passed },
        { x: 208, label: 'NEUNER', value: nines, color: C.ok },
        { x: 288, label: 'BESTE', value: Math.max(best, score), color: C.muted },
      ]);
    }

    function onPointer(ev) {
      if (ev.type !== 'down' || dead) return;
      started = true;
      bird.vy = -FLAP; bird.flapT = .22; api.sfx('flatter');
    }

    return { reset, step, draw, onPointer, forceEnd: () => { if (!why) why = 'Testabbruch.'; finish(); } };
  },
};
