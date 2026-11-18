/* Kartenhaus – Schleuder-Spiel mit Starrkörper-Physik (matter.js, vendort in games/kartenhaus/vendor/).
   Der Neuntöter sitzt in der Astgabel des Dornbuschs. Zurückziehen, loslassen, Kartenhäuser
   auf dem Stammtisch einreißen. Ein Neuner, der auf der Tischplatte (oder darunter) landet, ist
   erledigt und wird auf den Dornbusch gespießt. Fällt die Dulle, gibt es Abzug.
   Dateien: level.js (Level-Daten), welt.js (Physik), vendor/ (matter.js + Lizenz). */
import { card, neuntoeter, dorn, hintergrund, rr, WOOD } from '../core/draw.js';
import { hudBar, hudLabel, hudValue, createPopups } from '../core/hud.js';
import { clamp } from '../core/util.js';
import { LEVELS, T, KL, KD } from './kartenhaus/level.js';
import { createWelt, vorschau, FLOOR, FORK, KRAFT, MAXZUG } from './kartenhaus/welt.js';

const WUERFE = 3, P_NEUN = 9, P_WURF = 15, P_DULLE = 18;
const LINIE = T - 28;                          // Mittelpunkt eines Neuners darunter = liegt auf dem Tisch
const MONO = '"IBM Plex Mono",monospace', BODY = '"Alegreya Sans",system-ui,sans-serif', GOT = '"Grenze Gotisch",Georgia,serif';
const BTN = { x: 80, y: 392, w: 200, h: 50 };  // Knopf im Level-geschafft-Fenster

export default {
  id: 'kartenhaus',
  name: 'Kartenhaus',
  station: 'Kartenbaustelle',
  intro: 'Die Neuner haben auf dem Stammtisch Kartenhäuser gebaut. Ziehen Sie den Neuntöter in der Astgabel zurück und lassen Sie los. Jeder Neuner, der auf der Tischplatte landet, ist erledigt.',
  rules: [`Neuner +${P_NEUN} · Übriger Wurf +${P_WURF}`, `Die Dulle fällt: −${P_DULLE}`, `${WUERFE} Würfe pro Haus · ${LEVELS.length} Häuser`],
  startLabel: 'Abriss beantragen',
  againLabel: 'Neuer Bauantrag',
  pauseText: 'Baustopp. Die Karten bleiben, wo sie sind.',
  titles: [[0, 'Bauantragsteller'], [45, 'Hilfspolier'], [100, 'Abrissbeauftragter'], [170, 'Leiter des Bauordnungsamts'], [240, 'Großer Einreißer']],
  test: { sekunden: 8, gesten: ['drag'], zone: [30, 440, 130, 540] },

  create(api) {
    const { VW, VH, HUD, C } = api;
    const pops = createPopups();
    let welt, lvl, phase, score, wuerfe, t, pt, zug, dots, spiked, flying, banner, frei, bilanz, ruhT, birdAng, dullen, startLvl;

    const neuner = () => welt.teile.filter(x => x.k === 'neun');
    const offen = () => neuner().filter(x => !x.out).length;

    function reset() {
      pops.clear(); score = 0; t = 0;
      frei = clamp(api.load('frei', 1) | 0, 1, LEVELS.length);
      if (frei > 1) { phase = 'wahl'; lvl = 0; welt = createWelt(LEVELS[0]); spiked = []; flying = []; zug = null; dots = null; wuerfe = WUERFE; banner = 0; }
      else starte(0);
      startLvl = lvl;
    }
    const stoss = v => api.sfx('klack', { v });   // Karten stoßen zusammen (Abklingzeit im Ton-Kern)
    function starte(i) {
      api.audio.setIntensity(i / (LEVELS.length - 1));
      lvl = i; welt = createWelt(LEVELS[i], stoss); wuerfe = WUERFE; phase = 'bereit'; pt = 0;
      zug = null; dots = null; spiked = []; flying = []; banner = 3; dullen = 0; birdAng = 0;
    }
    function ende(text) { api.end({ score, text }); }
    function gesamtText(prefix) {
      const h = lvl - startLvl + (phase === 'fertig' ? 1 : 0);
      return `${prefix} ${h} ${h === 1 ? 'Haus' : 'Häuser'} geräumt, ${score} Punkte.`;
    }

    /* ---------- Spiellogik ---------- */
    function step(dt) {
      t += dt; pt += dt; pops.step(dt); if (banner > 0) banner -= dt;
      for (const f of flying) { f.p += dt / .8; if (f.p >= 1 && !f.done) { f.done = true; spiked.push(f.suit); } }
      flying = flying.filter(f => !f.done);
      if (phase === 'wahl' || phase === 'fertig') return;
      welt.step(dt);
      pruefe(dt);
      const b = welt.bird;
      if (phase === 'flug') {
        if (b && b.speed > 1) birdAng = Math.atan2(b.velocity.y, b.velocity.x);
        const p = b && b.position;
        const weg = !b || p.x > VW + 40 || p.x < -40 || p.y > FLOOR + 40;
        ruhT = (b && (b.isSleeping || b.speed < .3)) ? ruhT + dt : 0;
        if (weg || ruhT > .7 || pt > 7 || offen() === 0) { phase = 'ruhe'; pt = 0; }
      } else if (phase === 'ruhe') {
        const fertig = offen() === 0;
        if ((fertig && pt > .8 && flying.length === 0 && neuner().every(x => x.spiess)) || (!fertig && (welt.ruhig() && pt > .6 || pt > 4))) auswerten();
      }
    }
    /* Neuner/Dulle unter der Linie oder aus dem Bild? */
    function pruefe(dt) {
      for (const x of welt.teile) {
        if (x.k === 'karte') continue;
        const p = x.body.position, unten = x.weg || p.y > LINIE || p.x < -20 || p.x > VW + 20;
        if (!x.out && unten) {
          x.out = true;
          if (x.k === 'neun') { score += P_NEUN; pops.add(clamp(p.x, 40, VW - 40), Math.min(p.y, T) - 30, `+${P_NEUN} erledigt`, C.ok); api.vibrate(25); api.sfx('neuner'); }
          else { score -= P_DULLE; dullen++; pops.add(clamp(p.x, 40, VW - 40), Math.min(p.y, T) - 30, `Die Dulle! −${P_DULLE}`, C.bad); api.vibrate(200); api.sfx('dulle'); }
        }
        if (x.out && x.k === 'neun' && !x.spiess) {
          x.outT += dt;
          if (x.outT > .7) {    // auf den Dornbusch spießen
            x.spiess = true; const q = x.weg ? { x: clamp(p.x, 20, VW - 20), y: Math.min(p.y, FLOOR) } : p;
            flying.push({ suit: x.suit, x0: q.x, y0: q.y, r0: x.body.angle, slot: spiked.length + flying.length, p: 0 });
            welt.entferne(x);
          }
        }
      }
    }
    function auswerten() {
      welt.vogelWeg();
      if (offen() === 0) {
        const bonus = wuerfe * P_WURF; score += bonus;
        const n = neuner().length;
        bilanz = { n, bonus, dullen };
        frei = Math.max(frei, Math.min(LEVELS.length, lvl + 2)); api.save('frei', frei);
        if (lvl === LEVELS.length - 1) { phase = 'fertig'; ende(gesamtText('Alle Häuser abgerissen. Der Gegenverein ist aufgelöst.')); return; }
        phase = 'fertig'; pt = 0; api.vibrate([30, 40, 30]); api.sfx('prompt');
      } else if (wuerfe > 0) { phase = 'bereit'; pt = 0; }
      else ende(gesamtText(`Haus ${lvl + 1} steht noch, ${offen()} Neuner ${offen() === 1 ? 'hält' : 'halten'} die Stellung.`));
    }

    /* ---------- Eingabe ---------- */
    function onPointer(ev) {
      if (ev.pointer === 'mouse' && ev.type === 'move' && !ev.pressed) return;
      if (phase === 'wahl') { if (ev.type === 'down') wahlTipp(ev); return; }
      if (phase === 'fertig') {
        if (ev.type === 'down' && pt > .5 && ev.x > BTN.x - 10 && ev.x < BTN.x + BTN.w + 10 && ev.y > BTN.y - 10 && ev.y < BTN.y + BTN.h + 10) { api.sfx('tap'); starte(lvl + 1); }
        return;
      }
      if (phase !== 'bereit') return;
      if (ev.type === 'down') {
        // großzügig: irgendwo links unten anfassen (der Finger muss den Vogel nicht verdecken)
        if (ev.x < 170 && ev.y > HUD + 120) { zug = { id: ev.id, fx: ev.x, fy: ev.y, dx: 0, dy: 0, ton: 0 }; dots = null; }
      } else if (zug && ev.id === zug.id) {
        if (ev.type === 'move') {
          let dx = ev.x - zug.fx, dy = ev.y - zug.fy; const l = Math.hypot(dx, dy);
          if (l > MAXZUG) { dx *= MAXZUG / l; dy *= MAXZUG / l; }
          zug.dx = dx; zug.dy = dy;
          dots = l > 12 ? vorschau(FORK.x + dx, FORK.y + dy, -dx * KRAFT, -dy * KRAFT) : null;
          const lz = Math.min(l, MAXZUG); if (Math.abs(lz - zug.ton) > 6) { zug.ton = lz; api.sfx('spannen', { amount: lz / MAXZUG }); }
        } else if (ev.type === 'up' && Math.hypot(zug.dx, zug.dy) > 12) {
          welt.wirf(FORK.x + zug.dx, FORK.y + zug.dy, -zug.dx * KRAFT, -zug.dy * KRAFT);
          birdAng = Math.atan2(-zug.dy, -zug.dx);
          wuerfe--; phase = 'flug'; pt = 0; ruhT = 0; zug = null; dots = null; api.vibrate(15); api.sfx('schleudern');
        } else { zug = null; dots = null; }
      }
    }
    const wahlKnopf = i => ({ x: 34 + (i % 2) * 150, y: 210 + (i / 2 | 0) * 72, w: 142, h: 60 });
    function wahlTipp(ev) {
      for (let i = 0; i < frei; i++) { const k = wahlKnopf(i); if (ev.x > k.x && ev.x < k.x + k.w && ev.y > k.y && ev.y < k.y + k.h) { startLvl = i; api.sfx('tap'); starte(i); return; } }
    }

    /* ---------- Zeichnen ---------- */
    function hauskarte(ctx, b) {
      ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.3; rr(ctx, -KL / 2, -KD / 2, KL, KD, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8c3b1f'; ctx.fillRect(-KL / 2 + 3, -.6, KL - 6, 1.4);   // Rückseite angedeutet
      ctx.restore();
    }
    function tisch(ctx) {
      const [x0, x1] = welt.tisch;
      ctx.save();
      ctx.fillStyle = WOOD;
      ctx.fillRect(x0 + 10, T + 14, 9, FLOOR - T - 14); ctx.fillRect(x1 - 19, T + 14, 9, FLOOR - T - 14);
      rr(ctx, x0, T, x1 - x0, 14, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x0 + 3, T + 2, x1 - x0 - 6, 2);
      // Linie: Neuner darunter = erledigt
      ctx.strokeStyle = C.bad; ctx.globalAlpha = .55; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(x0 - 6, T - 1); ctx.lineTo(VW, T - 1); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.fillStyle = C.muted; ctx.font = `600 9px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('NEUNER AUF DEM TISCH', (x0 + x1) / 2, T + 32); ctx.fillText('= ERLEDIGT', (x0 + x1) / 2, T + 43);
      ctx.restore();
    }
    const slot = i => ({ x: 14 + (i % 7) * 15, y: 588 - (i % 7) * 4 - (i / 7 | 0) * 8, r: (i % 2 ? .3 : -.3) });
    function busch(ctx) {
      ctx.save();
      ctx.fillStyle = C.thorn; ctx.globalAlpha = .25; ctx.beginPath(); ctx.ellipse(55, FLOOR + 6, 95, 46, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      // Astgabel
      ctx.strokeStyle = WOOD; ctx.lineCap = 'round'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(FORK.x + 4, FLOOR); ctx.quadraticCurveTo(FORK.x - 2, 540, FORK.x, 515); ctx.stroke();
      ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(FORK.x, 517); ctx.quadraticCurveTo(FORK.x - 16, 500, FORK.x - 14, FORK.y - 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(FORK.x, 517); ctx.quadraticCurveTo(FORK.x + 16, 500, FORK.x + 13, FORK.y - 12); ctx.stroke();
      dorn(ctx, FORK.x - 3, 548, 14, -1.2, 5); dorn(ctx, FORK.x + 4, 532, 13, 1.1, 5); dorn(ctx, FORK.x - 10, 497, 11, -.9, 4); dorn(ctx, FORK.x + 10, 495, 11, .9, 4);
      // Ast mit Dornen für die erlegten Neuner
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 600); ctx.quadraticCurveTo(60, 592, 118, 568); ctx.stroke();
      for (let i = 0; i < 7; i++) { const s = slot(i); dorn(ctx, s.x, s.y + 8, 15, s.r, 5); }
      ctx.restore();
    }
    function gummi(ctx, bx, by) {
      ctx.save(); ctx.strokeStyle = '#3b2416'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(FORK.x - 14, FORK.y - 10); ctx.lineTo(bx, by); ctx.lineTo(FORK.x + 13, FORK.y - 12); ctx.stroke(); ctx.restore();
    }
    function vogel(ctx, x, y, ang, o = {}) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      neuntoeter(ctx, 0, 0, { facing: 1, scale: .5, ...o }); ctx.restore();
    }
    function hud(ctx) {
      hudBar(ctx);
      hudLabel(ctx, 12, 'PUNKTE'); hudLabel(ctx, 100, 'HAUS'); hudLabel(ctx, 168, 'NEUNER'); hudLabel(ctx, 258, 'WÜRFE');
      hudValue(ctx, 12, score, C.ch); hudValue(ctx, 100, `${lvl + 1}/${LEVELS.length}`);
      const n = neuner().length; hudValue(ctx, 168, `${n - offen()}/${n}`, offen() === 0 ? C.ok : C.ink);
      ctx.save();
      for (let i = 0; i < WUERFE; i++) {
        ctx.beginPath(); ctx.arc(266 + i * 22, 38, 7, 0, Math.PI * 2);
        if (i < wuerfe) { ctx.fillStyle = '#9b4a26'; ctx.fill(); } else { ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
      ctx.restore();
    }
    function fenster(ctx, y, h) {
      ctx.save(); ctx.fillStyle = C.veil; ctx.fillRect(0, HUD, VW, VH - HUD);
      ctx.fillStyle = C.bg; ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; rr(ctx, 22, y, VW - 44, h, 14); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    function text(ctx, s, x, y, font, color, align = 'center') {
      ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
    }
    function knopf(ctx, k, label, an = true) {
      ctx.save(); rr(ctx, k.x, k.y, k.w, k.h, k.h / 2); ctx.fillStyle = an ? C.ch : C.line; ctx.fill();
      text(ctx, label, k.x + k.w / 2, k.y + k.h / 2 + 6, `700 18px ${BODY}`, an ? '#fff' : C.muted); ctx.restore();
    }

    function draw(ctx) {
      hintergrund(ctx, t);
      ctx.save(); ctx.fillStyle = C.line; ctx.fillRect(0, FLOOR, VW, VH - FLOOR); ctx.fillStyle = C.muted; ctx.globalAlpha = .5; ctx.fillRect(0, FLOOR, VW, 2); ctx.restore();
      tisch(ctx);
      busch(ctx);
      spiked.forEach((s, i) => { const p = slot(i); card(ctx, p.x, p.y, p.r, '9', s, .45); });
      for (const x of welt.teile) {
        if (x.weg) continue;
        const b = x.body;
        if (x.k === 'karte') hauskarte(ctx, b);
        else card(ctx, b.position.x, b.position.y, b.angle, x.k === 'dulle' ? '10' : '9', x.k === 'dulle' ? '♥' : x.suit, .75);
      }
      for (const f of flying) {
        const p = f.p, e = p * p * (3 - 2 * p), s = slot(f.slot);
        card(ctx, f.x0 + (s.x - f.x0) * e, f.y0 + (s.y - f.y0) * e - Math.sin(Math.PI * p) * 90, f.r0 + (s.r - f.r0) * e + p * 6.283, '9', f.suit, .75 - .3 * e);
      }
      // Vogel: in der Gabel (mit Gummi), im Flug, oder wartend
      const b = welt.bird;
      if (phase === 'bereit') {
        const bx = FORK.x + (zug ? zug.dx : 0), by = FORK.y + (zug ? zug.dy : 0);
        if (dots) { ctx.save(); ctx.fillStyle = C.ch; dots.forEach((d, i) => { ctx.globalAlpha = .85 - i * .06; ctx.beginPath(); ctx.arc(d.x, d.y, 3.2 - i * .15, 0, Math.PI * 2); ctx.fill(); }); ctx.restore(); }
        vogel(ctx, bx, by, zug ? Math.atan2(-zug.dy, -zug.dx) * .6 : 0);
        gummi(ctx, bx - (zug ? 6 * zug.dx / (Math.hypot(zug.dx, zug.dy) || 1) : 0), by + 2);
      } else {
        gummi(ctx, FORK.x, FORK.y - 4);
        if (b) vogel(ctx, b.position.x, b.position.y, birdAng, { wing: phase === 'flug' && b.speed > 2 ? Math.sin(t * 22) : 0 });
      }
      pops.draw(ctx);
      if (banner > 0 && phase !== 'wahl') {
        ctx.save(); ctx.globalAlpha = clamp(banner, 0, 1);
        text(ctx, `Haus ${lvl + 1}: ${LEVELS[lvl].name}`, VW / 2, HUD + 40, `800 30px ${GOT}`, C.ch);
        text(ctx, LEVELS[lvl].text, VW / 2, HUD + 64, `400 16px ${BODY}`, C.muted);
        ctx.restore();
      }
      if (phase === 'bereit' && pt < 6 && !zug && wuerfe === WUERFE && lvl === 0) {
        ctx.save(); ctx.globalAlpha = .5 + .5 * Math.sin(t * 4);
        text(ctx, 'Vogel zurückziehen, loslassen', 12, FORK.y - 44, `600 12px ${MONO}`, C.muted, 'left'); ctx.restore();
      }
      if (phase === 'fertig' && bilanz && lvl < LEVELS.length - 1) {
        fenster(ctx, 170, 290);
        text(ctx, 'Haus geräumt', VW / 2, 222, `800 38px ${GOT}`, C.ch);
        const z = [[`Neuner ${bilanz.n} × ${P_NEUN}`, `+${bilanz.n * P_NEUN}`], [`Übrige Würfe`, `+${bilanz.bonus}`]];
        if (bilanz.dullen) z.push(['Dulle gefallen', `−${bilanz.dullen * P_DULLE}`]);
        z.push(['Stand', String(score)]);
        z.forEach(([a, v], i) => { text(ctx, a, 52, 262 + i * 26, `400 16px ${BODY}`, i === z.length - 1 ? C.ink : C.muted, 'left'); text(ctx, v, VW - 52, 262 + i * 26, `600 16px ${MONO}`, C.ink, 'right'); });
        knopf(ctx, BTN, `Haus ${lvl + 2} ›`, pt > .5);
      }
      if (phase === 'wahl') {
        fenster(ctx, 120, 320);
        text(ctx, 'Welches Haus?', VW / 2, 172, `800 34px ${GOT}`, C.ch);
        text(ctx, 'Geräumte Häuser sind freigegeben.', VW / 2, 196, `400 14px ${BODY}`, C.muted);
        LEVELS.forEach((L, i) => {
          const k = wahlKnopf(i), an = i < frei;
          ctx.save(); rr(ctx, k.x, k.y, k.w, k.h, 10); ctx.fillStyle = an ? C.paper : C.bg; ctx.fill(); ctx.strokeStyle = an ? C.ch : C.line; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
          text(ctx, `HAUS ${i + 1}`, k.x + 12, k.y + 22, `600 11px ${MONO}`, an ? C.ch : C.muted, 'left');
          text(ctx, an ? L.name : 'nicht genehmigt', k.x + 12, k.y + 44, `700 14px ${BODY}`, an ? C.ink : C.muted, 'left');
        });
      }
      hud(ctx);
    }

    return {
      reset, step, draw, onPointer,
      forceEnd: () => ende(`Testabbruch. ${score} Punkte.`),
    };
  },
};
