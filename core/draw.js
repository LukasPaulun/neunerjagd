/* Zeichen-Helfer für alle Spiele. Alle Funktionen zeichnen in Weltkoordinaten und
   stellen den ctx-Zustand (save/restore) selbst wieder her, außer rr (nur Pfad). */
import { C } from './theme.js';
import { VW, VH, HUD } from './stage.js';

export const RANKS = ['10', 'B', 'D', 'K', 'A'];   // "unschuldige" Ränge (ohne 9)
export const SUITS = ['♣', '♠', '♥', '♦'];
export const isRed = suit => suit === '♥' || suit === '♦';
export const isDulle = (rank, suit) => rank === '10' && suit === '♥';
export const WOOD = '#5a3b26';

/* Pfad eines abgerundeten Rechtecks (danach fill()/stroke()). */
export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* Spielkarte, Mittelpunkt (x,y), Grundgröße 40×56, rot in Radiant, s = Skalierung. */
export function card(ctx, x, y, rot, rank, suit, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.6; rr(ctx, -20, -28, 40, 56, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = isRed(suit) ? '#c0261b' : '#111'; ctx.font = '700 19px Georgia,serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(rank + suit, 0, 1); ctx.restore();
}

/* Der Neuntöter (Seitenansicht). Mittelpunkt etwa am Bauch, Breite ca. 90 bei scale 1.3.
   o.facing  -1 = Schnabel links (Standard), 1 = Schnabel rechts
   o.scale   Standard 1.3 (Größe in der Neunerjagd)
   o.wing    Flügelstellung -1..1 (z. B. Math.sin(phase)), 0 = ruhig
   o.mouth   Schnabel offen 0..1 (0.5 = Würgen in der Neunerjagd)
   o.hurt    Rest-Zeit eines Treffers in s (>0 = Blinken)
   o.belly   Kropf-Füllung 0..8 (Bauch wird dicker)
   o.alpha   Deckkraft */
export function neuntoeter(ctx, x, y, o = {}) {
  const facing = o.facing ?? -1, sc = o.scale ?? 1.3, w = (o.wing ?? 0) * 10, open = o.mouth ?? 0, kl = o.belly ?? 0, hurt = o.hurt ?? 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc * (facing < 0 ? 1 : -1), sc);
  ctx.globalAlpha = o.alpha ?? 1;
  if (hurt > 0 && ((hurt * 20) | 0) % 2) ctx.globalAlpha *= .4;
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.moveTo(14, 4); ctx.lineTo(44, 14); ctx.lineTo(42, 20); ctx.lineTo(12, 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f1e2d6'; ctx.beginPath(); ctx.ellipse(2, 6 + kl * .4, 22 + kl * 1.2, 15 + kl * .6, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9b4a26'; ctx.beginPath(); ctx.ellipse(6, 0, 20, 10, 0.1, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7b3519'; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.quadraticCurveTo(14, -14 - w, 30, -6 - w * 1.4); ctx.quadraticCurveTo(18, 4, -2, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9aa6b1'; ctx.beginPath(); ctx.arc(-16, -6, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#141414'; ctx.fillRect(-30, -8, 24, 5);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-19, -6, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#161616';
  ctx.save(); ctx.translate(-27, -5); ctx.rotate(-open * .6); ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(-13, 0); ctx.quadraticCurveTo(-15, 3, -11, 5); ctx.lineTo(0, 1); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(-27, -3); ctx.rotate(open * .8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-11, 1); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.restore();
}

/* Ein einzelner Dorn: Dreieck mit Basis bei (x,y), Länge len, Winkel ang (0 = nach oben,
   positiv = nach rechts geneigt), Basisbreite base. */
export function dorn(ctx, x, y, len = 28, ang = 0, base = 8, color = WOOD) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-base / 2, 0); ctx.lineTo(0, -len); ctx.lineTo(base / 2, 0); ctx.closePath(); ctx.fill(); ctx.restore();
}

/* Dornbusch-Ast quer über die Bühne (wie in der Neunerjagd): weicher Busch-Schatten,
   geschwungener Ast bei Höhe y, n Dornen. */
export function dornAst(ctx, y = 572, n = 8) {
  ctx.save();
  ctx.fillStyle = C.thorn; ctx.globalAlpha = .22; ctx.beginPath(); ctx.ellipse(VW / 2, VH + 20, VW * .7, 110, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = WOOD; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, y + 20); ctx.bezierCurveTo(VW * .3, y + 6, VW * .6, y + 12, VW, y - 4); ctx.stroke();
  ctx.fillStyle = WOOD;
  for (let i = 0; i < n; i++) { const x = (i + .5) * VW / n, yy = y + 18 - (x / VW) * 24; ctx.beginPath(); ctx.moveTo(x - 4, yy); ctx.lineTo(x + (i % 2 ? 7 : -7), yy - 28); ctx.lineTo(x + 4, yy); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

/* Position der i-ten aufgespießten Karte auf dornAst(y, n): {x, y, r}. Ab i >= n
   wird in Reihen darüber gestapelt. Karte mit card(ctx, p.x, p.y, p.r, '9', suit, .7) zeichnen. */
export function dornSlot(i, y = 572, n = 8) {
  const k = i % n, row = Math.floor(i / n); const x = (k + .5) * VW / n;
  return { x, y: y + 18 - (x / VW) * 24 - 12 - row * 7, r: (k % 2 ? .25 : -.25) };
}

/* Ruhiger Hintergrund: Fläche in --surface und 5 weiche, langsam treibende Kreise.
   t = Zeit in s (für die Drift). */
export function hintergrund(ctx, t = 0) {
  ctx.save();
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = C.line; ctx.globalAlpha = .55;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc((i * 157 + t * 8) % (VW + 120) - 60, HUD + 60 + (i * 61) % 220, 24 + i * 7, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
