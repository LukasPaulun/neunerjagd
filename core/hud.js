/* HUD (Canvas) und schwebende Punkt-Anzeigen. */
import { C } from './theme.js';
import { VW, HUD } from './stage.js';

const MONO = '"IBM Plex Mono",monospace';

/* Hintergrund-Band oben (Höhe HUD = 58) mit Trennlinie. */
export function hudBar(ctx) {
  ctx.fillStyle = C.veil; ctx.fillRect(0, 0, VW, HUD); ctx.fillStyle = C.line; ctx.fillRect(0, HUD - 1, VW, 1);
}
/* Beschriftung in Versalien (y = 20). */
export function hudLabel(ctx, x, text) {
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.font = `600 12px ${MONO}`; ctx.fillStyle = C.muted; ctx.fillText(text, x, 20);
}
/* Wert in Mono 20px (y = 44). color: Standard C.ink. */
export function hudValue(ctx, x, value, color) {
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.font = `600 20px ${MONO}`; ctx.fillStyle = color || C.ink; ctx.fillText(String(value), x, 44);
}
/* Leben als Herzen (y = 44), "–" bei 0. */
export function hudHearts(ctx, x, lives) {
  ctx.textBaseline = 'alphabetic'; ctx.font = '16px Georgia,serif'; ctx.fillStyle = C.bad; ctx.textAlign = 'left';
  ctx.fillText('♥'.repeat(Math.max(0, lives)) || '–', x, 44);
}
/* Komplettes HUD aus Feldern: [{x, label, value, color?, hearts?:true}] */
export function hud(ctx, fields) {
  hudBar(ctx);
  for (const f of fields) {
    hudLabel(ctx, f.x, f.label);
    if (f.hearts) hudHearts(ctx, f.x, f.value); else hudValue(ctx, f.x, f.value, f.color);
  }
}

/* Schwebende Texte ("+9", "Foul"). Pro Spiel eine Instanz:
   const pops = createPopups(); pops.add(x, y, '+9', C.ok); in step: pops.step(dt); in draw: pops.draw(ctx)
   o.outline: Farbe eines Konturrands (für Text auf unruhigem Grund, z. B. Holz) */
export function createPopups(o = {}) {
  let list = [];
  return {
    add(x, y, txt, col) { list.push({ x: Math.max(90, Math.min(VW - 90, x)), y, txt, col: col || C.ink, a: 1 }); },
    step(dt) { for (const p of list) { p.y -= 36 * dt; p.a -= dt * 0.9; } list = list.filter(p => p.a > 0); },
    draw(ctx) {
      ctx.save(); ctx.font = `700 16px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      if (o.outline) { ctx.strokeStyle = o.outline; ctx.lineWidth = 4; ctx.lineJoin = 'round'; }
      for (const p of list) {
        ctx.globalAlpha = Math.max(0, p.a);
        if (o.outline) ctx.strokeText(p.txt, p.x, p.y);
        ctx.fillStyle = p.col; ctx.fillText(p.txt, p.x, p.y);
      }
      ctx.restore();
    },
    clear() { list = []; },
    get count() { return list.length; },
  };
}
