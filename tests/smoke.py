#!/usr/bin/env python3
"""Rauchtest für die Stammtisch-Spiele (Playwright, Chromium, emuliertes Handy).

Aufruf:
  python3 tests/smoke.py              # Menü + alle Spiele aus games/registry.js + _vorlage
  python3 tests/smoke.py <id> [<id>]  # nur diese Spiele (z. B. flatterflug), Menü wird übersprungen
  python3 tests/smoke.py menu         # nur Hub (Oberwelt) und Listen-Menü #/liste
Optionen: --sichtbar (Browser mit Fenster), --geraet "iPhone 13"

Pro Spiel: Seite #/spiel/<id> öffnen, Start tippen, einige Sekunden Gesten (laut
game.test, sonst Tippen + Ziehen), Pause/Weiter, Testende erzwingen, Zurück ins Menü.
Bildschirmfotos landen in tests/out/. Fehler in Konsole oder Seite = durchgefallen.
"""
import os, random, socket, subprocess, sys, time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out')
IGNORE = ('fonts.googleapis.com', 'fonts.gstatic.com')  # Schriften fehlen evtl. offline – kein Spielfehler


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


class Run:
    def __init__(self, page, cdp, name):
        self.page, self.cdp, self.name = page, cdp, name
        self.errors, self.notes = [], []
        page.on('console', self._console)
        page.on('pageerror', lambda e: self.errors.append(f'pageerror: {e}'))
        page.on('requestfailed', self._reqfail)

    def _console(self, m):
        if m.type != 'error':
            return
        url = (m.location or {}).get('url', '')
        if any(h in url or h in m.text for h in IGNORE):
            self.notes.append('Schrift nicht geladen (ignoriert)')
        else:
            self.errors.append(f'console: {m.text} @ {url}')

    def _reqfail(self, r):
        if any(h in r.url for h in IGNORE):
            self.notes.append('Schrift nicht geladen (ignoriert)')
        else:
            self.errors.append(f'request failed: {r.url}')

    def js(self, expr):
        return self.page.evaluate(expr)

    def shot(self, tag):
        path = os.path.join(OUT, f'{self.name}-{tag}.png')
        self.page.screenshot(path=path)
        return path

    def wait_state(self, state, timeout=5000):
        self.page.wait_for_function(f"window.__stammtisch && window.__stammtisch.state === {state!r}", timeout=timeout)

    # Weltkoordinaten (360×640) -> Bildschirmpunkte
    def to_client(self, x, y):
        r = self.js("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
        return r[0] + x * r[2] / 360, r[1] + y * r[3] / 640

    def touch(self, typ, x=None, y=None):
        pts = [] if typ == 'touchEnd' else [dict(zip(('x', 'y'), self.to_client(x, y)), id=1)]
        self.cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': pts})

    def tap(self, x, y):
        self.touch('touchStart', x, y); self.page.wait_for_timeout(40); self.touch('touchEnd')

    def drag(self, x0, y0, x1, y1, ms=400, steps=12):
        self.touch('touchStart', x0, y0)
        for i in range(1, steps + 1):
            f = i / steps
            self.page.wait_for_timeout(ms / steps)
            self.touch('touchMove', x0 + (x1 - x0) * f, y0 + (y1 - y0) * f)
        self.touch('touchEnd')

    def hold(self, x, y, ms=600):
        self.touch('touchStart', x, y); self.page.wait_for_timeout(ms); self.touch('touchEnd')


def gestures(run, test):
    secs = float(test.get('sekunden', 5))
    kinds = test.get('gesten') or ['tap', 'drag']
    x0, y0, x1, y1 = test.get('zone') or [20, 70, 340, 560]
    rnd = lambda: (random.uniform(x0, x1), random.uniform(y0, y1))
    end = time.time() + secs
    n = 0
    while time.time() < end and run.js('window.__stammtisch.state') == 'play':
        k = random.choice(kinds)
        if k == 'tap':
            run.tap(*rnd()); run.page.wait_for_timeout(random.randint(60, 250))
        elif k == 'drag':
            a, b = rnd(), rnd(); run.drag(a[0], a[1], b[0], b[1], ms=random.randint(200, 700))
        elif k == 'hold':
            run.hold(*rnd(), ms=random.randint(200, 900))
        n += 1
    return n


def test_menu(run, base):
    """Hub (#/, Oberwelt) und Listen-Menü (#/liste): alle Spiele der Registry erreichbar."""
    run.page.goto(base + '#/')
    run.page.wait_for_function("window.__stammtisch && window.__stammtisch.view === 'hub'")
    run.page.evaluate("window.__stammtisch.ready")
    reg = run.js('window.__stammtisch.registry')
    run.page.wait_for_timeout(600)
    # Oberwelt: Stationen aus dem Test-Hook; ein Spiel ohne Station ist erlaubt (nur Hinweis)
    shown = run.js("(window.__stammtisch.hub && window.__stammtisch.hub.stations) || [...document.querySelectorAll('.menu-item')].map(a => a.dataset.id)")
    nost = [i for i in reg if i not in shown]
    if nost:
        run.notes.append(f'ohne Station im Hub: {nost}')
    run.shot('1-menue')
    # Listen-Menü: muss alle Spiele zeigen
    run.page.goto(base + '#/liste')
    run.page.wait_for_function("document.querySelectorAll('.menu-item').length > 0 || window.__stammtisch.hubName === 'liste'")
    run.page.wait_for_timeout(300)
    items = run.js("[...document.querySelectorAll('.menu-item')].map(a => a.dataset.id)")
    missing = [i for i in reg if i not in items]
    if missing:
        run.errors.append(f'in #/liste fehlen: {missing}')
    run.shot('1-liste')
    return reg


def test_game(run, base, gid):
    p = run.page
    p.goto(base + '#/')
    p.wait_for_function("window.__stammtisch && window.__stammtisch.view === 'hub'")
    p.goto(base + f'#/spiel/{gid}')
    try:
        run.wait_state('intro')
    except Exception:
        run.errors.append('Startbildschirm erscheint nicht (Spiel nicht ladbar?)'); run.shot('0-fehler'); return
    p.wait_for_timeout(400)
    run.shot('1-start')
    p.tap('#start')
    run.wait_state('play')
    test = run.js('window.__stammtisch.test') or {}
    secs = float(test.get('sekunden', 5))
    half = dict(test, sekunden=secs / 2)
    n = gestures(run, half)
    run.shot('2-spiel')
    n += gestures(run, half)
    st = run.js('window.__stammtisch.state')
    if st == 'play':
        p.tap('#pauseB'); run.wait_state('pause'); run.shot('3-pause')
        p.wait_for_timeout(600); p.tap('#start'); run.wait_state('play')
        p.wait_for_timeout(300)
        run.js('window.__stammtisch.forceEnd()')
    try:
        run.wait_state('over', 3000)
    except Exception:
        run.errors.append(f'Endbildschirm erscheint nicht (state={run.js("window.__stammtisch.state")})')
    p.wait_for_timeout(300)
    run.shot('4-ende')
    frames = run.js('window.__stammtisch.frames')
    if frames < 20:
        run.errors.append(f'Spielschleife lief kaum ({frames} Frames)')
    run.notes.append(f'{n} Gesten, {frames} Frames')
    p.wait_for_timeout(600)
    p.tap('#back')
    try:
        p.wait_for_function("window.__stammtisch.view === 'hub'", timeout=3000)
    except Exception:
        run.errors.append('Zurück-Knopf führt nicht ins Menü')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    headless = '--sichtbar' not in sys.argv
    device = 'Pixel 7'
    if '--geraet' in sys.argv:
        device = sys.argv[sys.argv.index('--geraet') + 1]; args.remove(device)
    os.makedirs(OUT, exist_ok=True)
    port = free_port()
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=ROOT,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{port}/index.html'
    results = []
    try:
        for _ in range(50):
            try:
                socket.create_connection(('127.0.0.1', port), timeout=0.2).close(); break
            except OSError:
                time.sleep(0.1)
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=headless)
            dev = dict(pw.devices[device]); dev.pop('default_browser_type', None); dev.update(has_touch=True, is_mobile=True)

            def new_run(name):
                ctx = browser.new_context(**dev)
                page = ctx.new_page()
                return ctx, Run(page, ctx.new_cdp_session(page), name)

            targets = args or ['menu']
            if not args:
                ctx, run = new_run('menu')
                try:
                    reg = test_menu(run, base)
                except Exception as e:
                    run.errors.append(f'Ausnahme: {e}'); reg = []
                results.append(run); ctx.close()
                targets = list(reg) + ['_vorlage']
            for gid in targets:
                if gid == 'menu' and args:
                    ctx, run = new_run('menu')
                    try:
                        test_menu(run, base)
                    except Exception as e:
                        run.errors.append(f'Ausnahme: {e}')
                    results.append(run); ctx.close(); continue
                if gid == 'menu':
                    continue
                ctx, run = new_run(gid)
                try:
                    test_game(run, base, gid)
                except Exception as e:
                    run.errors.append(f'Ausnahme: {str(e).splitlines()[0]}')
                    try: run.shot('x-ausnahme')
                    except Exception: pass
                results.append(run); ctx.close()
            browser.close()
    finally:
        srv.terminate()

    print(f'\nGerät: {device}   Bilder: {os.path.relpath(OUT, os.getcwd())}/')
    ok = True
    for r in results:
        good = not r.errors; ok &= good
        notes = ', '.join(sorted(set(r.notes)))
        print(f"{'OK  ' if good else 'FAIL'} {r.name:<18} {notes}")
        for e in r.errors:
            print(f'       - {e}')
    print('\nERGEBNIS:', 'bestanden' if ok else 'DURCHGEFALLEN')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
