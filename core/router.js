/* Hash-Routing: '#/' = Menü/Hub, '#/spiel/<id>' = Spiel. */
const ID = /^[_a-z0-9-]+$/;

export function parse(hash = location.hash) {
  const m = /^#\/spiel\/([^/?#]+)/.exec(hash || '');
  if (m && ID.test(m[1])) return { view: 'spiel', id: m[1] };
  return { view: 'hub' };
}
export const hrefSpiel = id => '#/spiel/' + id;
export function go(hash) { if (location.hash === hash) dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; }
export function onRoute(cb) { addEventListener('hashchange', () => cb(parse())); }
export const validId = id => ID.test(id);
