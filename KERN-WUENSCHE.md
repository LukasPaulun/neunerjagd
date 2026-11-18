# Wünsche an den Kern (core/)

Parallel arbeitende Agenten ändern `core/` nicht. Wünsche hier eintragen, **nur im Abschnitt
des eigenen Spiels** (so gibt es beim Zusammenführen keine Konflikte). Pro Wunsch: was, warum,
welche lokale Übergangslösung im Spiel steckt (Datei/Funktion).

## flatterflug

(keine)

## neuner-hauen

- **Erledigt:** `C.dark` in `core/theme.js`; `games/neuner-hauen.js` nutzt es statt `isDark()`.
  Ursprünglicher Wunsch: **Hell/Dunkel-Kennung in `C`** (z. B. `C.dark = true/false` in `core/theme.js`). Warum: Festfarben wie die
  Holz-Tischplatte sollen im Dunkelmodus leicht abgedunkelt werden. Übergangslösung: `isDark()` in
  `games/neuner-hauen.js` schätzt die Helligkeit aus `C.bg`.

## neunerschiessen

(keine)

## kartenhaus

(keine)
