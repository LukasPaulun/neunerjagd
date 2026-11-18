/* Farben aus den CSS-Variablen. C ist ein lebendes Objekt: es wird bei Theme-Wechsel
   in place aktualisiert, Referenzen darauf bleiben gültig. */
export const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export const C = {};

export function refreshColors() {
  Object.assign(C, {
    bg: css('--surface'), paper: css('--paper'), ink: css('--ink'), muted: css('--muted'), line: css('--line'),
    thorn: css('--thorn'), ok: css('--ok'), bad: css('--bad'), gold: css('--gold'), ch: css('--chestnut'),
    veil: css('--veil'),
  });
}

/* Ruft cb() nach jedem Theme-Wechsel (System-Dunkelmodus oder data-theme) auf. */
export function onThemeChange(cb) {
  const h = () => { refreshColors(); cb(); };
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', h); } catch (e) {}
  new MutationObserver(h).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

refreshColors();
