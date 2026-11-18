/* Lokale Bestleistungen und Spielstände (localStorage, pro Gerät). Alle Zugriffe in try,
   damit private Modi / gesperrter Speicher nichts kaputt machen.
   Schlüssel:
     stammtisch-best-<id>       JSON {score, title}
     stammtisch-<id>-<key>      JSON, frei pro Spiel (save/load)
     stammtisch-zuletzt         id des zuletzt geöffneten Spiels
     neunerjagd-best            Altschlüssel (Zahl) der Neunerjagd, wird weiter gelesen und geschrieben */
const LEGACY = { neunerjagd: 'neunerjagd-best' };

const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

/* -> {score, title}; score 0 und title '' wenn noch nichts gespeichert. */
export function getBest(id) {
  let r = { score: 0, title: '' };
  try { const j = JSON.parse(get('stammtisch-best-' + id)); if (j && typeof j.score === 'number') r = { score: j.score, title: j.title || '' }; } catch (e) {}
  if (LEGACY[id]) { const old = +get(LEGACY[id]) || 0; if (old > r.score) r = { score: old, title: '' }; }
  return r;
}

/* Speichert nur, wenn score höher als die bisherige Bestleistung. -> true bei neuem Rekord. */
export function setBest(id, score, title = '') {
  if (!(score > getBest(id).score)) return false;
  set('stammtisch-best-' + id, JSON.stringify({ score, title }));
  if (LEGACY[id]) set(LEGACY[id], String(score));
  return true;
}

export function load(id, key, fallback = null) {
  try { const v = get(`stammtisch-${id}-${key}`); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
}
export function save(id, key, value) { set(`stammtisch-${id}-${key}`, JSON.stringify(value)); }

export function getLast() { return get('stammtisch-zuletzt') || ''; }
export function setLast(id) { set('stammtisch-zuletzt', id); }
