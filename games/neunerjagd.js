/* Neunerjagd – das Original, auf die Engine portiert. Spielmechanik, Zahlen und Texte unverändert. */
import { card, neuntoeter, dornAst, dornSlot, hintergrund, RANKS, SUITS } from '../core/draw.js';
import { hudBar, hudLabel, hudValue, hudHearts, createPopups } from '../core/hud.js';
import { relDrag } from '../core/input.js';

const BUSH = 572, KMAX = 8, NT = 8;

export default {
  id: 'neunerjagd',
  name: 'Neunerjagd',
  station: 'Dornbusch',
  intro: 'Wischen Sie irgendwo aufs Spielfeld, der Neuntöter fliegt mit. Schlucken Sie Neuner. Sind alle 8 Neuner im Kropf, würgt er sie aus und spießt sie auf.',
  rules: ['Neuner +9 · Auswürgen +27', 'Andere Karte −1 Leben · Dulle (Herz-Zehn) −2', '9 entkommene Neuner: Spielende'],
  startLabel: 'Jagd starten',
  againLabel: 'Nochmal jagen',
  pauseText: 'Der Neuntöter wartet auf dem Dornbusch.',
  titles: [[0, 'Gelbschnabel'], [45, 'Dorndreher'], [150, 'Neunwürger'], [300, 'Neunmörder'], [600, 'Großer Raubwürger']],
  test: { sekunden: 6, gesten: ['drag'] },

  create(api) {
    const { VW, VH, HUD, C } = api;
    const pops = createPopups();
    const drag = relDrag(1.5);
    let bird, cards, spiked, flying, kropf, score, nines, esc, lives, t, spawnT, hurt, wuerg, ejected, face = -1, flap = 0;

    function reset() {
      bird = { x: VW / 2, y: 360, tx: VW / 2, ty: 360 }; cards = []; pops.clear(); spiked = []; flying = []; kropf = [];
      score = 0; nines = 0; esc = 0; lives = 3; t = 0; spawnT = 0.6; hurt = 0; wuerg = 0; ejected = false; drag.end();
    }
    function spawn() {
      const nine = Math.random() < 0.42, suit = SUITS[Math.random() * 4 | 0], rank = nine ? '9' : RANKS[Math.random() * 5 | 0];
      const lvl = 1 + t / 35;
      cards.push({ x: 34 + Math.random() * (VW - 68), y: HUD - 20, vy: (70 + Math.random() * 50) * lvl, ph: Math.random() * 6, sw: 10 + Math.random() * 16, rot: (Math.random() - .5), vr: (Math.random() - .5) * 1.4, rank, suit, nine });
    }
    const slot = i => dornSlot(i, BUSH, NT);
    function end(why) {
      const k2 = kropf.length ? ` ${kropf.length} Neuner stecken noch im Kropf.` : '';
      api.end({ score, text: `${why} ${nines} Neuner aufgespießt, ${score} Punkte.${k2}` });
    }

    function step(dt) {
      t += dt; flap += dt * 14; if (hurt > 0) hurt -= dt;
      pops.step(dt);
      for (const f of flying) { f.p += dt / 0.75; if (f.p >= 1 && !f.done) { f.done = true; spiked.push({ s: f.s }); nines++; } }
      flying = flying.filter(f => !f.done);
      if (wuerg > 0) {
        wuerg -= dt;
        if (!ejected && wuerg < 0.8) {
          ejected = true; const bx = bird.x + (face < 0 ? -40 : 40), by = bird.y - 6;
          kropf.forEach((s, i) => { const g = slot(spiked.length + flying.length); flying.push({ s, x0: bx, y0: by, x1: g.x, y1: g.y, r: g.r, p: -i * 0.07 }); });
          kropf = []; score += 27; pops.add(bird.x, bird.y - 60, 'Gewölle! +27', C.gold); api.vibrate([40, 40, 40]);
        }
        return;
      }
      bird.tx = Math.max(26, Math.min(VW - 26, bird.tx)); bird.ty = Math.max(HUD + 30, Math.min(BUSH - 60, bird.ty));
      const slow = 1 - kropf.length * 0.045, dx = bird.tx - bird.x; if (Math.abs(dx) > 1.5) face = dx < 0 ? -1 : 1;
      bird.x += dx * Math.min(1, dt * 12 * slow); bird.y += (bird.ty - bird.y) * Math.min(1, dt * 12 * slow);
      spawnT -= dt; if (spawnT <= 0) { spawn(); spawnT = Math.max(0.4, 1.05 - t / 60); }
      for (const c of cards) {
        c.y += c.vy * dt; c.rot += c.vr * dt; c.ph += dt * 2; c.cx = c.x + Math.sin(c.ph) * c.sw;
        if (!c.dead && Math.hypot(c.cx - bird.x, c.y - bird.y) < 38) {
          c.dead = true;
          if (c.nine) {
            score += 9; kropf.push(c.suit); pops.add(c.cx, c.y - 20, `+9 geschluckt ${kropf.length}/${KMAX}`, C.ok);
            if (kropf.length >= KMAX) { wuerg = 1.5; ejected = false; pops.add(bird.x, bird.y - 90, 'Hrrk…', C.ch); }
          } else {
            const dulle = c.rank === '10' && c.suit === '♥'; lives -= dulle ? 2 : 1; hurt = 0.6; api.vibrate(dulle ? 200 : 80);
            pops.add(c.cx, c.y - 20, dulle ? 'Die Dulle! −2' : 'Foul: ' + c.rank + c.suit, C.bad);
          }
        }
        if (!c.dead && c.y > VH + 30) { c.dead = true; if (c.nine) { esc++; pops.add(c.cx, BUSH - 50, 'Neuner entkommen', C.bad); } }
      }
      cards = cards.filter(c => !c.dead);
      if (lives <= 0 || esc >= 9) end(lives <= 0 ? 'Zu viele Fouls.' : '9 Neuner sind entkommen. Der Stammtisch ist verseucht.');
    }

    function hud(ctx) {
      hudBar(ctx);
      hudLabel(ctx, 12, 'PUNKTE'); hudLabel(ctx, 96, 'KROPF'); hudLabel(ctx, 224, 'FLUCHT'); hudLabel(ctx, 288, 'LEBEN');
      hudValue(ctx, 12, score, C.ch); hudValue(ctx, 224, esc + '/9', esc >= 6 ? C.bad : C.ink);
      for (let i = 0; i < KMAX; i++) {
        const x = 96 + i * 14, y = 27, s = kropf[i]; ctx.lineWidth = 1;
        if (s) {
          ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 12, 17); ctx.strokeStyle = '#111'; ctx.strokeRect(x + .5, y + .5, 11, 16);
          ctx.fillStyle = (s === '♥' || s === '♦') ? '#c0261b' : '#111'; ctx.font = '10px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillText(s, x + 6, y + 13); ctx.textAlign = 'left';
        } else { ctx.strokeStyle = C.muted; ctx.strokeRect(x + .5, y + .5, 11, 16); }
      }
      hudHearts(ctx, 288, lives);
    }

    function draw(ctx) {
      hintergrund(ctx, t);
      dornAst(ctx, BUSH, NT);
      spiked.forEach((s, i) => { const p = slot(i); card(ctx, p.x, p.y, p.r, '9', s.s, .7); });
      for (const c of cards) card(ctx, c.cx != null ? c.cx : c.x, c.y, c.rot, c.rank, c.suit, 1);
      for (const f of flying) { if (f.p < 0) continue; const p = f.p, e = p * p * (3 - 2 * p); card(ctx, f.x0 + (f.x1 - f.x0) * e, f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * p) * 130, f.r + p * 8, '9', f.s, .7 + .3 * (1 - p)); }
      const sh = wuerg > 0 ? Math.sin(t * 60) * 3 * (wuerg > 0.8 ? 1 : .3) : 0;
      neuntoeter(ctx, bird.x + sh, bird.y, { facing: face, wing: wuerg > 0 ? 0 : Math.sin(flap), mouth: wuerg > 0 && wuerg < 1 ? 0.5 : 0, hurt, belly: kropf.length });
      pops.draw(ctx);
      hud(ctx);
    }

    /* Touch relativ (wie ein Trackpad, Finger verdeckt den Vogel nicht), Maus absolut */
    function onPointer(ev) {
      if (ev.pointer === 'mouse') { if (ev.type === 'move') { bird.tx = ev.x; bird.ty = ev.y; } return; }
      if (ev.type === 'down') drag.start(ev, bird.tx, bird.ty);
      else if (ev.type === 'move') {
        const p = drag.move(ev); if (!p) return;
        bird.tx = p.x; bird.ty = p.y;
        if (bird.tx < 26 || bird.tx > VW - 26 || bird.ty < HUD + 30 || bird.ty > BUSH - 60) {
          bird.tx = Math.max(26, Math.min(VW - 26, bird.tx)); bird.ty = Math.max(HUD + 30, Math.min(BUSH - 60, bird.ty));
          drag.rebase(ev, bird.tx, bird.ty);
        }
      } else drag.end();
    }

    return { reset, step, draw, onPointer, forceEnd: () => end('Testabbruch.') };
  },
};
