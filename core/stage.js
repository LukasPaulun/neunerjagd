/* Bühne: Canvas mit festen Weltkoordinaten 360×640, skaliert auf die Bühnenbreite,
   Auflösung nach devicePixelRatio (max. 3). */
export const VW = 360, VH = 640, HUD = 58;

let cv, ctx, stageEl, onFit = () => {};
let sx = 1, sy = 1;

export function initStage(stage, canvas, redraw) {
  stageEl = stage; cv = canvas; ctx = cv.getContext('2d'); onFit = redraw;
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stageEl); else addEventListener('resize', fit);
  fit();
  return ctx;
}

function fit() {
  const r = stageEl.getBoundingClientRect(); if (!r.width) return;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  sx = cv.width / VW; sy = cv.height / VH;
  resetTransform();
  onFit();
}

/* Setzt die Weltkoordinaten-Transformation zurück (vor jedem draw durch die Engine). */
export function resetTransform() {
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

/* Bildschirm (clientX/Y) -> Weltkoordinaten */
export function toWorld(cx, cy) {
  const r = cv.getBoundingClientRect();
  return { x: (cx - r.left) * VW / r.width, y: (cy - r.top) * VH / r.height };
}
