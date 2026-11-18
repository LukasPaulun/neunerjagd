# Stammtisch-Spiele – Design-Vorgaben

Verbindliche Vorgaben für alle Minispiele. Technische Details stehen in `ARCHITEKTUR.md`.

## Kontext

Doppelkopf-Stammtisch „Der Stammtisch“ (n.e.v., nicht eingetragener Verein), halb-ironisches Vereinsleben.
Kernprinzip des Vereins: **Doppelkopf ohne Neuner** („Keine Nazis, keine Neuner“).
Maskottchen: der **Neuntöter** (Lanius collurio), ein Vogel, der Beute auf Dornen aufspießt.
Die Spiele werden von den Vereinsmitgliedern auf dem Handy gespielt, Link wird in der Gruppe geteilt.

## Grundsätze

1. **Mechanik statt Verkleidung.** Jede Spielidee hat eine Doppelkopf- oder Neuntöter-Logik:
   - Neuner (9♣ 9♠ 9♥ 9♦) sind die Beute: treffen, aufspießen, fangen.
   - Andere Karten (10, B, D, K, A) sind unschuldig: treffen kostet.
   - Die **Dulle** (Herz-Zehn, 10♥) ist heilig: treffen kostet doppelt.
   - Aufspießen auf Dornen ist das wiederkehrende Belohnungsbild.
2. **Eigene Namen, eigene Grafik.** Die Spielmechaniken orientieren sich an bekannten Spielen
   (Flappy Bird, Whack-a-Mole, Angry Birds, Moorhuhn), aber **keine** Namen, Figuren, Logos,
   Grafiken oder Sounds daraus. Alles wird im Code gezeichnet (Canvas), keine fremden Bilder.
3. **Kurze Runden.** Eine Runde dauert 30 s bis 3 min. Sofort neu startbar.
4. **Humor im Ton des Vereins:** trocken, leicht bürokratisch-ironisch (Vereinsämter, Satzung,
   Geheimdienst, Vollversammlung). Texte auf Deutsch, Spieler wird **gesiezt** („Tippen Sie …“).
5. **Titel statt nur Punkte.** Jedes Spiel vergibt am Ende einen Rang-Titel (wie die Neunerjagd:
   Gelbschnabel → Dorndreher → Neunwürger → Neunmörder → Großer Raubwürger). Eigene, passende
   Titelreihe je Spiel.

## Zielplattform

- **Nur Handy, Hochformat, nur Touch.** Keine Desktop-Layouts, keine Tastatursteuerung nötig.
  Maus-Klick darf als Fallback funktionieren (für Tests), mehr nicht.
- Spielfeld in festen Weltkoordinaten **360 × 640** (9:16), skaliert auf die Bildschirmbreite.
- Touch-Ziele mindestens 44 × 44 px (Weltkoordinaten). Finger soll wichtige Objekte nicht verdecken.
- Kein Scrollen, kein Zoomen, kein Text-Markieren während des Spiels.
- Pause bei `visibilitychange` (App-Wechsel).
- Vibration (`navigator.vibrate`) sparsam als Feedback, immer in `try`.

## Visuelle Sprache (aus der bestehenden Neunerjagd übernehmen)

- Farben als CSS-Variablen, Hell- und Dunkelmodus:
  `--paper --surface --ink --muted --line --chestnut --thorn --gold --ok --bad --veil`.
- Schriften: **Grenze Gotisch** (Titel), **Alegreya Sans** (Text), **IBM Plex Mono** (HUD, Zahlen).
- Karten: weißes abgerundetes Rechteck, dunkler Rand, Rang + Farbsymbol mittig (Georgia),
  Rot für ♥♦, Schwarz für ♣♠. Gleiche Funktion für alle Spiele.
- Neuntöter: der bestehende Sprite (rostbrauner Rücken, graue Kappe, schwarze Augenmaske,
  heller Bauch, Hakenschnabel). Alle Spiele verwenden denselben Sprite; Varianten (Seitenansicht,
  fliegend, von oben für die Oberwelt) im gleichen Stil.
- Dornbusch / Dornen in `--thorn` und Holzbraun `#5a3b26`.
- Flache, ruhige Hintergründe, wenige weiche Formen. Kein Pixel-Art-Mix mit Vektor-Stil.
- HUD oben (Höhe ca. 58), Werte in Mono, Beschriftung in Versalien klein.
- Overlay-Muster für Start / Pause / Ende wie in der Neunerjagd (Titel, Kurzregel, Regelzeile,
  großer runder Button, Bestleistung).

## Die Spiele

### 1. Neunerjagd (besteht)
Neuntöter folgt dem Finger (relativ, wie Trackpad). Fallende Neuner schlucken, nach 8 im Kropf
auswürgen und auf den Dornbusch spießen. Andere Karte −1 Leben, Dulle −2. 9 entkommene Neuner = Ende.
Gameplay **unverändert** übernehmen.

### 2. Flatterflug (Mechanik à la Flappy Bird)
- Tippen = Flügelschlag (Impuls nach oben), sonst Schwerkraft. Seitenansicht, Welt scrollt nach links.
- Hindernisse: **Kartensäulen** (gestapelte Karten oben und unten) mit Lücke.
- In vielen Lücken schwebt ein **Neuner**: durchfliegen = aufgespießt, +9. Säule passiert = +1.
- Ab und zu steht eine Dulle in der Lücke: berühren = Ende („Die Dulle berührt man nicht.“).
- Berühren einer Säule, des Bodens oder der Decke = Ende.
- Schwierigkeit steigt langsam (Lückengröße, Tempo).

### 3. Neuner hauen (Mechanik à la Whack-a-Mole)
- Draufsicht auf die **Stammtischplatte** (Holz). **9 Löcher** im 3×3-Raster.
- Karten tauchen aus Löchern auf und verschwinden nach kurzer Zeit wieder.
- Neuner antippen = Neuntöter stößt herab und spießt ihn auf, +9.
- Andere Karte antippen = −1 Leben, Dulle = −2. Neuner verschwindet ungetroffen = zählt als entkommen.
- Runde 60 s oder bis Leben (3) weg. Tempo steigt.
- Combo: 3 Neuner in Folge ohne Fehler = Bonus.

### 4. Neunerschießen (Mechanik à la Moorhuhn)
- Kulisse: Wiese/Hecke mit Tiefenebenen (fern, mittel, nah). Karten flattern quer über den
  Bildschirm, ferne Karten kleiner und mehr Punkte.
- Tippen = Schuss mit einem **Dorn** an diese Stelle. Treffer auf Neuner = aufgespießt.
- Magazin: 8 Dornen. **Nachladen = „Mischen“**: Nach-unten-Wischen oder Tipp auf das Dornen-Symbol.
- Andere Karte getroffen = Punktabzug, Dulle = großer Abzug.
- Runde 90 s. Gelegentlich ein seltenes Bonusziel (z. B. Kreuz-Dame = „Die Alte“) – nicht treffen
  oder treffen, Entscheidung beim Bau, aber mit Doppelkopf-Witz begründen.

### 5. Kartenhaus (Mechanik à la Angry Birds, vereinfacht)
- Seitenansicht. Links eine **Astgabel aus dem Dornbusch** als Schleuder.
- Ziehen und Loslassen schleudert den Neuntöter (Flugbahn-Vorschau für die ersten Punkte).
- Rechts **Kartenhäuser** aus Karten (stehend = Wände, liegend = Decken), darin Neuner.
- Ziel: alle Neuner aus dem Haus werfen (sie fallen unter eine Linie / vom Bildschirm / auf den Boden).
- Pro Level 3 Würfe. Etwa 6 Level, steigende Schwierigkeit. Fortschritt lokal speichern.
- Physik: einfache 2D-Starrkörper-Physik. Eine vendorte, kleine Bibliothek (z. B. matter.js,
  MIT-Lizenz, Datei ins Repo kopieren, nicht per CDN) ist erlaubt.
- Dulle als Karte im Haus: wenn sie runterfällt, Punktabzug.

### 6. Oberwelt (Hub)
- 2D-Draufsicht auf ein kleines **Stammtischdorf**. Der Neuntöter (Sprite von oben oder schräg)
  läuft/hüpft dorthin, wo man hintippt (einfache Wegfindung oder direkte Bewegung mit Kollision).
- Stationen (betreten = Spiel starten, mit kurzem Schild davor):
  - Dornbusch → Neunerjagd
  - Windwiese → Flatterflug
  - Wirtshaus „Zum Stammtisch“ → Neuner hauen
  - Schießbude → Neunerschießen
  - Kartenbaustelle → Kartenhaus
  - Vereinsheim → Bestenliste (lokale Bestleistungen aller Spiele, mit Titeln)
- Zurück aus jedem Spiel in die Oberwelt (Button), der Vogel steht dann vor der Station.
- Welt etwas größer als der Bildschirm, Kamera folgt dem Vogel.

## Bestleistungen

- Nur lokal (`localStorage`), pro Gerät. Der bestehende Schlüssel `neunerjagd-best` bleibt gültig.
- Eine gemeinsame Online-Bestenliste ist **nicht** Teil dieses Ausbaus.
