/* Kleine Helfer ohne DOM-Zugriff (außer vibrate). */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1)); // a..b inklusive
export const pick = arr => arr[Math.random() * arr.length | 0];
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/* Vibration als Feedback: ms (Zahl) oder Muster ([an, aus, an, …]). Sparsam einsetzen. */
export function vibrate(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
