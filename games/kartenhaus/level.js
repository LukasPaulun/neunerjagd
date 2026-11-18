/* Kartenhaus – Level-Daten. Reine Daten und Geometrie, kein DOM, keine Physik.
   Bauteile (Weltkoordinaten, Mittelpunkt x/y, Winkel a in Radiant):
     {k:'karte', x, y, a}        Hauskarte von der Seite (48 × 5), a = π/2 steht, a = 0 liegt
     {k:'neun',  x, y, suit}     Neuner, Vorderseite zum Betrachter (30 × 42)
     {k:'dulle', x, y}           Herz-Zehn, ebenso
   Alle Teile liegen mit kleinem Abstand (0,1–0,2) übereinander und starten schlafend:
   so steht das Haus ruhig, bis der Vogel es trifft. */

export const T = 470;                      // Oberkante der Tischplatte (Weltkoordinaten)
export const KL = 48, KD = 5;              // Hauskarte: Länge, Dicke (Seitenansicht)
export const FW = 30, FH = 42;             // Neuner/Dulle: Vorderseite, Skalierung 0.75 der Standardkarte
const P2 = Math.PI / 2;

function bau() {
  const teile = [];
  const karte = (x, y, a) => teile.push({ k: 'karte', x, y, a });
  return {
    teile,
    /* Zelle: zwei stehende Karten (Abstand 40) und eine liegende darauf. yb = Unterkante. → neue Unterkante */
    zelle(cx, yb) { karte(cx - 20, yb - KL / 2 - .1, P2); karte(cx + 20, yb - KL / 2 - .1, P2); karte(cx, yb - KL - .2 - KD / 2, 0); return yb - KL - KD - .3; },
    /* Zelt: zwei gegeneinander gelehnte Karten. → Höhe der Spitze */
    zelt(cx, yb, th = .36) {
      const s = Math.sin(th), c = Math.cos(th), h = KD / 2 * s + KL / 2 * c, dx = KD / 2 * c + KL / 2 * s + .2;
      karte(cx - dx, yb - h - .1, P2 + th); karte(cx + dx, yb - h - .1, P2 - th);
      return yb - 2 * h - .1;
    },
    /* liegende Karte (Decke) mit Unterkante yb → neue Unterkante */
    decke(cx, yb) { karte(cx, yb - KD / 2 - .1, 0); return yb - KD - .2; },
    neun(cx, yb, suit) { teile.push({ k: 'neun', x: cx, y: yb - FH / 2 - .1, suit }); },
    dulle(cx, yb) { teile.push({ k: 'dulle', x: cx, y: yb - FH / 2 - .1 }); },
  };
}

export const LEVELS = [
  (() => { // 1: Zelt mit Neuner obendrauf
    const b = bau(); let y = b.zelt(285, T); y = b.decke(285, y); b.neun(285, y, '♣');
    return { name: 'Das Zelt', text: 'Ein Neuner hat gezeltet. Ohne Genehmigung.', tisch: [200, 350], teile: b.teile };
  })(),
  (() => { // 2: ein Stockwerk, zwei Neuner obendrauf in zwei Zellen
    const b = bau(); const y1 = b.zelle(245, T), y2 = b.zelle(295, T); b.neun(245, y1, '♠'); b.neun(295, y2, '♥');
    return { name: 'Erster Stock', text: 'Zwei Neuner auf dem Dach. Holen Sie sie runter.', tisch: [190, 350], teile: b.teile };
  })(),
  (() => { // 3: Dulle im Vorgarten, Haus dahinter
    const b = bau(); let y = b.zelt(205, T); y = b.decke(205, y); b.dulle(205, y);
    const ya = b.zelle(270, T); b.zelle(320, T); b.neun(295, ya, '♠');
    y = b.zelle(295, ya); b.neun(295, y, '♥');
    return { name: 'Dulle im Garten', text: 'Vorne steht die Dulle. Die bleibt bitte stehen.', tisch: [175, 350], teile: b.teile };
  })(),
  (() => { // 4: Turm, vier Stockwerke; die Dulle sitzt davor auf der Pforte (über sie hinweg werfen)
    const b = bau(); let y = T;
    y = b.zelle(300, y); b.neun(300, y, '♦'); y = b.zelle(300, y); y = b.zelle(300, y); b.neun(300, y, '♣'); y = b.zelle(300, y); b.neun(300, y, '♠');
    const yp = b.zelle(228, T); b.dulle(228, yp);
    return { name: 'Der Turm', text: 'Ein Neunerturm. Die Dulle hält davor Wache.', tisch: [196, 352], teile: b.teile };
  })(),
  (() => { // 5: zwei Stockwerke mit Neuner auf dem Dach, zweiter Neuner auf dem Vorzelt
    const b = bau(); let y = b.zelle(290, T); y = b.zelle(290, y); b.neun(290, y, '♣');
    let yv = b.zelt(212, T); yv = b.decke(212, yv); b.neun(212, yv, '♦');
    return { name: 'Zweistöckig', text: 'Die Neuner wohnen jetzt zweistöckig. Mit Vorzelt.', tisch: [180, 350], teile: b.teile };
  })(),
  (() => { // 6: Vereinsheim: breiter Unterbau, versetzte Stockwerke, Dulle im Vorzelt
    const b = bau();
    let y = b.zelt(178, T); y = b.decke(178, y); b.dulle(178, y);
    const y0 = b.zelle(232, T); b.zelle(282, T); b.zelle(332, T);
    const y1 = b.zelle(257, y0); b.neun(257, y0, '♠'); b.zelle(307, y0); b.neun(307, y0, '♥');
    const y2 = b.zelle(282, y1); b.neun(282, y1, '♣'); b.neun(282, y2, '♦');
    return { name: 'Gegenverein', text: 'Die Neuner gründen einen Gegenverein. Das geht nicht.', tisch: [150, 358], teile: b.teile };
  })(),
];
