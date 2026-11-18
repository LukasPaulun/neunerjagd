/* Ton: Musik und Geräusche, alles mit der Web Audio API erzeugt (keine Dateien, keine Bibliothek).
   Stil: kleine Wirtshaus-Blasmusik. Akkordeon (zwei verstimmte Sägezähne, Tiefpass, Tremolo),
   Tuba-Bass (Dreieck + etwas Sägezahn, weicher Einsatz), Nachschlag-Akkorde, leises Schlagwerk.
   Alle Melodien sind eigene Kompositionen (Notendaten unten).

   - AudioContext entsteht erst bei der ersten Nutzergeste (Autoplay-Regeln, iOS: resume im touchend).
   - Takt-Planer mit Vorlauf: setInterval (25 ms) plant Noten auf ctx.currentTime (stabiles Timing).
   - Stimmenzähler: jede Note/jedes Geräusch ist eine Stimme; Ende -> Knoten werden getrennt.
   - Tonmodus 'an' | 'effekte' | 'aus' in localStorage (stammtisch-ton).
   Schnittstelle: siehe ARCHITEKTUR.md, Abschnitt „Ton“. */

const KEY = 'stammtisch-ton';
const MODES = ['an', 'effekte', 'aus'];
const LOOKAHEAD = 0.12, TICK_MS = 25;
const MAX_VOICES = 48;                     // gleichzeitige Stimmen (Musik lässt 10 frei für Effekte)
const VOL = { master: 0.7, music: 0.32, sfx: 0.85 };

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

/* ---------------- Noten ---------------- */
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(s) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(s);
  if (!m) throw new Error('Note? ' + s);
  return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const wrap = (m, lo) => { while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; };

/* Akkord 'F', 'Gm', 'C7' -> { bass: [Grundton, Quinte] (tiefe Lage), chord: [3 Töne] (Mittellage) } */
function chordOf(name) {
  const m = /^([A-G][#b]?)(m|7)?$/.exec(name);
  const root = midi(m[1] + '4') % 12;
  const iv = m[2] === 'm' ? [0, 3, 7] : m[2] === '7' ? [4, 7, 10] : [0, 4, 7];
  const b = wrap(root + 36, 32);           // Ab1 .. G2
  return { bass: [b, b + 7 > 45 ? b - 5 : b + 7], chord: iv.map(i => wrap(root + i, 57)).sort((a, c) => a - c) };
}

/* Lied: bars = [[Akkord, 'Note:Schritte …'], …]; '-' = Pause. sub = Schritte pro Schlag. */
function compile(def) {
  const spb = def.beats * def.sub, total = def.bars.length * spb;
  const mel = new Array(total).fill(null), chords = [];
  def.bars.forEach(([ch, line], b) => {
    chords.push(chordOf(ch));
    let s = 0;
    for (const tok of line.trim().split(/\s+/)) {
      const [n, l] = tok.split(':'), len = +(l || 1);
      if (n !== '-') mel[b * spb + s] = [midi(n), len];
      s += len;
    }
    if (s !== spb) throw new Error(`${def.name}: Takt ${b + 1} hat ${s} statt ${spb} Schritte`);
  });
  return { ...def, spb, total, mel, chords };
}

/* „Abendschoppen“ – ruhiger Walzer, F-Dur, 3/4, 32 Takte (A A' B A''), Achtel-Raster */
const A1 = [
  ['F', 'C5:4 A4:2'], ['Dm', 'D5:2 C5:2 A4:2'], ['Gm', 'Bb4:4 G4:2'], ['C7', 'E4:2 G4:2 Bb4:2'],
];
const DORF = compile({
  name: 'dorf', beats: 3, sub: 2, bpm: 104, speedup: 0, style: 'walzer', lead: 1500,
  bars: [
    ...A1, ['F', 'A4:4 F4:2'], ['Bb', 'D5:2 F5:2 D5:2'], ['C7', 'C5:2 Bb4:2 G4:2'], ['F', 'F4:6'],
    ['F', 'C5:4 A4:2'], ['Dm', 'D5:2 E5:1 F5:1 D5:2'], ['Gm', 'Bb4:4 D5:2'], ['C7', 'C5:2 Bb4:2 G4:2'],
    ['F', 'A4:2 C5:2 F5:2'], ['Bb', 'F5:3 E5:1 D5:2'], ['C7', 'G4:2 A4:2 Bb4:2'], ['F', 'A4:4 -:2'],
    ['Bb', 'F5:4 D5:2'], ['Bb', 'Bb4:2 D5:2 F5:2'], ['F', 'E5:2 F5:2 C5:2'], ['F', 'A4:6'],
    ['G7', 'B4:4 D5:2'], ['G7', 'F5:2 E5:2 D5:2'], ['C7', 'C5:2 D5:2 E5:2'], ['C7', 'Bb4:2 G4:2 E4:2'],
    ...A1.slice(0, 3), ['C7', 'E4:2 G4:2 C5:2'],
    ['F', 'A4:2 F5:2 C5:2'], ['Bb', 'D5:3 C5:1 Bb4:2'], ['C7', 'A4:2 G4:2 E4:2'], ['F', 'F4:4 -:2'],
  ],
});

/* „Kropfpolka“ – Polka, B-Dur, 2/4, 24 Takte (A B A'), Sechzehntel-Raster. Tempo steigt mit intensity. */
const PA = [
  ['Bb', 'F4:2 Bb4:2 D5:2 Bb4:2'], ['F7', 'Eb5:2 C5:2 A4:2 F4:2'], ['F7', 'G4:1 A4:1 Bb4:1 C5:1 Eb5:2 C5:2'], ['Bb', 'D5:2 Bb4:2 F4:2 -:2'],
  ['Bb', 'F4:2 Bb4:2 D5:2 F5:2'], ['Eb', 'G5:2 Eb5:2 Bb4:2 G4:2'],
];
const POLKA = compile({
  name: 'polka', beats: 2, sub: 4, bpm: 116, speedup: 0.18, style: 'polka', lead: 2300,
  bars: [
    ...PA, ['F7', 'A4:1 Bb4:1 C5:1 D5:1 Eb5:2 A4:2'], ['Bb', 'Bb4:4 -:4'],
    ['Eb', 'G5:3 F5:1 Eb5:2 G5:2'], ['Bb', 'F5:3 D5:1 Bb4:2 D5:2'], ['F7', 'C5:2 Eb5:2 A4:2 C5:2'], ['Bb', 'Bb4:2 D5:2 F5:4'],
    ['Eb', 'Eb5:1 F5:1 G5:2 Bb4:2 G5:2'], ['Bb', 'F5:2 D5:2 Bb4:2 F4:2'], ['F7', 'A4:2 C5:2 Eb5:2 A4:2'], ['Bb', 'Bb4:2 F4:2 Bb4:4'],
    ...PA, ['F7', 'C5:2 D5:1 C5:1 A4:2 F4:2'], ['Bb', 'Bb4:2 D5:2 Bb4:2 -:2'],
  ],
});
const SONGS = { dorf: DORF, polka: POLKA };

/* ---------------- Klangerzeugung (für Live- und Offline-Kontext) ---------------- */
function buildGraph(ac) {
  const gain = v => { const n = ac.createGain(); n.gain.value = v; return n; };
  const lp = (f, q = 0.7) => { const n = ac.createBiquadFilter(); n.type = 'lowpass'; n.frequency.value = f; n.Q.value = q; return n; };
  const comp = ac.createDynamicsCompressor();             // Sicherheitsnetz gegen Übersteuern
  comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
  const master = gain(VOL.master), music = gain(VOL.music), sfx = gain(VOL.sfx), seqOut = gain(1);
  master.connect(comp); comp.connect(ac.destination);
  music.connect(master); sfx.connect(master); seqOut.connect(music);
  const acc = gain(1), accF = lp(1800), trem = gain(1);
  acc.connect(accF); accF.connect(trem); trem.connect(seqOut);
  const lfo = ac.createOscillator(), lfoG = gain(0.13);   // Akkordeon-Tremolo (ein Oszillator für alle Noten)
  lfo.frequency.value = 5.3; lfo.connect(lfoG); lfoG.connect(trem.gain); lfo.start();
  const chord = gain(1), chordF = lp(1300); chord.connect(chordF); chordF.connect(seqOut);
  const bass = gain(1), bassF = lp(620); bass.connect(bassF); bassF.connect(seqOut);
  const perc = gain(1); perc.connect(seqOut);
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return { ac, master, music, sfx, seqOut, acc, accF, chord, bass, perc, noise, voices: 0 };
}

/* Eine Stimme = Quellen + Kette. Start/Stopp geplant; nach dem Ende alles trennen. */
function voice(G, srcs, chain, t0, t1, set) {
  G.voices++;
  let left = srcs.length;
  const v = { stop(t) { for (const s of srcs) { try { s.stop(Math.max(t, t0)); } catch (e) {} } } };
  if (set) set.add(v);
  const done = () => {
    if (--left > 0) return;
    G.voices--; if (set) set.delete(v);
    for (const s of srcs) s.disconnect();
    for (const n of chain) n.disconnect();
  };
  for (const s of srcs) { s.onended = done; s.start(t0); s.stop(t1); }
  return v;
}
function osc(G, type, f) { const o = G.ac.createOscillator(); o.type = type; o.frequency.value = f; return o; }
function amp(G, t, a, peak, hold, rel) {
  const g = G.ac.createGain(), p = g.gain;
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) p.setValueAtTime(peak, t + a + hold);
  p.linearRampToValueAtTime(0, t + a + hold + rel);
  return g;
}

/* Akkordeon: zwei verstimmte Sägezähne (Musette) */
function lead(G, t, m, dur, set) {
  const f = hz(m), o1 = osc(G, 'sawtooth', f * 1.0047), o2 = osc(G, 'sawtooth', f * 0.9962);
  const g = amp(G, t, 0.03, 0.15, Math.max(0, dur - 0.03), 0.08);
  o1.connect(g); o2.connect(g); g.connect(G.acc);
  voice(G, [o1, o2], [g], t, t + dur + 0.12, set);
}
/* Nachschlag: kurzer Rechteck-Akkord durch Tiefpass */
function nach(G, t, ms, dur, vel, set) {
  const g = G.ac.createGain(), p = g.gain, pk = 0.05 * vel;
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(pk, t + 0.008); p.setTargetAtTime(0, t + 0.02, dur / 3);
  const os = ms.map(m => { const o = osc(G, 'square', hz(m)); o.connect(g); return o; });
  g.connect(G.chord);
  voice(G, os, [g], t, t + dur + 0.1, set);
}
/* Tuba: Dreieck + etwas Sägezahn (Obertöne, damit Handy-Lautsprecher den Bass zeigen) */
function tuba(G, t, m, dur, set) {
  const f = hz(m), o1 = osc(G, 'triangle', f), o2 = osc(G, 'sawtooth', f), g2 = G.ac.createGain();
  g2.gain.value = 0.35;
  const g = amp(G, t, 0.04, 0.42, Math.max(0, dur - 0.1), 0.09);
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(G.bass);
  voice(G, [o1, o2], [g, g2], t, t + dur + 0.05, set);
}
function noiseSrc(G) {
  const s = G.ac.createBufferSource(); s.buffer = G.noise;
  s.loopStart = 0; s.loop = true; s.playbackRate.value = 0.9 + Math.random() * 0.2;
  return s;
}
function snare(G, t, vel, set, out) {
  const s = noiseSrc(G), f = G.ac.createBiquadFilter(), g = G.ac.createGain();
  f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.13 * vel, t + 0.004); g.gain.setTargetAtTime(0, t + 0.01, 0.03);
  s.connect(f); f.connect(g); g.connect(out || G.perc);
  voice(G, [s], [f, g], t, t + 0.16, set);
}
function kick(G, t, vel, set, out) {
  const o = osc(G, 'sine', 120), g = G.ac.createGain();
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.09);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32 * vel, t + 0.005); g.gain.setTargetAtTime(0, t + 0.02, 0.04);
  o.connect(g); g.connect(out || G.perc);
  voice(G, [o], [g], t, t + 0.2, set);
}

/* Ein Schritt des Lieds: Melodie + Begleitmuster (Walzer: um-pa-pa, Polka: um-pa um-pa) */
function playStep(G, S, tr, i, t, dur, set) {
  const m = S.mel[i];
  if (m) lead(G, t, m[0] + tr, m[1] * dur * 0.9, set);
  const k = i % S.spb, bar = (i / S.spb) | 0, ch = S.chords[bar];
  const bass = b => tuba(G, t, ch.bass[b] + tr, dur * (S.style === 'walzer' ? 1.7 : 1.6), set);
  const pa = vel => nach(G, t, ch.chord.map(n => n + tr), dur * 0.9, vel, set);
  if (S.style === 'walzer') {
    if (k === 0) { bass(bar % 2); kick(G, t, 0.35, set); }
    else if (k === 2 || k === 4) { pa(k === 2 ? 0.9 : 0.75); snare(G, t, 0.25, set); }
  } else {
    if (k === 0 || k === 4) { bass(k === 0 ? 0 : 1); kick(G, t, 0.55, set); }
    else if (k === 2 || k === 6) { pa(1); snare(G, t, 0.55, set); }
  }
}
const stepDur = (S, x) => 60 / (S.bpm * (1 + S.speedup * x)) / S.sub;

/* ---------------- Geräusche ---------------- */
/* Ton mit Tonhöhenverlauf f0 -> f1 über dur, Hüllkurve schneller Einsatz und Abklingen */
function tone(G, type, f0, f1, t, dur, peak, lpf, att = 0.004) {
  const o = osc(G, type, f0), g = G.ac.createGain(), chain = [g];
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.linearRampToValueAtTime(0, t + dur);
  let n = o;
  if (lpf) { const f = G.ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lpf; n.connect(f); n = f; chain.push(f); }
  n.connect(g); g.connect(G.sfx);
  voice(G, [o], chain, t, t + dur + 0.02);
}
/* Gefiltertes Rauschen, Filterfrequenz f0 -> f1 */
function hiss(G, t, dur, peak, type, f0, f1, q = 1, att = 0.003) {
  const s = noiseSrc(G), f = G.ac.createBiquadFilter(), g = G.ac.createGain();
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.linearRampToValueAtTime(0, t + dur);
  s.connect(f); f.connect(g); g.connect(G.sfx);
  voice(G, [s], [f, g], t, t + dur + 0.02);
}
/* Blech: zwei Sägezähne, Filter öffnet beim Einsatz; optional Glissando und Vibrato */
function brass(G, t, m, dur, peak, o = {}) {
  const f = hz(m), a = osc(G, 'sawtooth', f), b = osc(G, 'sawtooth', f * 1.004);
  const flt = G.ac.createBiquadFilter(), g = G.ac.createGain(), srcs = [a, b], chain = [flt, g];
  flt.type = 'lowpass'; flt.Q.value = 1.2;
  const top = o.bright || 2200;
  flt.frequency.setValueAtTime(350, t); flt.frequency.linearRampToValueAtTime(top, t + 0.05); flt.frequency.setTargetAtTime(top * 0.55, t + 0.06, dur / 3);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.035);
  g.gain.setValueAtTime(peak * 0.85, t + Math.max(0.04, dur - 0.08)); g.gain.linearRampToValueAtTime(0, t + dur);
  if (o.bend) for (const x of [a, b]) { x.frequency.setValueAtTime(x.frequency.value, t + o.bendAt); x.frequency.exponentialRampToValueAtTime(x.frequency.value * Math.pow(2, o.bend / 12), t + dur); }
  if (o.vib) {
    const l = osc(G, 'sine', o.vib), lg = G.ac.createGain(); lg.gain.value = f * 0.025;
    l.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency); srcs.push(l); chain.push(lg);
  }
  a.connect(flt); b.connect(flt); flt.connect(g); g.connect(G.sfx);
  voice(G, srcs, chain, t, t + dur + 0.02);
}
const rnd = (a, b) => a + Math.random() * (b - a);

/* name: { cd: Mindestabstand in s, play(G, t, opts) } – alle unter 0.4 s außer den Schlussfiguren */
const SFX = {
  /* Neuner aufgespießt: „Tock“ + kleiner aufsteigender Blip. opts.pitch hebt den Blip (Serien) */
  neuner: { cd: 0.05, play(G, t, o) {
    const p = o.pitch || 1;
    tone(G, 'sine', 1250, 480, t, 0.05, 0.55);
    hiss(G, t, 0.03, 0.25, 'bandpass', 3200, 2600, 1.5);
    tone(G, 'square', 620 * p, 1240 * p, t + 0.045, 0.12, 0.11, 3000);
  } },
  /* Falsche Karte: dumpfer Schlag */
  falsch: { cd: 0.08, play(G, t) {
    tone(G, 'sine', 170, 62, t, 0.2, 0.75);
    tone(G, 'triangle', 115, 80, t, 0.22, 0.3);
    hiss(G, t, 0.1, 0.3, 'lowpass', 600, 200);
  } },
  /* Dulle: empörtes tiefes Blech („Bwäääp“), leicht schief und abfallend */
  dulle: { cd: 0.15, play(G, t) {
    brass(G, t, 45, 0.36, 0.3, { bright: 1500, bend: -2, bendAt: 0.2 });
    brass(G, t, 46, 0.36, 0.22, { bright: 1300, bend: -2, bendAt: 0.2 });
    tone(G, 'sine', 140, 70, t, 0.12, 0.35);
  } },
  /* Flügelschlag: weiches Rauschen, Höhe variiert (häufiger Tipp soll nicht nerven) */
  flatter: { cd: 0.07, play(G, t) {
    const p = rnd(0.85, 1.18);
    hiss(G, t, 0.13, 0.5, 'bandpass', 450 * p, 1300 * p, 1.1, 0.03);
  } },
  /* Dornschuss: kurzes „fft“ */
  schuss: { cd: 0.03, play(G, t) {
    hiss(G, t, 0.07, 0.4, 'highpass', 4200, 1400, 0.8);
    tone(G, 'sine', 900, 320, t, 0.05, 0.12);
  } },
  /* Leeres Magazin: Klick-Klack */
  leer: { cd: 0.1, play(G, t) {
    tone(G, 'square', 2300, 2100, t, 0.014, 0.16, 5000, 0.001);
    tone(G, 'square', 1700, 1600, t + 0.05, 0.014, 0.12, 5000, 0.001);
  } },
  /* Mischen: Karten-Rascheln aus Rauschstößen */
  mischen: { cd: 0.3, play(G, t) {
    for (let i = 0; i < 8; i++) { const f = rnd(2400, 4400); hiss(G, t + i * 0.036 + rnd(0, 0.01), 0.026, rnd(0.3, 0.5), 'bandpass', f, f * 0.8, 2); }
  } },
  /* Schleuder spannen: leises Knarzen, höher mit opts.amount (0..1) */
  spannen: { cd: 0.09, play(G, t, o) {
    const a = Math.max(0, Math.min(1, o.amount || 0));
    tone(G, 'sawtooth', 80 + 110 * a, 95 + 130 * a, t, 0.08, 0.14, 900, 0.01);
  } },
  /* Schleuder loslassen: „Schwupp“ */
  schleudern: { cd: 0.2, play(G, t) {
    tone(G, 'sine', 240, 980, t, 0.13, 0.34);
    hiss(G, t, 0.11, 0.22, 'bandpass', 700, 2600, 1);
  } },
  /* Karten stoßen zusammen: leises Klacken, opts.v = Stärke */
  klack: { cd: 0.045, play(G, t, o) {
    const v = Math.max(0.3, Math.min(1, (o.v || 3) / 6)), f = rnd(1700, 3300);
    hiss(G, t, 0.022, 0.24 * v, 'bandpass', f, f, 4, 0.001);
    const k = rnd(650, 1050); tone(G, 'triangle', k, k * 0.8, t, 0.03, 0.09 * v);
  } },
  /* Vogel hüpft im Dorf: winziger, leiser Blip */
  hop: { cd: 0.12, play(G, t) { const f = rnd(760, 900); tone(G, 'sine', f, f * 1.25, t, 0.035, 0.06); } },
  /* Knopf getippt */
  tap: { cd: 0.04, play(G, t) { tone(G, 'triangle', 880, 660, t, 0.045, 0.2); } },
  /* Eingangskarte einer Station erscheint: zweitöniges „Ding-dong“ aufwärts */
  prompt: { cd: 0.3, play(G, t) {
    tone(G, 'triangle', 659, 659, t, 0.14, 0.18);
    tone(G, 'triangle', 988, 988, t + 0.08, 0.22, 0.17);
  } },
  /* Tusch bei neuer Bestleistung (ca. 1.3 s): Auftakt, gehaltener B-Dur-Akkord, Wirbel */
  tusch: { cd: 1, play(G, t) {
    brass(G, t, midi('F4'), 0.1, 0.2); brass(G, t + 0.1, midi('Bb4'), 0.1, 0.2); brass(G, t + 0.2, midi('D5'), 0.1, 0.2);
    for (const n of ['Bb3', 'F4', 'D5', 'F5']) brass(G, t + 0.3, midi(n), 0.95, 0.15, { bright: 2600 });
    kick(G, t + 0.3, 0.9, null, G.sfx); kick(G, t + 1.2, 0.6, null, G.sfx);
    for (let i = 0; i < 12; i++) snare(G, t + 0.3 + i * 0.07, 0.9 - i * 0.05, null, G.sfx);
  } },
  /* Ende ohne Bestleistung (ca. 1.4 s): eigene, absteigende Posaunenfigur mit Wackeln am Schluss */
  traurig: { cd: 1, play(G, t) {
    const o = { bright: 900 };
    brass(G, t, midi('G3'), 0.28, 0.25, o);
    brass(G, t + 0.32, midi('E3'), 0.28, 0.25, o);
    brass(G, t + 0.64, midi('Eb3'), 0.74, 0.27, { bright: 850, bend: -1, bendAt: 0.25, vib: 5.5 });
  } },
};

/* ---------------- Laufzeit ---------------- */
let mode = MODES.includes(lsGet(KEY)) ? lsGet(KEY) : 'an';
let ctx = null, G = null, timer = 0, intensity = 0;
let want = null;                 // gewünschte Musik {name, tr}, auch vor der ersten Geste
let seq = null;                  // laufende Musik {S, tr, step, next, paused, set}
const lastAt = Object.create(null);
const modeCbs = new Set();

function applyMode() {
  if (!G) return;
  const t = ctx.currentTime;
  G.music.gain.setTargetAtTime(mode === 'an' ? VOL.music : 0, t, 0.03);
  G.sfx.gain.setTargetAtTime(mode === 'aus' ? 0 : VOL.sfx, t, 0.03);
}

function startTimer() { if (!timer) timer = setInterval(tick, TICK_MS); }
function stopTimer() { if (timer) { clearInterval(timer); timer = 0; } }

function tick() {
  if (!seq || seq.kind !== 'synth' || seq.paused || !ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (seq.next < now) seq.next = now + 0.03;     // hinterher (Tab war im Hintergrund): neu ansetzen
  while (seq.next < now + LOOKAHEAD) {
    const d = stepDur(seq.S, intensity);
    if (mode === 'an' && G.voices < MAX_VOICES - 10) playStep(G, seq.S, seq.tr, seq.step, seq.next, d, seq.set);
    seq.next += d; seq.step = (seq.step + 1) % seq.S.total;
  }
}

/* Laufende Musiknoten schnell ausblenden und stoppen (kein Knacken, keine Reste) */
function silence(s) {
  if (!G || !s || s.kind !== 'synth') return;
  const now = ctx.currentTime, p = G.seqOut.gain;
  p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(0, now + 0.05);
  for (const v of s.set) v.stop(now + 0.06);
  p.setValueAtTime(0, now + 0.07); p.linearRampToValueAtTime(1, now + 0.09);
}

/* ---------------- Musik aus Dateien (optional) ----------------
   Liegt für den Ort eine Aufnahme in musik/, spielt sie statt des erzeugten Lieds:
   Dorf: musik/dorf.mp3. Spiel <id>: musik/<id>.mp3, sonst musik/spiel.mp3. Fehlt die Datei (404)
   oder lädt sie nicht, gilt das erzeugte Lied (Walzer bzw. Polka). Gestreamt über ein
   HTMLAudioElement (MediaElementSource) in den Musik-Regler, also stumm bei „Nur Effekte“/„Aus“.
   Geladen wird erst, wenn der Ort Musik braucht, und nur dessen Datei. Ergebnis pro URL gemerkt. */
const FILE_GAIN = 2.0;          // Pegel der Aufnahmen relativ zum Musik-Regler (VOL.music)
const FADE = 0.3;               // s Ein-/Ausblenden bei Ortswechsel, Start und Pause
const FILE_SPEEDUP = 0.05;      // Aufnahmen höchstens 5 % schneller (setIntensity)
const LOAD_TIMEOUT = 10000;     // ms; danach erzeugte Musik (die Datei wird beim nächsten Mal neu versucht)
const tracks = new Map();       // url -> { url, el, p: Promise<track|null>, node?, gain?, tok }

function fileCandidates(place) {
  if (place === 'dorf') return ['musik/dorf.mp3'];
  return (place && place !== 'spiel' ? [`musik/${place}.mp3`] : []).concat('musik/spiel.mp3');
}
function loadTrack(url) {
  const known = tracks.get(url); if (known) return known.p;
  const el = new Audio(), tr = { url, el, tok: 0 };
  el.crossOrigin = 'anonymous';   // Vorschau-Hoster leiten auf raw.githubusercontent.com um: ohne CORS liefert Web Audio nur Stille
  el.preload = 'auto'; el.loop = true;
  tr.p = new Promise(res => {
    let done = false, to = 0, keep = true;      // keep: 404/Dekodierfehler bleibt gemerkt, Zeitüberschreitung nicht
    const fin = ok => {
      if (done) return; done = true; clearTimeout(to);
      if (!ok) { if (!keep) tracks.delete(url); el.removeAttribute('src'); try { el.load(); } catch (e) {} }
      res(ok ? tr : null);
    };
    el.addEventListener('canplay', () => fin(true), { once: true });
    el.addEventListener('error', () => fin(false), { once: true });
    to = setTimeout(() => { keep = false; fin(false); }, LOAD_TIMEOUT);
    el.src = url;
  });
  tracks.set(url, tr);
  return tr.p;
}
async function findTrack(place) {
  for (const url of fileCandidates(place)) { const tr = await loadTrack(url); if (tr) return tr; }
  return null;
}
const fileRate = () => 1 + FILE_SPEEDUP * intensity;
function fileFade(tr, to, dur) {
  const g = tr.gain.gain, now = ctx.currentTime;
  g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(to, now + dur);
}
function filePlay(tr) {
  const p = tr.el.play(); if (p && p.catch) p.catch(() => {});
  fileFade(tr, FILE_GAIN, FADE); tr.tok++;
}
function fileStop(tr, dur = FADE) {           // ausblenden, danach anhalten (falls nicht wieder gestartet)
  if (!tr.gain) return;
  fileFade(tr, 0, dur);
  const tok = ++tr.tok;
  setTimeout(() => { if (tr.tok === tok) tr.el.pause(); }, dur * 1000 + 30);
}
function startFile(tr, w) {
  if (!tr.node) { tr.node = ctx.createMediaElementSource(tr.el); tr.gain = ctx.createGain(); tr.gain.gain.value = 0; tr.node.connect(tr.gain); tr.gain.connect(G.music); }
  seq = { kind: 'file', tr, want: w, paused: !!w.paused };
  try { tr.el.currentTime = 0; } catch (e) {}
  tr.el.playbackRate = fileRate();
  if (!seq.paused && !document.hidden) filePlay(tr);
}
function startSynth(w) {
  seq = { kind: 'synth', want: w, S: SONGS[w.name], tr: w.tr, step: 0, next: ctx.currentTime + 0.1, paused: !!w.paused, set: new Set() };
  if (!seq.paused) startTimer();
}
/* Laufende Musik beenden (Synth: kurz ausblenden; Datei: FADE ausblenden) */
function stopCurrent() {
  if (!seq) return;
  if (seq.kind === 'synth') silence(seq);
  else if (seq.kind === 'file') fileStop(seq.tr);
  seq = null; stopTimer();
}

function startSeq() {
  if (!want || !G) return;
  const w = want;
  seq = { kind: 'wait', want: w, paused: !!w.paused };     // Platzhalter, bis klar ist: Datei oder Synth
  findTrack(w.place).then(tr => {
    if (!seq || seq.want !== w || want !== w) return;      // Ort inzwischen gewechselt
    const paused = seq.paused; w.paused = paused;
    if (tr) startFile(tr, w); else startSynth(w);
  });
}

/* Erste Nutzergeste: Kontext erzeugen bzw. fortsetzen. Danach wartende Musik starten. */
export function unlock() {
  if (!AC || document.hidden) return;
  if (!ctx) {
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return; } }
    G = buildGraph(ctx); applyMode();
    try { const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(ctx.destination); b.start(0); } catch (e) {}
    ctx.onstatechange = () => { if (ctx.state === 'running' && want && !seq) startSeq(); };
  }
  if (ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
  if (ctx.state === 'running' && want && !seq) startSeq();
}

if (typeof document !== 'undefined') {
  for (const ev of ['pointerup', 'touchend', 'mousedown', 'click', 'keydown']) document.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { if (ctx.state === 'running') ctx.suspend().catch(() => {}); if (seq && seq.kind === 'file') seq.tr.el.pause(); }
    else {
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      if (seq && seq.kind === 'file' && !seq.paused) filePlay(seq.tr);
    }
  });
}

/* Musik: name 'dorf' | 'polka' (erzeugtes Lied als Rückfall).
   opts: { tonart: Halbtöne, restart: true = von vorn, place: 'dorf' | Spiel-id (für musik/<place>.mp3) } */
export function playMusic(name, opts = {}) {
  if (!SONGS[name]) return;
  const tr = opts.tonart | 0, place = opts.place || (name === 'dorf' ? 'dorf' : 'spiel');
  if (!opts.restart && want && want.name === name && want.tr === tr && want.place === place) { if (seq && seq.paused) resumeMusic(); return; }
  stopCurrent();
  want = { name, tr, place };
  if (ctx && ctx.state === 'running') startSeq();
}
export function stopMusic() { stopCurrent(); want = null; }
export function pauseMusic() {
  if (want) want.paused = true;
  if (!seq || seq.paused) return;
  seq.paused = true;
  if (seq.kind === 'synth') { silence(seq); stopTimer(); }
  else if (seq.kind === 'file') fileStop(seq.tr, 0.15);
}
export function resumeMusic() {
  if (want) want.paused = false;
  if (!seq || !seq.paused) return;
  seq.paused = false;
  if (seq.kind === 'synth') { seq.next = ctx.currentTime + 0.1; startTimer(); }
  else if (seq.kind === 'file') filePlay(seq.tr);
}
/* 0..1: Polka wird bis zu 18 % schneller, Aufnahmen bis zu 5 % */
export function setIntensity(x) {
  intensity = x > 1 ? 1 : x > 0 ? x : 0;
  if (seq && seq.kind === 'file') { const r = fileRate(); if (Math.abs(seq.tr.el.playbackRate - r) > 0.002) seq.tr.el.playbackRate = r; }
}

/* Mitwirkende der Aufnahmen: musik/credits.json (Array von Zeilen), sonst []. Einmal geladen. */
let creditsP = null;
export function credits() {
  if (!creditsP) creditsP = (typeof fetch === 'function' ? fetch('musik/credits.json', { cache: 'no-cache' }) : Promise.reject())
    .then(r => (r.ok ? r.json() : []))
    .then(a => (Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.trim()).slice(0, 12) : []))
    .catch(() => []);
  return creditsP;
}

/* Geräusch abspielen. Leise ignoriert, wenn Ton aus, Kontext nicht bereit, Abklingzeit oder Stimmenlimit. */
export function sfx(name, opts) {
  if (mode === 'aus' || !ctx || ctx.state !== 'running') return;
  const d = SFX[name];
  if (!d) { console.warn('Ton: unbekanntes Geräusch', name); return; }
  const now = ctx.currentTime;
  if (now - (lastAt[name] ?? -9) < d.cd || G.voices >= MAX_VOICES) return;
  lastAt[name] = now;
  try { d.play(G, now + 0.005, opts || {}); } catch (e) { console.warn('Ton:', e); }
}

/* Tonmodus */
export const getMode = () => mode;
export function setMode(m) {
  if (!MODES.includes(m)) return;
  mode = m; lsSet(KEY, m); applyMode();
  if (m !== 'an' && seq) silence(seq);   // Synth-Noten sofort aus; Dateien laufen stumm weiter (Musik-Regler 0)
  for (const cb of modeCbs) cb(m);
}
export function cycleMode() { setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]); return mode; }
export function onModeChange(cb) { modeCbs.add(cb); return () => modeCbs.delete(cb); }

/* iOS stellt Web Audio bei aktivem Lautlos-Schalter stumm. */
export function isIOS() {
  try { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); } catch (e) { return false; }
}

/* Test-Hook (window.__stammtisch.audio) */
export const debug = {
  get state() { return ctx ? ctx.state : 'none'; },
  get voices() { return G ? G.voices : 0; },
  get music() {
    if (!seq) return want ? { name: want.name, place: want.place, wartet: true } : null;
    if (seq.kind === 'file') { const e = seq.tr.el; return { name: seq.want.name, place: seq.want.place, file: seq.tr.url, paused: seq.paused, time: e.currentTime, playing: !e.paused, rate: e.playbackRate, loop: e.loop, gain: seq.tr.gain.gain.value }; }
    if (seq.kind === 'wait') return { name: seq.want.name, place: seq.want.place, sucht: true, paused: seq.paused };
    return { name: seq.S.name, place: seq.want.place, step: seq.step, paused: seq.paused, tonart: seq.tr };
  },
  get intensity() { return intensity; },
  get mode() { return mode; },
  sounds: Object.keys(SFX),
  /* Offline-Rendering für Pegelprüfungen: name = Lied ('dorf'|'polka') oder Geräusch -> AudioBuffer */
  render(name, seconds = 4, o = {}) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = 44100;
    const ac = new OAC(1, Math.ceil(sr * seconds), sr), g = buildGraph(ac);
    if (SONGS[name]) {
      const S = SONGS[name], x = o.intensity || 0, set = new Set();
      for (let t = 0.05, i = 0; t < seconds; i = (i + 1) % S.total) { const d = stepDur(S, x); playStep(g, S, o.tonart | 0, i, t, d, set); t += d; }
    } else SFX[name].play(g, 0.05, o);
    return ac.startRendering();
  },
};
