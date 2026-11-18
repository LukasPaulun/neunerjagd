/* Eingabe: Touch (und Maus als Fallback) auf dem Canvas, normalisiert zu
   { type: 'down'|'move'|'up'|'cancel', id, x, y, pointer: 'touch'|'mouse', pressed }
   x/y in Weltkoordinaten. id = Touch-identifier bzw. 'mouse'.
   Maus-'move' kommt auch ohne gedrückte Taste (pressed=false), Touch-'move' immer mit pressed=true. */
import { toWorld } from './stage.js';

export function attachInput(canvas, handler) {
  const emit = (type, id, cx, cy, pointer, pressed) => {
    const p = toWorld(cx, cy);
    handler({ type, id, x: p.x, y: p.y, pointer, pressed });
  };
  const touch = type => e => {
    if (e.cancelable) e.preventDefault();
    for (const t of e.changedTouches) emit(type, t.identifier, t.clientX, t.clientY, 'touch', type === 'down' || type === 'move');
  };
  const o = { passive: false };
  canvas.addEventListener('touchstart', touch('down'), o);
  canvas.addEventListener('touchmove', touch('move'), o);
  canvas.addEventListener('touchend', touch('up'), o);
  canvas.addEventListener('touchcancel', touch('cancel'), o);
  let down = false;
  canvas.addEventListener('mousedown', e => { down = true; emit('down', 'mouse', e.clientX, e.clientY, 'mouse', true); });
  canvas.addEventListener('mousemove', e => emit('move', 'mouse', e.clientX, e.clientY, 'mouse', down));
  addEventListener('mouseup', e => { if (!down) return; down = false; emit('up', 'mouse', e.clientX, e.clientY, 'mouse', false); });
}

/* Relatives Ziehen (wie ein Trackpad): Der Finger muss nicht auf dem Objekt liegen.
   const drag = relDrag(1.5);
   down:  drag.start(ev, obj.x, obj.y)
   move:  const p = drag.move(ev); if (p) { obj.x = p.x; obj.y = p.y; }
          nach Begrenzen: drag.rebase(ev, obj.x, obj.y)  (sonst "klebt" der Finger am Rand)
   up:    drag.end(ev)   (ohne ev: beendet immer) */
export function relDrag(gain = 1) {
  let d = null;
  return {
    start(ev, ax, ay) { d = { id: ev.id, fx: ev.x, fy: ev.y, ax, ay }; },
    move(ev) { if (!d || ev.id !== d.id) return null; return { x: d.ax + (ev.x - d.fx) * gain, y: d.ay + (ev.y - d.fy) * gain }; },
    rebase(ev, ax, ay) { if (d) d = { id: d.id, fx: ev.x, fy: ev.y, ax, ay }; },
    end(ev) { if (!ev || !d || ev.id === d.id) d = null; },
    get active() { return !!d; },
  };
}
