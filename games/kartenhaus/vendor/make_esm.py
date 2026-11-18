#!/usr/bin/env python3
"""Erzeugt matter.esm.js aus der UMD-Datei matter.min.js (einmalig, Ergebnis ist eingecheckt).

Warum: matter.js wird nur als UMD ausgeliefert. Per `import` geladen läuft UMD-Code als
ES-Modul (strict, `this` undefiniert, kein `module`/`exports`) und liefert nichts. Die Hülle
stellt ein lokales `module`/`exports` bereit, der UMD-Kopf wählt dann den CommonJS-Zweig,
und das Ergebnis wird als `export default` weitergereicht. Keine Globals, kein DOM.
Aufruf (im Ordner dieser Datei): python3 make_esm.py
"""
import os
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'matter.min.js'), encoding='utf-8').read()
head = ('/* AUTOMATISCH ERZEUGT von make_esm.py aus matter.min.js (matter-js 0.20.0, MIT, siehe LICENSE-matter-js.txt).\n'
        '   UMD in ESM-Hülle: lokales module/exports, Export als default. Nicht von Hand ändern. */\n'
        'const module = { exports: {} }; const exports = module.exports;\n')
open(os.path.join(here, 'matter.esm.js'), 'w', encoding='utf-8').write(head + src + '\nexport default module.exports;\n')
