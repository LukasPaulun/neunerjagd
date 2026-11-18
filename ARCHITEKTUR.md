# Stammtisch-Spiele – Architektur

Technische Grundlage für alle Minispiele. Gestaltung und Spielregeln: `DESIGN.md` (verbindlich).
Reines HTML/CSS/JS mit ES-Modulen, **kein Build-Schritt, keine npm-Abhängigkeiten**. Läuft auf
GitHub Pages direkt aus dem Repo-Wurzelverzeichnis (alle Pfade relativ).

## Dateien

```
index.html            Hülle: Kopfzeile (Titel, Zurück-Knopf, Lautsprecher), Bühne (Canvas, Overlay, Pause-Knopf, Hub-Container), CSS
core/main.js          Einstieg: Bühne, Eingabe, Routing, lädt Spiele aus der Registry, Test-Hook
core/engine.js        Spiel-Laufzeit: Schleife, Overlay Start/Pause/Ende, Bestleistung, rankTitle()
core/stage.js         VW/VH/HUD, Canvas-Skalierung (devicePixelRatio), toWorld()
core/theme.js         Farben C aus CSS-Variablen (hell/dunkel), css()
core/input.js         Touch/Maus -> normalisierte Ereignisse, relDrag()
core/draw.js          rr, card, neuntoeter, dorn, dornAst, dornSlot, hintergrund, Kartenkonstanten
core/hud.js           hud, hudBar, hudLabel, hudValue, hudHearts, createPopups
core/util.js          clamp, lerp, rand, randInt, pick, dist, vibrate
core/store.js         Bestleistungen und Spielstände (localStorage)
core/audio.js         Ton: Musik (Aufnahmen aus musik/, sonst erzeugter Walzer/Polka) und Geräusche (Web Audio), Tonmodus
core/router.js        Hash-Routing
core/oberwelt.js      Hub: Oberwelt „Stammtischdorf“ (Bewegung, Wegfindung, Kamera, Eingangskarte, Bestenliste)
core/oberwelt-welt.js Oberwelt: Stationstabelle STATIONEN, Wege, Bäume, Zäune, Bauten (Zeichnen)
core/menu.js          Listen-Menü unter #/liste (Rückfall für Fehlersuche und Barrierefreiheit)
games/registry.js     Liste der Spiel-ids (einzige gemeinsam bearbeitete Datei)
games/neunerjagd.js   Neunerjagd
games/_vorlage.js     Kommentiertes Minimalspiel zum Kopieren (nicht im Menü)
tests/smoke.py        Rauchtest (Playwright)
tests/oberwelt.py     Ablauftest der Oberwelt (Playwright)
KERN-WUENSCHE.md      Änderungswünsche an core/ von parallelen Agenten
musik/                optional: Musikaufnahmen (dorf.mp3, <spiel-id>.mp3, spiel.mp3) und credits.json, siehe „Ton“
```

Ein Spiel = **eine Datei** `games/<id>.js`. Größere Spiele dürfen zusätzliche Dateien in
`games/<id>/` anlegen (z. B. vendorte Bibliothek `games/kartenhaus/matter.min.js`, Level-Daten)
und relativ importieren.

## Routing

- `#/` (oder leer/unbekannt) → Hub (Oberwelt). `#/liste` → Listen-Menü. `#/spiel/<id>` → Spiel.
- Die id muss `[_a-z0-9-]+` sein. Ein Spiel, das (noch) nicht in der Registry steht, ist trotzdem
  über `#/spiel/<id>` erreichbar (wird per `import('../games/<id>.js')` geladen). So läuft die
  Vorlage (`#/spiel/_vorlage`) und so kann man ein neues Spiel vor dem Eintragen testen.
- Lokal: `python3 -m http.server` im Repo, dann `http://localhost:8000/#/spiel/<id>`.
  (`file://` geht nicht, ES-Module brauchen HTTP.)
- „Zurück“ (Kopfzeile, `‹ Stammtisch`) führt nach `#/`. Die Engine merkt sich das zuletzt
  geöffnete Spiel (`stammtisch-zuletzt`); der Hub bekommt es als `from` (Menü hebt es hervor,
  die Oberwelt hebt das Schild hervor). Kommt man direkt aus einem Spiel (`fromGame`), stellt die
  Oberwelt den Vogel vor diese Station, sonst an die gespeicherte Position.

## Hülle (`index.html`, `core/main.js`)

- Kopfzeile: Titel schrumpft per Skript, bis er in die Zeile passt (kein „Der Stammti…“).
- Bühne 9:16, so breit wie möglich (höchstens Bildschirmhöhe − 88 px), senkrecht mittig im Rest.
- Querformat auf Touch-Handys (`orientation: landscape`, `pointer: coarse`, Höhe ≤ 600 px): Vollbild-
  Hinweis „Bitte das Handy hochkant halten“ mit drehendem Handy-Symbol; ein laufendes Spiel pausiert.

## Koordinaten

- Welt fest **360 × 640** (`VW`, `VH`), Ursprung oben links, y nach unten. Gilt für Zeichnen und Eingabe.
- Der Canvas wird auf die Bühnenbreite skaliert (9:16), Auflösung × devicePixelRatio (max. 3).
  Die Engine setzt vor jedem `draw` die Transformation zurück (`globalAlpha = 1`); Spiele dürfen
  sie innerhalb von `draw` frei verändern (am besten mit `save/restore`).
- HUD-Band oben: `HUD = 58`. Spielfläche darunter. Unten rechts (ca. x > 300, y > 590) liegt
  der Pause-Knopf als DOM-Element über dem Canvas: dort keine wichtigen Touch-Ziele.
- Touch-Ziele mindestens 44 × 44 Welt-Einheiten.

## Spiel-Vertrag

Jedes Spiel exportiert per `export default` ein Objekt:

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | = Dateiname ohne `.js`, `[_a-z0-9-]+` |
| `name` | ja | Titel (Kopfzeile, Start-Overlay, Menü) |
| `station` | ja | Name der Station in der Oberwelt (siehe DESIGN.md) |
| `intro` | ja | Kurzregel im Start-Overlay, ein Absatz, gesiezt |
| `rules` | nein | Array von Zeilen (Regelzeile, klein, grau) |
| `titles` | ja | `[[abPunkten, 'Titel'], …]` aufsteigend, erster Eintrag ab 0 |
| `startLabel` | nein | Text Start-Knopf (Standard `Start`) |
| `againLabel` | nein | Text Knopf am Ende (Standard `Nochmal`) |
| `pauseText` | nein | Text im Pause-Overlay |
| `test` | nein | Hinweise für den Rauchtest, siehe unten |
| `create(api)` | ja | erzeugt eine Spielinstanz (siehe unten) |

`create(api)` wird **einmal pro Öffnen** des Spiels aufgerufen. Der gesamte Zustand lebt in der
Closure von `create` (keine globalen Variablen, nichts an `window` hängen). Rückgabe:

| Methode | Pflicht | Aufruf durch die Engine |
|---|---|---|
| `reset()` | ja | direkt nach `create` (Bild hinter dem Start-Overlay) und vor jedem Start |
| `step(dt)` | ja | jeder Frame während des Spiels, `dt` in Sekunden, höchstens 0.05 |
| `draw(ctx)` | ja | nach jedem `step`; außerdem bei Größen-/Theme-Wechsel und hinter Overlays |
| `onPointer(ev)` | nein | Eingabe, **nur während des Spiels** (nicht in Overlays) |
| `forceEnd()` | nein | Test-Hook: sofort `api.end(...)` mit aktuellem Stand aufrufen |
| `destroy()` | nein | beim Verlassen (Timer, eigene Listener aufräumen) |

Ablauf (Engine-Zustände `intro` → `play` ⇄ `pause`, `play` → `over` → `play` …):
Start-Knopf → `reset()` → Schleife `step/draw`. Pause-Knopf oder App-Wechsel → `pause`.
Das Spiel beendet eine Runde selbst mit `api.end({ score, text })`. Die Engine zeigt dann den
Rang-Titel als Überschrift, `text` als Absatz, den Knopf `againLabel` und die Bestleistung.
Der Knopf am Ende nimmt erst nach 0,8 s Eingaben an (blendet dann ein), damit noch tippende Spieler
nicht versehentlich neu starten.

Overlay-Texte (`intro`, `rules`, `text`): Die Engine setzt geschützte Leerzeichen zwischen Zahl und
Wort („+9“, „−18“, „3 Leben“ brechen nicht um). Die Overlay-Schrift skaliert mit der Bühne
(CSS-Container-Einheiten), der Textblock darf schrumpfen und scrollen; Titel und Knopf bleiben
immer sichtbar (geprüft bis 320 × 568 und 375 × 553). Kurz halten lohnt sich trotzdem.

`draw` muss jederzeit funktionieren, auch vor dem ersten `step` (nach `reset`).

### Vollständiges Beispiel

```js
import { card, neuntoeter, dornAst, hintergrund, isDulle, RANKS, SUITS } from '../core/draw.js';
import { hud, createPopups } from '../core/hud.js';
import { rand, pick } from '../core/util.js';

export default {
  id: 'beispiel', name: 'Beispiel', station: 'Werkstatt',
  intro: 'Tippen Sie auf fallende Neuner.',
  rules: ['Neuner +9 · Andere Karte −1 Leben · Dulle −2', '30 Sekunden'],
  titles: [[0, 'Anwärter'], [45, 'Mitglied'], [90, 'Kassenprüfer']],
  startLabel: 'Los', againLabel: 'Nochmal', pauseText: 'Das Beispiel ruht.',
  test: { sekunden: 4, gesten: ['tap'] },

  create(api) {
    const { VW, VH, HUD, C } = api;
    const pops = createPopups();
    let cards, score, lives, t;

    function reset() { cards = []; pops.clear(); score = 0; lives = 3; t = 0; }
    function step(dt) {
      t += dt; pops.step(dt);
      if (Math.random() < dt * 1.5) cards.push({ x: rand(40, VW - 40), y: HUD, rank: Math.random() < .5 ? '9' : pick(RANKS), suit: pick(SUITS) });
      for (const c of cards) c.y += 120 * dt;
      cards = cards.filter(c => c.y < VH + 40);
      if (lives <= 0 || t >= 30) api.end({ score, text: `${score} Punkte.` });
    }
    function draw(ctx) {
      hintergrund(ctx, t); dornAst(ctx);
      for (const c of cards) card(ctx, c.x, c.y, 0, c.rank, c.suit);
      neuntoeter(ctx, VW / 2, 520, { wing: Math.sin(t * 14) });
      pops.draw(ctx);
      hud(ctx, [{ x: 12, label: 'PUNKTE', value: score, color: C.ch }, { x: 288, label: 'LEBEN', value: lives, hearts: true }]);
    }
    function onPointer(ev) {
      if (ev.type !== 'down') return;
      const c = cards.find(c => Math.abs(c.x - ev.x) < 30 && Math.abs(c.y - ev.y) < 36);
      if (!c) return;
      cards.splice(cards.indexOf(c), 1);
      if (c.rank === '9') { score += 9; pops.add(c.x, c.y, '+9', C.ok); }
      else { lives -= isDulle(c.rank, c.suit) ? 2 : 1; api.vibrate(80); pops.add(c.x, c.y, 'Foul', C.bad); }
    }
    return { reset, step, draw, onPointer, forceEnd: () => api.end({ score, text: 'Testabbruch.' }) };
  },
};
```

Lauffähige, kommentierte Fassung: `games/_vorlage.js`.

## Das `api`-Objekt (Parameter von `create`)

| Name | Signatur | Zweck |
|---|---|---|
| `id` | string | eigene id |
| `VW`, `VH`, `HUD` | 360, 640, 58 | Weltmaße |
| `C` | Objekt | aktuelle Farben (s. u.), wird bei Theme-Wechsel in place aktualisiert |
| `ctx` | CanvasRenderingContext2D | derselbe ctx wie in `draw`; nur in `draw` zeichnen |
| `end({score, text, title?})` | → void | Runde beenden. `score` Zahl (höher = besser), `text` Absatz fürs Overlay, `title` überschreibt den Titel aus `titles` |
| `pause()` | → void | Pause-Overlay öffnen (sonst macht das die Engine) |
| `state` | `'intro'|'play'|'pause'|'over'` | aktueller Zustand |
| `requestDraw()` | → void | sofort neu zeichnen (außerhalb des Spiels) |
| `vibrate(ms | muster)` | → void | sicher gekapselt |
| `best()` | → `{score, title}` | eigene Bestleistung |
| `load(key, fallback)` | → JSON-Wert | eigener Speicher, Schlüssel `stammtisch-<id>-<key>` |
| `save(key, value)` | → void | z. B. Level-Fortschritt (Kartenhaus) |
| `sfx(name, opts?)` | → void | Geräusch abspielen (Liste unter „Ton“); still, wenn Ton aus oder noch nicht entsperrt |
| `audio.sfx(name, opts?)` | → void | dasselbe |
| `audio.setIntensity(x)` | x 0..1 → void | Schwierigkeit fürs Polka-Tempo (bis +18 %); ohne Aufruf steigt es mit der Spielzeit (90 s) |

**Spiele fassen das DOM nicht an** (kein `document`, kein `window`-Listener, keine eigenen
Elemente). Alles läuft über Canvas, `onPointer` und `api`. Timer nur über `step(dt)` (keine
`setInterval`), damit Pause funktioniert.

### Farben `C`

`C.bg` (Fläche, `--surface`), `C.paper`, `C.ink`, `C.muted`, `C.line`, `C.thorn`, `C.ok`,
`C.bad`, `C.gold`, `C.ch` (Kastanie, `--chestnut`), `C.veil`, `C.dark` (`true` im Dunkelmodus,
z. B. um Festfarben wie Holz abzudunkeln). Immer `C.x` zum Zeitpunkt des
Zeichnens lesen (nicht in einer Konstante zwischenspeichern), dann wirkt der Dunkelmodus sofort.
Karten, Vogel und Holz (`WOOD = '#5a3b26'`) haben feste Farben.

## Hilfsfunktionen (direkt importieren, nur lesen)

Reine Funktionen aus `core/draw.js`, `core/hud.js`, `core/util.js` und `relDrag` aus
`core/input.js` dürfen Spiele direkt importieren (`import { card } from '../core/draw.js'`).

### `core/draw.js`

| Signatur | Beschreibung |
|---|---|
| `RANKS` | `['10','B','D','K','A']` (unschuldige Ränge) |
| `SUITS` | `['♣','♠','♥','♦']` |
| `isRed(suit)`, `isDulle(rank, suit)` | Hilfen |
| `WOOD` | `'#5a3b26'` |
| `rr(ctx, x, y, w, h, r)` | Pfad abgerundetes Rechteck (danach `fill`/`stroke`) |
| `card(ctx, x, y, rot, rank, suit, s = 1)` | Karte, Mittelpunkt x/y, 40×56 bei s = 1, `rot` in Radiant |
| `neuntoeter(ctx, x, y, o)` | Vogel, Seitenansicht, ca. 90 × 50 bei scale 1.3. `o = {facing: -1 (Schnabel links) | 1, scale: 1.3, wing: -1..1, mouth: 0..1, hurt: s Blinkzeit, belly: 0..8, alpha: 1}` |
| `dorn(ctx, x, y, len = 28, ang = 0, base = 8, color = WOOD)` | einzelner Dorn, Basis bei x/y, `ang` 0 = nach oben |
| `dornAst(ctx, y = 572, n = 8)` | Dornbusch-Ast quer über die Bühne mit Busch-Schatten und n Dornen |
| `dornSlot(i, y = 572, n = 8)` | → `{x, y, r}` Platz der i-ten aufgespießten Karte (`card(ctx,p.x,p.y,p.r,'9',suit,.7)`) |
| `hintergrund(ctx, t = 0)` | Fläche + 5 weiche treibende Kreise (Neunerjagd-Hintergrund) |

### `core/hud.js`

| Signatur | Beschreibung |
|---|---|
| `hud(ctx, fields)` | HUD komplett; `fields = [{x, label, value, color?, hearts?}]`; Spalten z. B. x = 12, 96, 224, 288 |
| `hudBar(ctx)` | nur Band + Trennlinie |
| `hudLabel(ctx, x, text)` | Beschriftung Versalien, Mono 12, y = 20 |
| `hudValue(ctx, x, value, color = C.ink)` | Wert Mono 20, y = 44 |
| `hudHearts(ctx, x, lives)` | Herzen in `C.bad`, y = 44 |
| `createPopups(o?)` | → `{add(x, y, text, color), step(dt), draw(ctx), clear(), count}` schwebende Texte; `o.outline` = Farbe eines dunklen Rands (Text auf Holz o. Ä.) |

### `core/util.js`

`clamp(v, a, b)`, `lerp(a, b, t)`, `rand(a, b)`, `randInt(a, b)` (inklusive), `pick(arr)`,
`dist(ax, ay, bx, by)`, `vibrate(ms | muster)`.

## Eingabe

`onPointer(ev)` mit `ev = { type, id, x, y, pointer, pressed }`:

- `type`: `'down' | 'move' | 'up' | 'cancel'`
- `id`: Touch-`identifier` (Zahl) bzw. `'mouse'`. Mehrere Finger = mehrere ids.
- `x, y`: Weltkoordinaten (können außerhalb 0..360/0..640 liegen, wenn der Finger die Bühne verlässt)
- `pointer`: `'touch'` oder `'mouse'` (Maus nur als Test-Fallback)
- `pressed`: Finger/Taste unten. Maus sendet `move` auch ohne Taste (`pressed: false`) – bei
  Bedarf ignorieren.

Gesten selbst auswerten: Tipp = `down` (sofort reagieren, nicht auf `up` warten, außer bei
Wisch-Gesten), Wischen = Differenz `down`→`up`, Ziehen = `move`.

Relatives Ziehen (Trackpad-artig, der Finger verdeckt nichts):

```js
import { relDrag } from '../core/input.js';
const drag = relDrag(1.5);               // Verstärkung
// down:  drag.start(ev, obj.x, obj.y)
// move:  const p = drag.move(ev); if (p) { obj.x = p.x; obj.y = p.y; }
//        nach Begrenzen am Rand: drag.rebase(ev, obj.x, obj.y)
// up:    drag.end(ev)   // ohne ev: immer beenden
```

Tastatur wird nicht unterstützt.

## Bestleistungen und Speicher

- Die Engine speichert beim `end` automatisch, wenn `score` die Bestleistung übertrifft.
  Höhere Punktzahl ist besser (bei anderen Wertungen den Wert passend umrechnen).
- Schlüssel in `localStorage`:
  - `stammtisch-best-<id>` → `{"score": 312, "title": "Neunmörder"}`
  - `neunerjagd-best` → Zahl (Altschlüssel, wird für die Neunerjagd weiter gelesen und geschrieben)
  - `stammtisch-<id>-<key>` → frei pro Spiel (`api.save/load`)
  - `stammtisch-zuletzt` → id des zuletzt geöffneten Spiels
  - `stammtisch-oberwelt-pos` → `{x, y}` Vogelposition in der Oberwelt, `stammtisch-oberwelt-hinweis` → Hinweis gesehen
  - `stammtisch-ton` → `'an' | 'effekte' | 'aus'` (Tonmodus), `stammtisch-ton-hinweis` → iPhone-Hinweis gezeigt
- Wirft `localStorage` (gesperrt, privater Modus), gelten geschriebene Werte trotzdem für die laufende
  Sitzung (Kopie im Speicher, zusätzlich `sessionStorage`): Bestleistung und „zuletzt gespielt“
  gehen nicht verloren, der Vogel steht nach dem Spiel vor der Station.
- `core/store.js`: `getBest(id)`, `setBest(id, score, title)` (nur wenn höher, → true),
  `load(id, key, fallback)`, `save(id, key, value)`, `getLast()`, `setLast(id)`. Spiele nutzen
  stattdessen `api.best/load/save`.

## Ton (`core/audio.js`)

Geräusche werden zur Laufzeit mit der Web Audio API erzeugt (keine Dateien, keine Bibliothek).
Musik kommt bevorzugt aus **Aufnahmen** im Ordner `musik/` (eine pro Ort, siehe unten); fehlt eine,
spielt das erzeugte Lied (eigene Melodien, Notendaten in `audio.js`, Stil kleine Wirtshaus-Blasmusik:
Akkordeon aus zwei verstimmten Sägezähnen mit Tiefpass und Tremolo, Tuba-Bass, Nachschlag-Akkorde,
leises Schlagwerk).

- **Entsperren:** Der AudioContext entsteht erst bei der ersten Nutzergeste (`pointerup`,
  `touchend`, `click`, …, auf `document`), iOS-tauglich. Vorher gewünschte Musik startet dann.
- **Planer:** `setInterval` (25 ms) plant Noten 0,12 s im Voraus auf `ctx.currentTime`.
- **Musik:** Kern und Engine steuern sie, Spiele nicht. Hub (`#/`, `#/liste`) → Walzer „Abendschoppen“
  (F-Dur, 3/4, 104 bpm, 32 Takte, Schleife). Spiel → Polka „Kropfpolka“ (B-Dur, 2/4, 116 bpm,
  24 Takte), je Spiel-id um einige Halbtöne transponiert, Tempo bis +18 % über `setIntensity`.
  Start/„Nochmal“ = Polka von vorn, Pause (Knopf oder App-Wechsel) = Musik pausiert, Ende =
  Musik aus + Tusch (neue Bestleistung) bzw. kurze traurige Posaunenfigur, Verlassen = Musik aus.
  Bei `visibilitychange` (verborgen) wird der ganze Kontext angehalten.
- **Musikdateien (optional, `musik/`)** – eine Aufnahme pro Ort:

| Ort | Datei, der Reihe nach versucht | Rückfall |
|---|---|---|
| Dorf (`#/`, `#/liste`) | `musik/dorf.mp3` | Walzer |
| Spiel `<id>` | `musik/<id>.mp3`, dann `musik/spiel.mp3` | Polka |

  Abgespielt über **ein einziges** `HTMLAudioElement` direkt, **nicht** durch Web Audio
  (`MediaElementSource` ruckelt in iOS-Safari, sobald Effekte laufen). Folgen: kein Tempo-Anstieg,
  keine Lautstärke-Regelung (iOS ignoriert `volume`), keine Überblendung. Tonmodus „Nur Effekte“/„Aus“
  setzt `muted`, Pause und App-Wechsel halten an. Das Element wird bei der ersten Berührung
  freigeschaltet und wechselt danach nur die Quelle; jede Berührung startet eine blockierte Wiedergabe
  erneut. Antwortet der Server mit 404 oder ist die Datei nicht abspielbar, gilt das erzeugte Lied
  (pro Datei für die Sitzung gemerkt; nach 10 s ohne Ladeerfolg ebenfalls Rückfall).
  Dateien: MP3, 96 kbit/s, **Pegel schon fertig gemischt, ca. −25 LUFS** (`ffmpeg -af loudnorm=I=-25:TP=-3`),
  damit die Musik unter den Effekten liegt. Rechte klären!
- **Mitwirkende:** `musik/credits.json` = JSON-Array von Textzeilen (höchstens 12), z. B.
  `["Musik: „Abendschoppen“ – Kapelle XY (CC BY 4.0)"]`. Steht unten in der Bestenliste
  (Vereinsheim), wenn die Datei da ist; sonst nichts. Fehlende Dateien unter `musik/` sind
  kein Testfehler (`tests/smoke.py`, `OPTIONAL`).
- **Geräusche** (`api.sfx(name, opts)`), jedes mit eigener Abklingzeit, global höchstens 48 Stimmen:

| name | wofür | opts |
|---|---|---|
| `neuner` | Neuner aufgespießt („Tock“ + Blip) | `pitch` (Serien, Entfernung) |
| `falsch` | falsche Karte, Aufprall | |
| `dulle` | Dulle getroffen (empörtes Blech) | |
| `flatter` | Flügelschlag (Tonhöhe variiert, max. ca. 14/s) | |
| `schuss` | Dorn abgeschossen | |
| `leer` | Magazin leer (Klick) | |
| `mischen` | Nachladen / Karten rascheln | |
| `spannen` | Schleuder ziehen | `amount` 0..1 |
| `schleudern` | Schleuder loslassen | |
| `klack` | Karten stoßen zusammen | `v` Stoßtempo |
| `hop` | Vogel hüpft im Dorf (sehr leise) | |
| `tap` | Knopf (DOM-Knöpfe automatisch über `main.js`) | |
| `prompt` | Eingangskarte erscheint, kleiner Erfolg | |
| `tusch`, `traurig` | Schlussfiguren (macht die Engine) | |

- **Tonmodus:** Lautsprecher-Knopf oben rechts in der Kopfzeile, Tipp schaltet
  alles an → nur Effekte → aus (Symbol, `aria-label`, kurzer Schriftzug links neben dem Knopf),
  gespeichert in `stammtisch-ton`. Die Schlussfiguren (Tusch, Posaune) sind Effekte und erklingen
  auch bei „Nur Effekte“.
- **iPhone:** iOS stellt Web Audio bei aktivem Lautlos-Schalter stumm. Die Oberwelt zeigt auf
  iOS-Geräten einmal den Hinweis „Kein Ton? Lautlos-Schalter am iPhone prüfen.“ (im selben kleinen
  Hinweiskasten unten wie die Bedienhilfe; verschwindet beim ersten Tipp ins Dorf oder über ×).
- **Schnittstelle (Kern):** `playMusic(name, {tonart, restart, place})` (`place` = `'dorf'` oder
  Spiel-id; die Engine setzt sie), `stopMusic()`, `pauseMusic()`, `resumeMusic()`, `credits()` →
  `Promise<string[]>`.
- **Test-Hook:** `window.__stammtisch.audio` (`state`, `voices`, `music` (bei Aufnahmen mit `file`,
  `time`, `playing`, `rate`), `intensity`, `mode`,
  `sounds`, `render(name, sekunden, opts)` → `Promise<AudioBuffer>` per OfflineAudioContext).

## Spiel eintragen

1. `games/_vorlage.js` nach `games/<id>.js` kopieren, Felder und Logik anpassen.
2. Testen über `#/spiel/<id>` und `python3 tests/smoke.py <id>`.
3. In `games/registry.js` die vorbereitete Zeile der eigenen id einkommentieren (`// ` entfernen).
   **Nur diese eine Zeile ändern**, Leerzeilen stehen lassen (so mergen parallele Zweige konfliktfrei).
   Vorgesehene ids:

| id | Spiel | Station |
|---|---|---|
| `neunerjagd` | Neunerjagd | Dornbusch |
| `flatterflug` | Flatterflug | Windwiese |
| `neuner-hauen` | Neuner hauen | Wirtshaus „Zum Stammtisch“ |
| `neunerschiessen` | Neunerschießen | Schießbude |
| `kartenhaus` | Kartenhaus | Kartenbaustelle |

Die Registry enthält nur ids; die Module werden einzeln dynamisch geladen. Ein Spiel mit
Fehler beim Laden fehlt dann im Menü, die anderen laufen weiter (Fehler in der Konsole).

4. In der Oberwelt eine Station eintragen (siehe unten). Ohne Eintrag fehlt das Spiel nur im
   Dorf; in `#/liste` und in der Bestenliste steht es trotzdem.

## Hub (Oberwelt / Liste)

`core/main.js` wählt den Hub nach der Route: `#/` → `core/oberwelt.js`, `#/liste` → `core/menu.js`.
Vertrag: `hubModule.mount(hub)` → `{ draw(ctx), onPointer(ev), unmount(), debug? }` mit
`hub = { el, games, from, fromGame, open(id), ctx, C, VW, VH, loop(fn) }`:
`el` leerer DOM-Container über dem Canvas, `games = [{id, name, station, best: {score, title}}]`
in Registry-Reihenfolge, `from` = zuletzt gespieltes Spiel, `fromGame` = true, wenn der vorige
Bildschirm ein Spiel war, `open(id)` startet ein Spiel, `loop(fn(dt))` startet eine
Animationsschleife (zeichnet nach jedem `fn`), gibt `stop()` zurück.

### Oberwelt „Stammtischdorf“

- Welt `WW × WH` = 600 × 1260 (eigene Koordinaten), Kamera-Ausschnitt 360 × 640, folgt dem Vogel
  weich und bleibt in den Weltgrenzen. Schräge Draufsicht: Boden von oben, Bauten von vorn;
  Bauten, Bäume, Zäune, Vogel werden nach ihrer Fußlinie (y) sortiert gezeichnet, nur Sichtbares.
- Steuerung: Tippen = Vogel hüpft hin (Raster-A* mit 15er-Zellen, danach Sichtlinien-Glättung).
  Halten und Ziehen: Ziel folgt dem Finger. Tipp auf Bau oder Schild = hinlaufen, dann
  Eingangskarte. Betritt der Vogel den Eingangsbereich (Radius 20 vor der Tür) und bleibt stehen,
  erscheint die Karte ebenfalls. „Spielen“ öffnet `#/spiel/<id>`; nie automatischer Start.
- Vereinsheim (fest, kein Spiel): Karte „Eintreten“ → Bestenliste aller Registry-Spiele.
- Dunkelmodus (`C.dark`): Boden in dunklen Farben, Abendschleier über den Bauten, danach
  Fensterlichter, Laternen und Schilder.
- Schilder: Zeile 2 („312 · Titel“) wird bei mehr als 124 Einheiten Breite auf zwei Zeilen verteilt;
  das Brett bleibt in den Weltgrenzen. Schilder dürfen weder einander noch einen Bau überdecken
  (auch nicht den eigenen); Prüfen mit den längsten Titeln.
- Hinweiskasten unten (Bedienung beim ersten Besuch, iPhone-Lautlos-Hinweis), verschwindet beim
  ersten Tipp. Bestenliste: × oben rechts (bleibt beim Scrollen stehen) und „Schließen“ unten;
  darunter die Mitwirkenden aus `musik/credits.json`.
- Test-Hook: `window.__stammtisch.hub` (`stations`, `bird`, `prompt`, `panel`, `door(id)`,
  `screenPoint(id)`, `toScreen(x, y)`), `window.__stammtisch.hubName` (`'oberwelt'|'liste'`).

### Station eintragen

In `core/oberwelt-welt.js` eine Zeile in `STATIONEN` ergänzen:

```js
'mein-spiel': { x: 120, y: 560, bau: 'huette' },
```

`x/y` = Mitte der Unterkante des Baus (Bodenlinie). `bau` = Bauart aus `BAUTEN`
(`dornbusch`, `windwiese`, `wirtshaus`, `schiessbude`, `kartenbaustelle`, `vereinsheim`,
`huette` als schlichter Ersatz). Eine eigene Bauart ist ein Eintrag in `BAUTEN` mit
`hw` (halbe Breite), `d` (Tiefe der Kollisionsfläche), `top` (Höhe), `door` (Eingang unter der
Bodenlinie), `sign` (Schild-Fußpunkt relativ), `fenster` (für das Abendlicht) und `draw(ctx, t)`.
Freie Flächen gibt es noch am Rand (links unten, rechts in der Mitte); Bäume aus `BAEUME`
notfalls verschieben. Kollisionsflächen dürfen sich nicht mit Nachbarn überlappen. Der Weg dorthin ist optional (Wegfindung braucht ihn
nicht), sieht aber besser aus: Polylinie in `WEGE`. Danach `python3 tests/oberwelt.py` und die
Bilder ansehen (Schilder dürfen sich nicht überdecken).

## Tests

```
python3 tests/smoke.py              # Hub + #/liste + alle Spiele der Registry + _vorlage
python3 tests/oberwelt.py           # Ablauf Oberwelt (gehen, Station, Spiel, zurück, Bestenliste, dunkel)
python3 tests/smoke.py flatterflug  # nur ein Spiel (auch wenn noch nicht in der Registry)
python3 tests/smoke.py menu         # nur Hub und #/liste
Optionen: --sichtbar  --geraet "iPhone 13"
```

Das Skript startet selbst einen HTTP-Server auf freiem Port, emuliert ein Pixel 7 (Touch,
Mobil) und prüft pro Spiel: Startbildschirm erscheint, Start, Gesten für einige Sekunden,
Pause/Weiter, Ende (natürlich oder über `forceEnd`), mind. 20 Frames, Zurück ins Menü,
**keine Konsolenfehler und keine Seitenfehler** (Google-Fonts-Fehler werden ignoriert).
Bildschirmfotos: `tests/out/<id>-1-start.png`, `-2-spiel.png`, `-3-pause.png`, `-4-ende.png`
(Ordner ist in `.gitignore`). Bilder ansehen, nicht nur auf „bestanden“ schauen.

Gesten steuert das optionale Feld `test` im Spiel-Export:

```js
test: { sekunden: 6, gesten: ['tap', 'drag', 'hold'], zone: [x0, y0, x1, y1] }
```

`gesten` zufällig gemischt (Standard `['tap','drag']`), `zone` in Weltkoordinaten
(Standard `[20, 70, 340, 560]`). Ohne `forceEnd` beendet die Engine im Test mit 0 Punkten.
Test-Hook im Browser: `window.__stammtisch` (`view`, `gameId`, `state`, `frames`, `forceEnd()`).
Er gehört der Engine; Spiele benutzen ihn nicht.

## Regeln für parallel arbeitende Agenten

1. **`core/`, `index.html` und `tests/` nicht ändern.** Braucht ein Spiel eine Kern-Änderung
   (neue Hilfsfunktion, neues API-Feld, Fehler im Kern), den Wunsch mit Begründung in `KERN-WUENSCHE.md`
   eintragen, **nur im vorbereiteten Abschnitt `## <id>`** (sonst Merge-Konflikte)
   und im eigenen Spiel eine lokale Lösung bauen (z. B. Funktion kopieren und anpassen).
2. In `games/registry.js` nur die eigene Zeile einkommentieren.
3. Alle eigenen Dateien: `games/<id>.js`, optional `games/<id>/…`. Nichts anderes anlegen.
4. Keine Globals, kein DOM, keine externen Ressourcen (CDN, Bilder, Tondateien; Geräusche nur über `api.sfx`). Bibliotheken nur
   vendort im eigenen Ordner (siehe DESIGN.md, Kartenhaus).
5. Vor dem Commit: `python3 tests/smoke.py <id>` bestanden und die Bilder angesehen
   (hell; Dunkelmodus mit Farben aus `C` prüfen).
