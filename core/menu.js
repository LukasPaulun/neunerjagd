/* Listen-Menü (#/liste): einfache Liste aller Spiele mit Bestleistung und Titel.
   Ersatz für die Oberwelt (Fehlersuche, Barrierefreiheit). Gleiche Schnittstelle wie core/oberwelt.js:
   hub = { el, games:[{id,name,station,best:{score,title}}], from, open(id), ctx, C, VW, VH, loop(fn) }
   Bildschirm = { draw(ctx), onPointer(ev), unmount() } */
import { hintergrund, dornAst, dornSlot, card, neuntoeter } from './draw.js';

export default {
  mount(hub) {
    const { el, games, from } = hub;
    el.className = 'menu';
    const head = document.createElement('div'); head.className = 'menu-head';
    const h = document.createElement('h2'); h.textContent = 'Disziplinen';
    const p = document.createElement('p'); p.className = 'rules'; p.textContent = 'Satzungsgemäße Freizeitgestaltung. Wählen Sie eine Disziplin.';
    head.append(h, p);
    const list = document.createElement('ul'); list.className = 'menu-list';
    for (const g of games) {
      const li = document.createElement('li');
      const a = document.createElement('a'); a.href = '#/spiel/' + g.id; a.className = 'menu-item' + (g.id === from ? ' from' : '');
      a.dataset.id = g.id;
      const n = document.createElement('span'); n.className = 'mi-name'; n.textContent = g.name;
      const s = document.createElement('span'); s.className = 'mi-station'; s.textContent = g.station || '';
      const b = document.createElement('span'); b.className = 'mi-best';
      b.textContent = g.best.score ? `${g.best.score} · ${g.best.title}` : 'noch keine Wertung';
      a.append(n, s, b); li.append(a); list.append(li);
    }
    if (!games.length) { const li = document.createElement('li'); li.className = 'rules'; li.textContent = 'Keine Spiele registriert.'; list.append(li); }
    el.append(head, list);
    el.hidden = false;
    el.querySelector('.from')?.focus({ preventScroll: true });

    const spiked = ['♣', '♥', '♠', '♦', '♣'];
    return {
      draw(ctx) {
        hintergrund(ctx, 0);
        dornAst(ctx);
        spiked.forEach((s, i) => { const q = dornSlot(i); card(ctx, q.x, q.y, q.r, '9', s, .7); });
        neuntoeter(ctx, 292, 540, { facing: -1, scale: 1.1 });
      },
      onPointer() {},
      unmount() { el.replaceChildren(); el.hidden = true; },
    };
  },
};
