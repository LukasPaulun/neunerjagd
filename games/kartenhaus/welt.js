/* Kartenhaus – Physik-Welt (matter.js). Kein DOM, nur Zahlen; darum auch in Node testbar.
   matter.js kommt als ES-Modul-Hülle (vendor/matter.esm.js, erzeugt von vendor/make_esm.py).

   Stabilität:
   - Feste Teilschritte (180 Hz) statt Bildrate; mehr Lösungs-Iterationen.
   - Alle Hausteile starten schlafend (wirken wie statisch), bis sich etwas Bewegtes nähert.
     matter weckt nur bei direktem Kontakt; zusätzlich weckt wake() schlafende Teile, deren
     Hülle ein bewegtes Teil berührt (sonst blieben Decken in der Luft hängen, wenn die Wand
     darunter weggeschoben wird). Ruhende Teile schlafen nach ca. 1 s wieder ein: kein Zittern. */
import M from './vendor/matter.esm.js';
import { T, KL, KD, FW, FH } from './level.js';

const { Engine, Bodies, Body, Composite, Sleeping, Events } = M;
export const FLOOR = 600, BIRD_R = 13, SUB = 1000 / 180;
export const FORK = { x: 126, y: 470 };    // Ruheplatz des Vogels in der Astgabel
export const ZUGWEG = .6;                   // Vogel wandert beim Ziehen um diesen Anteil des Auszugs zurück (Abwurfpunkt)
export const MAXZUG = 78;
/* Abwurf: Tempo (px pro 16,7 ms) wächst linear mit dem Auszug von VMIN·VMAX (kurz gezogen) bis VMAX
   (voll gezogen). So reichen auch kurze Züge bis zum Tisch (sanfte Lobs), und der volle Zug ist kein
   Alles-oder-nichts. Vogel leicht genug, dass ein Treffer ein Haus nicht ganz umwirft. */
export const TUNE = { vmax: 11, vmin: 0.55, dichte: 0.003, haft: 0.8, reib: 0.6 };   // haft/reib: Haft-/Gleitreibung der Hauskarten
export function abschuss(dx, dy) {
  const l = Math.hypot(dx, dy) || 1, v = TUNE.vmax * (TUNE.vmin + (1 - TUNE.vmin) * Math.min(1, l / MAXZUG));
  return { vx: -dx / l * v, vy: -dy / l * v };
}
Sleeping._motionSleepThreshold = 0.05;      // erst bei fast völligem Stillstand einschlafen

const KARTE = { restitution: .02, density: .0012 };   // Reibung aus TUNE
const FACE = { friction: .8, frictionStatic: 1.2, restitution: .02, density: .001 };

function engine() { return Engine.create({ enableSleeping: true, positionIterations: 12, velocityIterations: 10 }); }

/* onStoss(v): optional, bei jedem neuen Kontakt mit Relativtempo v > 1.5 (für Klack-Geräusche) */
export function createWelt(level, onStoss) {
  const eng = engine();
  if (onStoss) Events.on(eng, 'collisionStart', e => {
    for (const p of e.pairs) {
      const a = p.bodyA.velocity, b = p.bodyB.velocity, v = Math.hypot(a.x - b.x, a.y - b.y);
      if (v > 1.5) { onStoss(v); return; }
    }
  });
  const [x0, x1] = level.tisch;
  const statics = [
    Bodies.rectangle((x0 + x1) / 2, T + 7, x1 - x0, 14, { isStatic: true, friction: 1, frictionStatic: 2 }),
    Bodies.rectangle(180, FLOOR + 30, 800, 60, { isStatic: true, friction: .8 }),
  ];
  const teile = level.teile.map(p => {
    const body = p.k === 'karte'
      ? Bodies.rectangle(p.x, p.y, KL, KD, { ...KARTE, friction: TUNE.reib, frictionStatic: TUNE.haft, angle: p.a })
      : Bodies.rectangle(p.x, p.y, FW, FH, { ...FACE });
    return { k: p.k, suit: p.suit || '♥', body, out: false, outT: 0, weg: false };
  });
  Composite.add(eng.world, statics.concat(teile.map(t => t.body)));
  for (const t of teile) Sleeping.set(t.body, true);
  let acc = 0, bird = null;

  function wake() {
    const moving = teile.filter(t => !t.weg && !t.body.isSleeping && (t.body.speed > .25 || t.body.angularSpeed > .01)).map(t => t.body);
    if (bird && !bird.isSleeping && bird.speed > .25) moving.push(bird);
    if (!moving.length) return;
    for (const t of teile) {
      if (t.weg || !t.body.isSleeping) continue;
      const a = t.body.bounds;
      for (const m of moving) {
        const b = m.bounds;
        if (a.min.x - 2 < b.max.x && a.max.x + 2 > b.min.x && a.min.y - 2 < b.max.y && a.max.y + 2 > b.min.y) { Sleeping.set(t.body, false); break; }
      }
    }
  }

  return {
    teile, tisch: level.tisch,
    get bird() { return bird; },
    step(dt) {
      acc = Math.min(acc + dt * 1000, SUB * 14);
      while (acc >= SUB) { Engine.update(eng, SUB); wake(); acc -= SUB; }
      for (const t of teile) {
        const p = t.body.position;
        if (!t.weg && (p.y > FLOOR + 80 || p.x > 460 || p.x < -100)) this.entferne(t);
      }
    },
    entferne(t) { if (t.weg) return; t.weg = true; Composite.remove(eng.world, t.body); },
    wirf(x, y, vx, vy) {
      if (bird) Composite.remove(eng.world, bird);
      bird = Bodies.circle(x, y, BIRD_R, { density: TUNE.dichte, restitution: .25, friction: .5, frictionAir: .004 });
      Composite.add(eng.world, bird);
      Body.setVelocity(bird, { x: vx, y: vy });
    },
    vogelWeg() { if (bird) Composite.remove(eng.world, bird); bird = null; },
    /* alles ruhig? (schlafend oder fast still) */
    ruhig() {
      return teile.every(t => t.weg || t.body.isSleeping || (t.body.speed < .12 && t.body.angularSpeed < .006));
    },
    alleWecken() { for (const t of teile) if (!t.weg) Sleeping.set(t.body, false); },
  };
}

/* Flugbahn-Vorschau: dieselbe Integration wie im Spiel, nur der Vogel allein. → [{x,y}] */
const pre = engine(); pre.enableSleeping = false;
const preBird = Bodies.circle(0, 0, BIRD_R, { density: .004, frictionAir: .004 });
Composite.add(pre.world, preBird);
export function vorschau(x, y, vx, vy, n = 12, jede = 7) {
  Body.setPosition(preBird, { x, y }); Body.setAngle(preBird, 0); Body.setAngularVelocity(preBird, 0);
  preBird.deltaTime = SUB; Body.setVelocity(preBird, { x: vx, y: vy });
  const out = [];
  for (let i = 1; i <= n * jede; i++) { Engine.update(pre, SUB); if (i % jede === 0) out.push({ x: preBird.position.x, y: preBird.position.y }); }
  return out;
}
