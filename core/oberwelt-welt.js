/* Oberwelt „Stammtischdorf“: Weltdaten (Stationen, Wege, Bäume, Zäune) und Zeichnen.
   Eigene Weltkoordinaten WW × WH; oberwelt.js verschiebt die Kamera (Ausschnitt 360 × 640).
   Bauten, Bäume und Vogel haben feste Farben; im Dunkelmodus legt oberwelt.js einen
   Abendschleier darüber und zeichnet danach die Fensterlichter. Nur Boden, Wege und Wasser
   wählen ihre Farben selbst nach C.dark. */
import { card, dorn, rr, WOOD } from './draw.js';
import { C } from './theme.js';

export const WW = 600, WH = 1260;
export const START = { x: 300, y: 1090 };
export const FONT = {
  display: '"Grenze Gotisch",Georgia,serif',
  body: '"Alegreya Sans","Segoe UI",system-ui,sans-serif',
  mono: '"IBM Plex Mono",ui-monospace,Menlo,monospace',
};

/* Stationstabelle: Spiel-id (games/registry.js) -> Platz im Dorf.
   x/y = Mitte der Unterkante des Baus (dort, wo er auf dem Boden steht), bau = Bauart (BAUTEN).
   Ein Spiel ohne Zeile erscheint nicht im Dorf (aber in #/liste und in der Bestenliste).
   Freie Bauplätze für künftige Spiele: siehe ARCHITEKTUR.md („Station eintragen“). */
export const STATIONEN = {
  neunerjagd: { x: 140, y: 1000, bau: 'dornbusch' },
  flatterflug: { x: 166, y: 410, bau: 'windwiese' },
  'neuner-hauen': { x: 300, y: 640, bau: 'wirtshaus' },
  neunerschiessen: { x: 486, y: 768, bau: 'schiessbude' },
  kartenhaus: { x: 455, y: 400, bau: 'kartenbaustelle' },
};
/* Das Vereinsheim ist kein Spiel: es öffnet die Bestenliste. */
export const VEREINSHEIM = { x: 465, y: 1000, bau: 'vereinsheim' };

/* Wege (Polylinien), Dorfplatz, Teich, Feld, Tor */
const WEGE = [
  [[300, 1280], [300, 650]],
  [[300, 1048], [140, 1040]],
  [[300, 1048], [465, 1040]],
  [[300, 735], [486, 790]],
  [[300, 738], [178, 742]],
  [[262, 712], [176, 612], [166, 434]],
  [[338, 712], [428, 600], [455, 424]],
  [[455, 424], [400, 330], [360, 262], [360, 200]],
];
const PLATZ = { x: 300, y: 735, r: 64 };
const TEICH = { x: 100, y: 735, rx: 64, ry: 36 };
const FELD = { x0: 214, y0: 96, x1: 522, y1: 256 };
const TOR = { x: 300, y: 1226, l: 238, r: 362 };
const BAEUME = [
  [40, 72, 1.1], [112, 44, .9], [168, 92, .8], [562, 62, 1.1], [578, 150, .9], [28, 196, 1],
  [26, 330, .9], [578, 300, 1], [40, 560, 1], [574, 548, .9], [586, 648, 1], [36, 870, 1.1],
  [572, 892, 1.1], [56, 1150, 1], [22, 1236, .9], [548, 1148, 1], [590, 1232, .9],
  [256, 868, .75], [344, 868, .75], [224, 520, .8], [396, 548, .75], [80, 640, .7],
  [212, 1130, .7], [392, 1110, .65],
];
/* Zäune: [x0, y0, x1, y1], waagrecht oder senkrecht */
const ZAEUNE = [
  [FELD.x0 - 4, FELD.y1 + 6, 332, FELD.y1 + 6], [388, FELD.y1 + 6, FELD.x1 + 4, FELD.y1 + 6],
  [FELD.x0 - 4, FELD.y0 - 6, FELD.x0 - 4, FELD.y1 + 6], [FELD.x1 + 4, FELD.y0 - 6, FELD.x1 + 4, FELD.y1 + 6],
  [FELD.x0 - 4, FELD.y0 - 6, FELD.x1 + 4, FELD.y0 - 6],
  [40, TOR.y + 4, TOR.l - 10, TOR.y + 4], [TOR.r + 10, TOR.y + 4, 560, TOR.y + 4],
];
export { FELD };

/* Bodenfarben je nach Hell/Dunkel */
function pal() {
  return C.dark
    ? { grass: '#28352b', patch: '#2f3e32', tuft: '#3e5443', path: '#47443a', edge: '#37342d', water: '#26464f', bank: '#355e68',
        ripple: 'rgba(190,220,230,.28)', soil: '#4a3c2d', furrow: '#3a2f23', sprout: '#5d7a52', flower: ['#c48d86', '#cfc283', '#a6a3cc'] }
    : { grass: '#e1e8d4', patch: '#d6e0c6', tuft: '#b4c6a0', path: '#f0e7d3', edge: '#ddd0b2', water: '#bad6d9', bank: '#91b5ba',
        ripple: 'rgba(255,255,255,.7)', soil: '#dcc9a5', furrow: '#c7af86', sprout: '#7d9a68', flower: ['#d9776a', '#e3bd3f', '#8f8fd0'] };
}

const G = { dark: '#4b6640', mid: '#5f7d4d', light: '#7a9865', hi: '#9ab585' };
const PLASTER = '#f1e6d0', ROOF = '#8c3b1f', ROOF_D = '#6c2b14', STONE = '#8d857c', GLASS = '#c6dadd', LAMP = '#f7cf6a';

/* deterministischer Zufall für Grasbüschel und Blumen */
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const R = rng(9);
const TUFTS = [], FLOWERS = [], PATCHES = [];
for (let i = 0; i < 230; i++) TUFTS.push([R() * WW, R() * WH]);
for (let i = 0; i < 70; i++) FLOWERS.push([R() * WW, R() * WH, i % 3]);
for (let i = 0; i < 26; i++) PATCHES.push([R() * WW, R() * WH, 40 + R() * 50, 14 + R() * 16]);
/* Abstand eines Punkts zum nächsten Weg (für Blumen und Büschel, die nicht auf Wegen liegen sollen) */
function wegAbstand(x, y) {
  let m = Math.hypot(x - PLATZ.x, y - PLATZ.y) - PLATZ.r;
  for (const l of WEGE) for (let i = 1; i < l.length; i++) {
    const [ax, ay] = l[i - 1], [bx, by] = l[i], dx = bx - ax, dy = by - ay;
    const f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    m = Math.min(m, Math.hypot(x - ax - dx * f, y - ay - dy * f) - 17);
  }
  return m;
}
const abseits = ([x, y]) => wegAbstand(x, y) > 4 && !(Math.hypot((x - TEICH.x) / (TEICH.rx + 6), (y - TEICH.y) / (TEICH.ry + 6)) < 1);
TUFTS.splice(0, TUFTS.length, ...TUFTS.filter(abseits));
FLOWERS.splice(0, FLOWERS.length, ...FLOWERS.filter(abseits));

const shadow = (ctx, x, y, rx, ry, a = .16) => { ctx.fillStyle = `rgba(30,40,25,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
const inView = (v, x0, y0, x1, y1) => x1 > v.x0 && x0 < v.x1 && y1 > v.y0 && y0 < v.y1;

/* ---------- Boden ---------- */
export function drawGround(ctx, v, t) {
  const P = pal();
  ctx.save();
  ctx.fillStyle = P.grass; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  ctx.fillStyle = P.patch;
  for (const [x, y, rx, ry] of PATCHES) if (inView(v, x - rx, y - ry, x + rx, y + ry)) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  // Feld mit Furchen und Keimlingen
  if (inView(v, FELD.x0, FELD.y0, FELD.x1, FELD.y1)) {
    ctx.fillStyle = P.soil; rr(ctx, FELD.x0, FELD.y0, FELD.x1 - FELD.x0, FELD.y1 - FELD.y0, 6); ctx.fill();
    ctx.strokeStyle = P.furrow; ctx.lineWidth = 3; ctx.beginPath();
    for (let y = FELD.y0 + 12; y < FELD.y1 - 4; y += 16) { ctx.moveTo(FELD.x0 + 8, y); ctx.lineTo(FELD.x1 - 8, y); }
    ctx.stroke();
    ctx.strokeStyle = P.sprout; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
    for (let y = FELD.y0 + 12; y < FELD.y1 - 4; y += 16) for (let x = FELD.x0 + 16 + (y % 32 ? 8 : 0); x < FELD.x1 - 10; x += 22) {
      ctx.moveTo(x, y - 1); ctx.lineTo(x - 3, y - 6); ctx.moveTo(x, y - 1); ctx.lineTo(x + 3, y - 6);
    }
    ctx.stroke();
  }
  // Grasbüschel
  ctx.strokeStyle = P.tuft; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath();
  for (const [x, y] of TUFTS) {
    if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
    if (x > FELD.x0 && x < FELD.x1 && y > FELD.y0 && y < FELD.y1) continue;
    ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 6); ctx.moveTo(x, y); ctx.lineTo(x, y - 8); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 6);
  }
  ctx.stroke();
  // Wege und Platz
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const [w, col] of [[34, P.edge], [27, P.path]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    for (const l of WEGE) { ctx.moveTo(l[0][0], l[0][1]); for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]); }
    ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(PLATZ.x, PLATZ.y, PLATZ.r + (w - 27) / 2, 0, Math.PI * 2); ctx.fill();
  }
  // Pflaster-Ring auf dem Platz
  ctx.strokeStyle = P.edge; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(PLATZ.x, PLATZ.y, PLATZ.r - 14, 0, Math.PI * 2); ctx.stroke();
  // Teich
  if (inView(v, TEICH.x - 90, TEICH.y - 60, TEICH.x + 90, TEICH.y + 60)) {
    ctx.fillStyle = P.bank; ctx.beginPath(); ctx.ellipse(TEICH.x, TEICH.y + 3, TEICH.rx + 4, TEICH.ry + 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.water; ctx.beginPath(); ctx.ellipse(TEICH.x, TEICH.y, TEICH.rx, TEICH.ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = P.ripple; ctx.lineWidth = 1.4;
    for (let k = 0; k < 3; k++) {
      const p = (t * .22 + k / 3) % 1, cx = TEICH.x - 18 + k * 20, cy = TEICH.y - 6 + (k % 2) * 12;
      ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.ellipse(cx, cy, 4 + p * 18, 2 + p * 7, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = G.light;
    for (const [x, y, r] of [[TEICH.x + 28, TEICH.y + 10, 7], [TEICH.x + 40, TEICH.y - 4, 5], [TEICH.x - 34, TEICH.y + 12, 6]]) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, .4, Math.PI * 2 - .1); ctx.closePath(); ctx.fill();
    }
    // Schilf am Rand
    ctx.strokeStyle = G.dark; ctx.lineWidth = 2;
    for (const [x, y] of [[TEICH.x - 58, TEICH.y - 6], [TEICH.x - 52, TEICH.y - 16], [TEICH.x + 52, TEICH.y - 18], [TEICH.x + 58, TEICH.y - 8]]) {
      const s = Math.sin(t * 1.3 + x) * 1.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 1, y - 12, x + s, y - 24); ctx.moveTo(x + 4, y); ctx.lineTo(x + 6 + s, y - 17); ctx.stroke();
      ctx.fillStyle = WOOD; ctx.fillRect(x + s - 1.6, y - 30, 3.2, 9);
    }
  }
  // Blumen
  for (const [x, y, c] of FLOWERS) {
    if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
    if (x > FELD.x0 - 6 && x < FELD.x1 + 6 && y > FELD.y0 - 6 && y < FELD.y1 + 6) continue;
    ctx.fillStyle = P.flower[c]; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ---------- Szenerie-Objekte ---------- */
function baum(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  shadow(ctx, 2, 2, 30, 9);
  ctx.fillStyle = WOOD; ctx.fillRect(-4, -26, 8, 26);
  const sw = Math.sin(t * .8 + x * .05) * 1.2;
  ctx.fillStyle = G.dark; ctx.beginPath(); ctx.arc(-14 + sw, -40, 18, 0, Math.PI * 2); ctx.arc(14 + sw, -40, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = G.mid; ctx.beginPath(); ctx.arc(sw, -54, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = G.light; ctx.beginPath(); ctx.arc(-7 + sw, -62, 11, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function zaun(ctx, x0, y0, x1, y1) {
  ctx.save(); ctx.fillStyle = WOOD; ctx.strokeStyle = WOOD; ctx.lineWidth = 2.4;
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 22));
  ctx.beginPath();
  if (y0 === y1) { ctx.moveTo(x0, y0 - 12); ctx.lineTo(x1, y1 - 12); ctx.moveTo(x0, y0 - 5); ctx.lineTo(x1, y1 - 5); }
  else { ctx.moveTo(x0, y0 - 12); ctx.lineTo(x1, y1 - 12); ctx.moveTo(x0 + .01, y0 - 5); ctx.lineTo(x1, y1 - 5); }
  ctx.stroke();
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; rr(ctx, x - 2.5, y - 17, 5, 18, 1.5); ctx.fill(); }
  ctx.restore();
}

function tor(ctx, t) {
  const { x, y, l, r } = TOR;
  ctx.save();
  shadow(ctx, x, y + 2, 72, 6, .12);
  ctx.fillStyle = WOOD;
  ctx.fillRect(l - 4, y - 84, 8, 86); ctx.fillRect(r - 4, y - 84, 8, 86);
  // Laternen an den Pfosten
  for (const px of [l, r]) { ctx.fillStyle = '#2b2b2b'; ctx.fillRect(px - 5, y - 54, 10, 12); ctx.fillStyle = LAMP; ctx.fillRect(px - 3, y - 52, 6, 8); }
  torSchild(ctx);
  ctx.restore();
}
function torSchild(ctx) {
  const { x, y, l, r } = TOR;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.18)'; rr(ctx, l - 14, y - 112 + 3, r - l + 28, 40, 6); ctx.fill();
  ctx.fillStyle = '#6b4630'; rr(ctx, l - 14, y - 112, r - l + 28, 40, 6); ctx.fill();
  ctx.strokeStyle = WOOD; ctx.lineWidth = 2.5; rr(ctx, l - 11, y - 109, r - l + 22, 34, 4); ctx.stroke();
  ctx.fillStyle = '#f6ecd6'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 21px ${FONT.display}`; ctx.fillText('Der Stammtisch', x, y - 88);
  ctx.font = `600 8.5px ${FONT.mono}`; ctx.fillStyle = '#e8c96b'; ctx.fillText('N.E.V. · NEUNER UNERWÜNSCHT', x, y - 78);
  // kleine Dornen auf dem Schild
  dorn(ctx, l - 6, y - 112, 9, -.5, 4); dorn(ctx, r + 6, y - 112, 9, .5, 4);
  ctx.restore();
}

function bank(ctx, x, y) {
  ctx.save(); ctx.translate(x, y); shadow(ctx, 0, 2, 22, 4, .12);
  ctx.fillStyle = WOOD; ctx.fillRect(-18, -8, 3, 9); ctx.fillRect(15, -8, 3, 9);
  ctx.fillStyle = '#7a5236'; rr(ctx, -21, -12, 42, 5, 1.5); ctx.fill(); rr(ctx, -21, -22, 42, 5, 1.5); ctx.fill();
  ctx.fillStyle = WOOD; ctx.fillRect(-17, -22, 3, 12); ctx.fillRect(14, -22, 3, 12);
  ctx.restore();
}

/* flach liegende Karte (am Boden, leicht gestaucht für die Schrägsicht) */
function liegendeKarte(ctx, x, y, rot, rank, suit, back) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, .62);
  if (back) {
    ctx.rotate(rot); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.4; rr(ctx, -8, -11, 16, 22, 2.5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = ROOF; ctx.lineWidth = 1; rr(ctx, -5, -8, 10, 16, 1.5); ctx.stroke();
  } else card(ctx, 0, 0, rot, rank, suit, .4);
  ctx.restore();
}

/* ---------- Bauten ----------
   hw = halbe Breite, d = Tiefe der Grundfläche (Kollision: x±hw, y-d..y), top = Höhe über dem Boden
   (Tipp-Fläche), door = Abstand Eingangspunkt unter der Unterkante, sign = Schild-Fußpunkt relativ,
   fenster = Fensterrechtecke (relativ) für das Abendlicht, draw(ctx, t) zeichnet relativ zu (x, y). */
export const BAUTEN = {
  wirtshaus: {
    hw: 80, d: 54, top: 150, door: 20, sign: [-150, 62],
    fenster: [[-64, -34, 16, 16], [-35, -34, 16, 16], [19, -34, 16, 16], [48, -34, 16, 16], [-64, -60, 14, 12], [50, -60, 14, 12]],
    draw(ctx, t) {
      shadow(ctx, 0, 0, 92, 12);
      // Bank vor dem Wirtshaus
      bank(ctx, 50, 14);
      // Wand + Fachwerk
      ctx.fillStyle = PLASTER; ctx.fillRect(-74, -66, 148, 66);
      ctx.strokeStyle = WOOD; ctx.lineWidth = 4; ctx.lineCap = 'butt';
      ctx.beginPath();
      for (const x of [-74, -44, -14, 14, 44, 74]) { ctx.moveTo(x, -66); ctx.lineTo(x, 0); }
      ctx.moveTo(-74, -42); ctx.lineTo(74, -42); ctx.moveTo(-74, -64); ctx.lineTo(74, -64); ctx.moveTo(-76, -1); ctx.lineTo(76, -1);
      ctx.moveTo(-44, -42); ctx.lineTo(-14, -64); ctx.moveTo(14, -64); ctx.lineTo(44, -42);
      ctx.stroke();
      // Fenster
      for (const [x, y, w, h] of this.fenster) {
        ctx.fillStyle = GLASS; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = WOOD; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
      }
      // Tür
      ctx.fillStyle = '#4a2f1d'; rr(ctx, -11, -38, 22, 38, 9); ctx.fill();
      ctx.strokeStyle = '#2d1c11'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, 0); ctx.stroke();
      ctx.fillStyle = '#d6b24c'; ctx.beginPath(); ctx.arc(6, -18, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = STONE; ctx.fillRect(-16, 0, 32, 4);
      // Dach
      ctx.fillStyle = ROOF; ctx.beginPath(); ctx.moveTo(-86, -62); ctx.lineTo(86, -62); ctx.lineTo(64, -126); ctx.lineTo(-64, -126); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = ROOF_D; ctx.lineWidth = 1.6; ctx.beginPath();
      for (const y of [-78, -94, -110]) { const k = (y + 62) / -64 * 22; ctx.moveTo(-86 + k, y); ctx.lineTo(86 - k, y); }
      ctx.stroke();
      ctx.fillStyle = ROOF_D; rr(ctx, -68, -131, 136, 7, 3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(-74, -62, 148, 5);
      // Schornstein
      ctx.fillStyle = STONE; ctx.fillRect(32, -146, 15, 30); ctx.fillStyle = '#6c655d'; ctx.fillRect(30, -149, 19, 5);
      // Wirtshausschild unter dem Dachrand
      ctx.fillStyle = WOOD; rr(ctx, -47, -80, 94, 19, 4); ctx.fill();
      ctx.fillStyle = '#f3dfa8'; ctx.font = `800 14px ${FONT.display}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Zum Stammtisch', 0, -70);
    },
    after(ctx, t) {   // Rauch (über dem Dach)
      for (let k = 0; k < 4; k++) {
        const p = (t * .22 + k / 4) % 1;
        ctx.globalAlpha = .5 * (1 - p) * Math.min(1, p * 6);
        ctx.fillStyle = C.dark ? '#9aa0a3' : '#d9d6cf';
        ctx.beginPath(); ctx.arc(40 + Math.sin(p * 5 + k) * 4 + p * 14, -152 - p * 58, 4 + p * 10, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  },

  dornbusch: {
    hw: 60, d: 40, top: 112, door: 22, sign: [148, 4], fenster: [],
    draw(ctx, t) {
      shadow(ctx, 0, 0, 70, 12);
      // Zweige mit aufgespießten Neunern
      const tw = [[-46, -82, '♣', -.35], [-12, -100, '♥', -.1], [24, -96, '♠', .2], [54, -74, '♦', .4]];
      ctx.strokeStyle = WOOD; ctx.lineCap = 'round';
      for (const [x, y] of tw) { ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x * .4, -34); ctx.quadraticCurveTo(x * .8, (y - 34) / 2, x, y); ctx.stroke(); }
      for (const [x, y, s, r] of tw) { card(ctx, x, y + 6, r, '9', s, .46); dorn(ctx, x - Math.sin(r) * 6, y + 12, 26, r, 5); }
      // Busch
      const b = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
      b(-36, -24, 26, G.dark); b(38, -24, 26, G.dark); b(0, -20, 30, G.dark);
      b(-18, -42, 26, G.mid); b(20, -44, 26, G.mid); b(-44, -32, 18, G.mid); b(46, -30, 18, G.mid);
      b(-16, -52, 12, G.light); b(22, -54, 11, G.light); b(-42, -38, 8, G.light);
      // Dornen am Rand
      for (const [x, y, a] of [[-62, -30, -1.4], [-50, -52, -.8], [-28, -66, -.4], [4, -68, .1], [36, -66, .5], [58, -48, 1], [64, -26, 1.4], [-60, -12, -1.7], [62, -10, 1.7]]) dorn(ctx, x, y, 10, a, 5);
    },
  },

  windwiese: {
    hw: 24, d: 22, top: 126, door: 18, sign: [-92, 70], fenster: [[-4, -50, 8, 8]],
    draw(ctx, t) {
      // Wiese mit Blumen
      ctx.fillStyle = 'rgba(122,152,101,.28)'; ctx.beginPath(); ctx.ellipse(0, -2, 78, 26, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 14; i++) { ctx.fillStyle = ['#d9776a', '#e3bd3f', '#f4f1e8'][i % 3]; ctx.beginPath(); ctx.arc(Math.cos(i * 2.4) * (30 + i * 3), Math.sin(i * 2.4) * 16 - 2, 2.2, 0, Math.PI * 2); ctx.fill(); }
      shadow(ctx, 0, 0, 30, 7);
      // Windsack
      ctx.strokeStyle = '#7d7d7d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(52, 6); ctx.lineTo(52, -62); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const x0 = 52 + i * 9, w0 = Math.sin(t * 3 + i * .9) * 2.5, w1 = Math.sin(t * 3 + (i + 1) * .9) * 2.5, h0 = 7 - i * 1.2, h1 = 7 - (i + 1) * 1.2;
        ctx.fillStyle = i % 2 ? '#f4f1e8' : '#c0261b';
        ctx.beginPath(); ctx.moveTo(x0, -60 - h0 + w0); ctx.lineTo(x0 + 9, -60 - h1 + w1); ctx.lineTo(x0 + 9, -60 + h1 + w1); ctx.lineTo(x0, -60 + h0 + w0); ctx.closePath(); ctx.fill();
      }
      // Turm
      ctx.fillStyle = '#d8c39d'; ctx.beginPath(); ctx.moveTo(-21, 0); ctx.lineTo(21, 0); ctx.lineTo(13, -68); ctx.lineTo(-13, -68); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#b39a70'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let y = -10; y > -66; y -= 9) { const k = -y / 68 * 8; ctx.moveTo(-21 + k, y); ctx.lineTo(21 - k, y); } ctx.stroke();
      ctx.strokeStyle = WOOD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-21, 0); ctx.lineTo(-13, -68); ctx.moveTo(21, 0); ctx.lineTo(13, -68); ctx.stroke();
      ctx.fillStyle = '#4a2f1d'; rr(ctx, -7, -20, 14, 20, 6); ctx.fill();
      ctx.fillStyle = GLASS; ctx.fillRect(-4, -50, 8, 8); ctx.strokeStyle = WOOD; ctx.lineWidth = 1.5; ctx.strokeRect(-4, -50, 8, 8);
      ctx.fillStyle = ROOF; ctx.beginPath(); ctx.moveTo(-18, -66); ctx.lineTo(18, -66); ctx.lineTo(0, -88); ctx.closePath(); ctx.fill();
      // Flügel aus Karten
      ctx.save(); ctx.translate(0, -72); ctx.rotate(t * .7);
      const bl = [['A', '♣'], ['K', '♥'], ['D', '♠'], ['B', '♦']];
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 2);
        ctx.strokeStyle = WOOD; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -50); ctx.stroke();
        card(ctx, 6, -32, 0, bl[i][0], bl[i][1], .52);
        ctx.restore();
      }
      ctx.fillStyle = WOOD; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
  },

  schiessbude: {
    hw: 66, d: 36, top: 132, door: 20, sign: [-98, 64], fenster: [],
    draw(ctx, t) {
      shadow(ctx, 0, 0, 74, 10);
      // Wimpelkette
      ctx.fillStyle = WOOD; ctx.fillRect(-66, -128, 4, 30); ctx.fillRect(62, -128, 4, 30);
      ctx.strokeStyle = '#3d2a1c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-64, -126); ctx.quadraticCurveTo(0, -112, 64, -126); ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const f = (i + .5) / 7, x = -64 + 128 * f, y = -126 + 28 * f * (1 - f) * 1.0 * 1.0 + 0, w = Math.sin(t * 4 + i) * 2;
        ctx.fillStyle = [ROOF, '#e3bd3f', G.mid][i % 3];
        ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x + w, y + 12); ctx.closePath(); ctx.fill();
      }
      // Pfosten + Rückwand
      ctx.fillStyle = WOOD; ctx.fillRect(-64, -98, 6, 98); ctx.fillRect(58, -98, 6, 98);
      ctx.fillStyle = '#3f2c20'; ctx.fillRect(-58, -84, 116, 56);
      // Zielkarten an einer Leine
      ctx.strokeStyle = '#c9b48c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-58, -76); ctx.lineTo(58, -76); ctx.stroke();
      [['9', '♠'], ['K', '♥'], ['9', '♦']].forEach(([r, s], i) => card(ctx, -32 + i * 32, -58, Math.sin(t * 2 + i * 1.7) * .12, r, s, .42));
      // Theke
      ctx.fillStyle = '#9b6b45'; ctx.fillRect(-66, -30, 132, 30);
      ctx.strokeStyle = '#7a5236'; ctx.lineWidth = 1.5; ctx.beginPath(); for (const x of [-22, 22]) { ctx.moveTo(x, -26); ctx.lineTo(x, 0); } ctx.stroke();
      ctx.fillStyle = WOOD; rr(ctx, -70, -34, 140, 7, 2); ctx.fill();
      for (let i = -2; i <= 2; i++) dorn(ctx, 44 + i * 3, -33, 16, i * .18, 3.5);
      ctx.fillStyle = ROOF; ctx.fillRect(38, -42, 12, 3);
      // Markise
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#f4ecda' : ROOF; ctx.fillRect(-70 + i * 17.5, -104, 17.5, 18); ctx.beginPath(); ctx.arc(-70 + i * 17.5 + 8.75, -86, 8.75, 0, Math.PI); ctx.fill(); }
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-70, -106, 140, 4);
    },
  },

  kartenbaustelle: {
    hw: 58, d: 38, top: 132, door: 20, sign: [-92, 70], fenster: [],
    draw(ctx, t) {
      ctx.fillStyle = 'rgba(160,125,80,.28)'; ctx.beginPath(); ctx.ellipse(0, -8, 80, 24, 0, 0, Math.PI * 2); ctx.fill();
      shadow(ctx, 0, -4, 52, 8);
      // Kran
      ctx.strokeStyle = '#c99a2e'; ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(66, 0); ctx.lineTo(66, -122); ctx.moveTo(74, -118); ctx.lineTo(-4, -118); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); for (let y = -8; y > -116; y -= 14) { ctx.moveTo(62, y); ctx.lineTo(70, y - 10); } ctx.moveTo(66, -100); ctx.lineTo(48, -118); ctx.stroke();
      const sw = Math.sin(t * 1.4) * 3;
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(34, -118); ctx.lineTo(34 + sw, -98); ctx.stroke();
      ctx.save(); ctx.translate(34 + sw, -98); ctx.rotate(sw * .03); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.3; rr(ctx, -17, 0, 34, 5, 1.5); ctx.fill(); ctx.stroke(); ctx.restore();
      // Kartenhaus (Rückseiten), oben noch unfertig
      const lean = (bx, by, ang) => { ctx.save(); ctx.translate(bx, by); ctx.rotate(ang); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.3; rr(ctx, -4, -38, 8, 38, 1.5); ctx.fill(); ctx.stroke(); ctx.strokeStyle = ROOF; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, -4); ctx.stroke(); ctx.restore(); };
      const deck = (x0, x1, y) => { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.3; rr(ctx, x0, y - 4, x1 - x0, 5, 1.5); ctx.fill(); ctx.stroke(); };
      const frame = (cx, by) => { lean(cx - 9, by, .26); lean(cx + 9, by, -.26); };
      frame(-30, -8); frame(0, -8); frame(30, -8);
      deck(-44, 44, -44);
      frame(-15, -45); frame(15, -45);
      deck(-30, 30, -81);
      lean(-9, -82, .26);
      // Absperrung rechts vorn, Leitkegel links
      ctx.fillStyle = WOOD; ctx.fillRect(28, -8, 3, 16); ctx.fillRect(70, -8, 3, 16);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#f4f1e8' : '#c0261b'; ctx.fillRect(24 + i * 9, -10, 9, 6); }
      ctx.fillStyle = '#e07a2e'; ctx.beginPath(); ctx.moveTo(-70, 10); ctx.lineTo(-56, 10); ctx.lineTo(-63, -12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4f1e8'; ctx.fillRect(-67, -1, 8, 3);
      // herumliegende Karten
      liegendeKarte(ctx, -50, -14, .7, '', '', true); liegendeKarte(ctx, 46, 14, -.4, 'B', '♣');
    },
  },

  vereinsheim: {
    hw: 60, d: 46, top: 132, door: 20, sign: [65, 60], fenster: [[-42, -40, 16, 14], [26, -40, 16, 14]],
    draw(ctx, t) {
      shadow(ctx, 0, 0, 74, 11);
      // Fahnenmast mit Vereinsfahne (durchgestrichene Neun)
      ctx.strokeStyle = '#8b8b8b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-74, 4); ctx.lineTo(-74, -128); ctx.stroke();
      ctx.fillStyle = '#d6b24c'; ctx.beginPath(); ctx.arc(-74, -130, 3, 0, Math.PI * 2); ctx.fill();
      const N = 8, fw = 44, fh = 28;
      const wy = i => Math.sin(t * 3.2 - i * .8) * 2.6 * (i / N);
      ctx.fillStyle = ROOF; ctx.beginPath(); ctx.moveTo(-74, -126);
      for (let i = 1; i <= N; i++) ctx.lineTo(-74 + fw * i / N, -126 + wy(i));
      for (let i = N; i >= 0; i--) ctx.lineTo(-74 + fw * i / N, -126 + fh + wy(i));
      ctx.closePath(); ctx.fill();
      const my = -126 + fh / 2 + wy(N / 2);
      ctx.fillStyle = '#fff'; ctx.font = `700 17px Georgia,serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('9', -52, my + 1);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-61, my + 9); ctx.lineTo(-43, my - 9); ctx.stroke();
      // Holzhaus
      ctx.fillStyle = '#c79c6c'; ctx.fillRect(-56, -54, 112, 54);
      ctx.strokeStyle = '#a77d50'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let y = -46; y < 0; y += 8) { ctx.moveTo(-56, y); ctx.lineTo(56, y); } ctx.stroke();
      ctx.strokeStyle = WOOD; ctx.lineWidth = 3; ctx.strokeRect(-56, -54, 112, 54);
      for (const [x, y, w, h] of this.fenster) {
        ctx.fillStyle = G.dark; ctx.fillRect(x - 6, y, 6, h); ctx.fillRect(x + w, y, 6, h);
        ctx.fillStyle = GLASS; ctx.fillRect(x, y, w, h); ctx.strokeStyle = WOOD; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
      }
      ctx.fillStyle = '#4a2f1d'; rr(ctx, -10, -33, 20, 33, 4); ctx.fill();
      ctx.fillStyle = '#d6b24c'; ctx.beginPath(); ctx.arc(5, -16, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = STONE; ctx.fillRect(-14, 0, 28, 4);
      // Plakette über der Tür
      ctx.fillStyle = '#f4ecda'; rr(ctx, -18, -48, 36, 11, 2); ctx.fill();
      ctx.fillStyle = '#3d2a1c'; ctx.font = `600 7.5px ${FONT.mono}`; ctx.fillText('N.E.V.', 0, -42.5);
      // Dach
      ctx.fillStyle = '#56724a'; ctx.beginPath(); ctx.moveTo(-66, -52); ctx.lineTo(66, -52); ctx.lineTo(46, -100); ctx.lineTo(-46, -100); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#46603c'; ctx.lineWidth = 1.5; ctx.beginPath(); for (const y of [-68, -84]) { const k = (y + 52) / -48 * 20; ctx.moveTo(-66 + k, y); ctx.lineTo(66 - k, y); } ctx.stroke();
      ctx.fillStyle = '#46603c'; rr(ctx, -49, -104, 98, 6, 3); ctx.fill();
      // Schwarzes Brett rechts
      ctx.fillStyle = WOOD; ctx.fillRect(64, -30, 3, 32); ctx.fillRect(88, -30, 3, 32);
      ctx.fillStyle = '#2f3a33'; rr(ctx, 60, -44, 35, 24, 2); ctx.fill();
      ctx.fillStyle = '#f4f1e8'; ctx.fillRect(64, -40, 10, 12); ctx.fillRect(78, -38, 12, 9); ctx.fillStyle = '#e8d47a'; ctx.fillRect(76, -28, 9, 6);
    },
  },

  /* Ersatzbau für neue Spiele ohne eigene Bauart */
  huette: {
    hw: 40, d: 34, top: 92, door: 18, sign: [-84, 4], fenster: [[18, -30, 12, 11]],
    draw(ctx, t) {
      shadow(ctx, 0, 0, 50, 9);
      ctx.fillStyle = '#b48a5c'; ctx.fillRect(-36, -42, 72, 42);
      ctx.strokeStyle = '#94693f'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let x = -28; x < 36; x += 8) { ctx.moveTo(x, -42); ctx.lineTo(x, 0); } ctx.stroke();
      ctx.fillStyle = '#4a2f1d'; rr(ctx, -9, -28, 18, 28, 4); ctx.fill();
      ctx.fillStyle = GLASS; ctx.fillRect(18, -30, 12, 11); ctx.strokeStyle = WOOD; ctx.lineWidth = 1.6; ctx.strokeRect(18, -30, 12, 11);
      ctx.fillStyle = ROOF; ctx.beginPath(); ctx.moveTo(-46, -40); ctx.lineTo(46, -40); ctx.lineTo(0, -82); ctx.closePath(); ctx.fill();
    },
  },
};

/* Baut die Welt aus den sichtbaren Stationen:
   stations = [{id, kind: 'spiel'|'liste', x, y, bau, ...}] -> { things, colliders, stations }
   things = [{y, bbox: [x0,y0,x1,y1], draw(ctx,t), light?(ctx)}] (nach y sortiert gezeichnet) */
export function buildWorld(stations) {
  const things = [], colliders = [];
  for (const s of stations) {
    const B = BAUTEN[s.bau] || BAUTEN.huette;
    s.B = B;
    s.door = { x: s.x, y: s.y + B.door };
    s.front = { x: s.x, y: s.y + B.door + 26 };
    s.signAt = { x: s.x + B.sign[0], y: s.y + B.sign[1] };
    s.hit = [s.x - B.hw - 8, s.y - B.top, s.x + B.hw + 8, s.y + B.door + 14];
    colliders.push({ t: 'r', x0: s.x - B.hw, y0: s.y - B.d, x1: s.x + B.hw, y1: s.y - 2 });
    things.push({
      y: s.y, bbox: [s.x - B.hw - 60, s.y - B.top - 70, s.x + B.hw + 60, s.y + 30],
      draw(ctx, t) { ctx.save(); ctx.translate(s.x, s.y); B.draw(ctx, t); if (B.after) B.after(ctx, t); ctx.restore(); },
      light(ctx) { for (const [x, y, w, h] of B.fenster) fensterLicht(ctx, s.x + x, s.y + y, w, h); },
    });
  }
  for (const [x, y, s] of BAEUME) {
    colliders.push({ t: 'c', x, y: y - 3, r: 9 * s });
    things.push({ y, bbox: [x - 45 * s, y - 90 * s, x + 45 * s, y + 12], draw: (ctx, t) => baum(ctx, x, y, s, t) });
  }
  for (const [x0, y0, x1, y1] of ZAEUNE) {
    colliders.push({ t: 'r', x0: Math.min(x0, x1) - 3, y0: Math.min(y0, y1) - 6, x1: Math.max(x0, x1) + 3, y1: Math.max(y0, y1) + 1 });
    things.push({ y: Math.max(y0, y1), bbox: [Math.min(x0, x1) - 4, Math.min(y0, y1) - 20, Math.max(x0, x1) + 4, Math.max(y0, y1) + 4], draw: ctx => zaun(ctx, x0, y0, x1, y1) });
  }
  // Tor mit Ortsschild
  colliders.push({ t: 'c', x: TOR.l, y: TOR.y - 2, r: 6 }, { t: 'c', x: TOR.r, y: TOR.y - 2, r: 6 });
  things.push({
    y: TOR.y, bbox: [TOR.l - 30, TOR.y - 125, TOR.r + 30, TOR.y + 10], draw: (ctx, t) => tor(ctx, t),
    light(ctx) { for (const px of [TOR.l, TOR.r]) { glow(ctx, px, TOR.y - 48, 26); ctx.fillStyle = LAMP; ctx.fillRect(px - 3, TOR.y - 52, 6, 8); } torSchild(ctx); },
  });
  // Teich, Bank am Teich, Karten am Wegrand
  colliders.push({ t: 'e', x: TEICH.x, y: TEICH.y, rx: TEICH.rx - 2, ry: TEICH.ry - 2 });
  colliders.push({ t: 'r', x0: 158, y0: 782, x1: 202, y1: 790 });
  things.push({ y: 790, bbox: [146, 760, 216, 800], draw: ctx => bank(ctx, 180, 790) });
  things.push({ y: 0, bbox: [240, 800, 380, 1000], draw: ctx => { liegendeKarte(ctx, 334, 935, .5, '9', '♣'); liegendeKarte(ctx, 262, 812, -.3, '', '', true); } });
  return { things, colliders, stations };
}

/* Lichtschein als einmal gerendertes Bild (schneller als ein Verlauf pro Frame) */
let glowImg = null;
function glow(ctx, x, y, r) {
  if (!glowImg) {
    glowImg = document.createElement('canvas'); glowImg.width = glowImg.height = 64;
    const g = glowImg.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,205,110,.42)'); gr.addColorStop(1, 'rgba(255,205,110,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  ctx.drawImage(glowImg, x - r, y - r, 2 * r, 2 * r);
}
function fensterLicht(ctx, x, y, w, h) {
  glow(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 1.4);
  ctx.fillStyle = LAMP; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#3d2a1c'; ctx.lineWidth = 1.6; ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
}

/* Stationsschild: Holzbrett auf Pfosten, Fußpunkt (x, y). sub = Zeile 2 („312 · Titel“); ist sie
   breiter als SUB_MAX, wird sie am „ · “ auf zwei Zeilen verteilt (Punkte in Mono, Titel in Textschrift).
   Das Brett bleibt innerhalb der Weltgrenzen (der Pfosten steht weiter auf x). → Bildschirm-Hülle */
const SUB_MAX = 124;
export function schild(ctx, x, y, name, sub, hi) {
  ctx.save();
  const F1 = `700 13px ${FONT.body}`, F2 = `600 9.5px ${FONT.mono}`, F3 = `700 11px ${FONT.body}`;
  ctx.font = F1; const w1 = ctx.measureText(name).width;
  ctx.font = F2; let lines = [[sub, F2, ctx.measureText(sub).width]];
  if (lines[0][2] > SUB_MAX && sub.includes(' · ')) {
    const [a, ...rest] = sub.split(' · '), b = rest.join(' · ');
    const wa = ctx.measureText(a).width; ctx.font = F3;
    lines = [[a, F2, wa], [b, F3, ctx.measureText(b).width]];
  }
  const w = Math.ceil(Math.max(w1, ...lines.map(l => l[2]))) + 18, h = 23 + lines.length * 12.5;
  const bx = Math.max(4, Math.min(WW - 4 - w, x - w / 2)), by = y - 14 - h, cx = bx + w / 2;
  ctx.fillStyle = WOOD; ctx.fillRect(x - 2.5, by + h - 2, 5, 16);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; rr(ctx, bx + 1, by + 3, w, h, 5); ctx.fill();
  ctx.fillStyle = '#6b4630'; rr(ctx, bx, by, w, h, 5); ctx.fill();
  ctx.strokeStyle = hi ? '#e8c96b' : '#4a2f1d'; ctx.lineWidth = hi ? 2 : 1.5; rr(ctx, bx + 2, by + 2, w - 4, h - 4, 4); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f6ecd6'; ctx.font = F1; ctx.fillText(name, cx, by + 16);
  lines.forEach(([txt, f], i) => { ctx.fillStyle = i ? '#f1dcae' : '#e8c96b'; ctx.font = f; ctx.fillText(txt, cx, by + 29 + i * 12.5); });
  ctx.restore();
  return [bx, by, bx + w, y];
}

/* Neuner auf zwei Beinchen (flieht vor dem Vogel) */
export function laufNeuner(ctx, x, y, t, run, suit, facing) {
  ctx.save(); ctx.translate(x, y);
  shadow(ctx, 0, 0, 9, 3, .18);
  const ph = t * (run ? 22 : 9), hop = Math.abs(Math.sin(ph)) * (run ? 3 : 1);
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3, -8 - hop); ctx.lineTo(-3 + Math.sin(ph) * 3, 0); ctx.moveTo(3, -8 - hop); ctx.lineTo(3 - Math.sin(ph) * 3, 0); ctx.stroke();
  card(ctx, 0, -20 - hop, facing * (run ? .18 : .05), '9', suit, .42);
  if (run) { ctx.fillStyle = '#8fc3dd'; ctx.beginPath(); ctx.ellipse(-facing * 11, -32 - hop, 2, 3, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
