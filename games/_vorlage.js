/* VORLAGE – minimales Beispielspiel. Nicht im Menü; aufrufbar über #/spiel/_vorlage.
   Spielidee: Karten fallen herab. Tippen Sie Neuner an (+9). Andere Karte −1 Leben,
   Dulle −2. 30 Sekunden oder 3 Leben.
   Zum Kopieren: Datei nach games/<id>.js kopieren, id/name/… anpassen, in registry.js eintragen. */

// Reine Zeichen-/Hilfsfunktionen dürfen direkt aus core/ importiert werden (nur lesen, nicht ändern).
import { card, neuntoeter, dornAst, hintergrund, isDulle, RANKS, SUITS } from '../core/draw.js';
import { hud, createPopups } from '../core/hud.js';
import { rand, pick, clamp } from '../core/util.js';

export default {
  // --- Beschreibung (liest die Engine für Overlay, Menü und Bestleistung) ---
  id: '_vorlage',                       // = Dateiname, nur [_a-z0-9-]
  name: 'Vorlage',                      // Titel im Overlay, Kopfzeile und Menü
  station: 'Werkstatt',                 // Station in der späteren Oberwelt
  intro: 'Tippen Sie auf fallende Neuner. Alles andere lassen Sie bitte liegen.',
  rules: ['Neuner +9 · Andere Karte −1 Leben · Dulle −2', '30 Sekunden oder 3 Leben'],  // je Eintrag eine Zeile
  startLabel: 'Probieren',              // Start-Knopf (Standard "Start")
  againLabel: 'Nochmal',                // Knopf auf dem Endbildschirm
  pauseText: 'Die Vorlage ruht.',       // Text im Pause-Overlay
  titles: [[0, 'Anwärter'], [45, 'Mitglied'], [90, 'Kassenprüfer']], // [ab Punkten, Titel], aufsteigend
  test: { sekunden: 4, gesten: ['tap'] },  // optional, für tests/smoke.py

  // --- Logik: create(api) wird einmal pro Aufruf des Spiels gerufen. Gesamter Zustand lebt hier drin. ---
  create(api) {
    const { VW, VH, HUD, C } = api;
    const pops = createPopups();
    let cards, score, lives, t, spawnT, hurt;
    const DAUER = 30;
    const runden = api.load('runden', 0);   // eigener Speicher pro Spiel (localStorage, JSON)

    // reset(): vor jedem Start (und einmal für das Bild hinter dem Start-Overlay)
    function reset() { cards = []; pops.clear(); score = 0; lives = 3; t = 0; spawnT = 0.3; hurt = 0; }

    // step(dt): Spiellogik, dt in Sekunden (max. 0.05). Nur während des Spiels aufgerufen.
    function step(dt) {
      t += dt; if (hurt > 0) hurt -= dt; pops.step(dt);
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = 0.7;
        const nine = Math.random() < 0.5;
        cards.push({ x: rand(40, VW - 40), y: HUD - 20, vy: rand(90, 140), rot: rand(-.4, .4), rank: nine ? '9' : pick(RANKS), suit: pick(SUITS) });
      }
      for (const c of cards) c.y += c.vy * dt;
      cards = cards.filter(c => c.y < VH + 40);
      if (lives <= 0 || t >= DAUER) {
        api.save('runden', runden + 1);
        // end(): Engine zeigt Titel (aus titles), Text, speichert Bestleistung.
        api.end({ score, text: `${lives <= 0 ? 'Keine Leben mehr.' : 'Zeit um.'} ${score} Punkte.` });
      }
    }

    // draw(ctx): zeichnet alles in Weltkoordinaten 360×640. Auch außerhalb des Spiels gerufen.
    function draw(ctx) {
      hintergrund(ctx, t);
      dornAst(ctx);
      for (const c of cards) card(ctx, c.x, c.y, c.rot, c.rank, c.suit, 1);
      neuntoeter(ctx, VW / 2, 520, { wing: Math.sin(t * 14), hurt });
      pops.draw(ctx);
      hud(ctx, [
        { x: 12, label: 'PUNKTE', value: score, color: C.ch },
        { x: 150, label: 'ZEIT', value: Math.ceil(clamp(DAUER - t, 0, DAUER)) },
        { x: 288, label: 'LEBEN', value: lives, hearts: true },
      ]);
    }

    // onPointer(ev): ev = {type:'down'|'move'|'up'|'cancel', id, x, y, pointer, pressed}, Weltkoordinaten.
    function onPointer(ev) {
      if (ev.type !== 'down') return;
      // Trefferzone großzügig (mind. 44×44): Karte 40×56 plus Rand
      const c = cards.find(c => Math.abs(c.x - ev.x) < 30 && Math.abs(c.y - ev.y) < 36);
      if (!c) return;
      cards.splice(cards.indexOf(c), 1);
      if (c.rank === '9') { score += 9; pops.add(c.x, c.y - 20, '+9', C.ok); api.vibrate(20); api.sfx('neuner'); }
      else { const d = isDulle(c.rank, c.suit); lives -= d ? 2 : 1; hurt = .6; api.vibrate(d ? 200 : 80); api.sfx(d ? 'dulle' : 'falsch'); pops.add(c.x, c.y - 20, d ? 'Die Dulle! −2' : 'Foul', C.bad); }
    }

    // forceEnd(): optional, nur für Tests (beendet sofort mit aktuellem Stand)
    const forceEnd = () => api.end({ score, text: `Testabbruch. ${score} Punkte.` });

    // destroy(): optional, beim Verlassen des Spiels (Timer o. ä. aufräumen)
    return { reset, step, draw, onPointer, forceEnd };
  },
};
