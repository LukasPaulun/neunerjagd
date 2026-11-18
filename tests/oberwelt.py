#!/usr/bin/env python3
"""Ablauftest für die Oberwelt (Playwright, Pixel 7, Touch).

Aufruf:  python3 tests/oberwelt.py [--sichtbar]

Prüft: Tipp ins Gelände -> Vogel hüpft; Tipp auf eine Station -> Vogel läuft hin, Eingangskarte
erscheint; „Spielen“ -> Spiel-Route; Zurück -> Oberwelt, Vogel vor der Station; Vereinsheim ->
Bestenliste öffnen/schließen; Weg zu entfernten Stationen; #/liste; Dunkelmodus.
Bilder: tests/out/oberwelt-*.png. Fehler in Konsole oder Seite = durchgefallen.
"""
import math, os, socket, subprocess, sys, time

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from smoke import Run, free_port, ROOT, OUT  # noqa: E402

HUB = 'window.__stammtisch.hub'


def wait_hub(run):
    run.page.wait_for_function(f"window.__stammtisch && window.__stammtisch.view === 'hub' && {HUB}", timeout=8000)


def bird(run):
    return run.js(f'{HUB}.bird')


def wait_still(run, timeout=12000):
    run.page.wait_for_function(f'{HUB} && !{HUB}.bird.moving', timeout=timeout)


def tap_world(run, x, y):
    p = run.js(f'{HUB}.toScreen({x}, {y})')
    run.tap(min(330, max(30, p['x'])), min(470, max(80, p['y'])))  # sichtbar, nicht auf Liste-Link oder Karte


def go_station(run, sid, tries=6):
    """Tippt die Station an; ist sie nicht sichtbar, hüpft der Vogel erst in ihre Richtung."""
    for _ in range(tries):
        sp = run.js(f'{HUB}.screenPoint({sid!r})')
        if sp and sp['y'] < 470:   # unten liegt evtl. die Eingangskarte
            run.tap(sp['x'], sp['y'])
            run.page.wait_for_function(f'{HUB}.prompt === {sid!r}', timeout=12000)
            return True
        d, b = run.js(f'{HUB}.door({sid!r})'), bird(run)
        dx, dy = d['x'] - b['x'], d['y'] - b['y']
        k = min(1.0, 220 / max(1.0, math.hypot(dx, dy)))
        tap_world(run, b['x'] + dx * k, b['y'] + dy * k)
        run.page.wait_for_timeout(200); wait_still(run)
    run.errors.append(f'Station {sid} nicht erreicht'); return False


def flow(run, base):
    p = run.page
    p.goto(base + '#/'); wait_hub(run)
    p.evaluate("localStorage.clear()"); p.reload(); wait_hub(run)
    stations = run.js(f'{HUB}.stations')
    reg = run.js('window.__stammtisch.registry')
    missing = [g for g in reg if g not in stations]
    if missing:
        run.notes.append(f'ohne Station (nicht im Dorf): {missing}')
    p.wait_for_timeout(600); run.shot('1-start')

    # 1. Tipp ins Gelände
    b0 = bird(run)
    tap_world(run, b0['x'] - 70, b0['y'] - 30)
    p.wait_for_timeout(250)
    b1 = bird(run)
    if math.hypot(b1['x'] - b0['x'], b1['y'] - b0['y']) < 3:
        run.errors.append('Vogel bewegt sich nach Tipp nicht')
    wait_still(run); run.shot('2-gehuepft')

    # 2. Station antippen -> Eingangskarte
    sid = 'neunerjagd' if 'neunerjagd' in stations else stations[0]
    if go_station(run, sid):
        p.wait_for_timeout(350); run.shot('3-eingang')
        # 3. Spielen -> Spiel-Route
        p.tap('.ow-go')
        p.wait_for_function(f"window.__stammtisch.view === 'spiel' && window.__stammtisch.gameId === {sid!r}", timeout=8000)
        if not p.evaluate('location.hash').endswith('/spiel/' + sid):
            run.errors.append('Route nach „Spielen“ falsch: ' + p.evaluate('location.hash'))
        p.wait_for_timeout(400); run.shot('4-spiel')
        # 4. Zurück -> Vogel vor der Station
        p.tap('#back'); wait_hub(run); p.wait_for_timeout(500)
        b, d = bird(run), run.js(f'{HUB}.door({sid!r})')
        if abs(b['x'] - d['x']) > 4 or not (0 < b['y'] - d['y'] < 40):
            run.errors.append(f'Vogel nach Rückkehr nicht vor {sid}: {b} / Tür {d}')
        if run.js(f'{HUB}.prompt'):
            run.errors.append('Eingangskarte öffnet sich ungefragt nach Rückkehr')
        run.shot('5-zurueck')

    # 5. Vereinsheim -> Bestenliste
    if go_station(run, 'vereinsheim'):
        p.wait_for_timeout(300); p.tap('.ow-go')
        p.wait_for_function(f'{HUB}.panel === true', timeout=3000)
        rows = run.js("document.querySelectorAll('.ow-row').length")
        if rows != len(reg):
            run.errors.append(f'Bestenliste zeigt {rows} statt {len(reg)} Spiele')
        p.wait_for_timeout(300); run.shot('6-bestenliste')
        p.tap('.ow-close'); p.wait_for_function(f'{HUB}.panel === false', timeout=3000)

    # 6. Entfernte Stationen
    for i, far in enumerate(['neuner-hauen', 'flatterflug', 'kartenhaus', 'neunerschiessen']):
        if far in stations and go_station(run, far):
            p.wait_for_timeout(500); run.shot(f'7-{far}')

    # 7. Position bleibt nach Neuladen erhalten
    b = bird(run); p.reload(); wait_hub(run); b2 = bird(run)
    if math.hypot(b['x'] - b2['x'], b['y'] - b2['y']) > 3:
        run.errors.append(f'Vogelposition nicht gespeichert: {b} -> {b2}')

    # 8. Liste als Rückfall
    p.goto(base + '#/liste'); p.wait_for_function("window.__stammtisch.hubName === 'liste'", timeout=5000)
    items = run.js("[...document.querySelectorAll('.menu-item')].map(a => a.dataset.id)")
    if sorted(items) != sorted(reg):
        run.errors.append(f'#/liste zeigt {items}')
    p.wait_for_timeout(300); run.shot('8-liste')


def dark(run, base):
    p = run.page
    p.goto(base + '#/'); wait_hub(run)
    p.evaluate("""localStorage.clear();
      localStorage.setItem('stammtisch-best-neunerjagd', JSON.stringify({score: 312, title: 'Neunmörder'}));
      localStorage.setItem('stammtisch-best-neuner-hauen', JSON.stringify({score: 171, title: 'Tischklopfer'}));
      localStorage.setItem('stammtisch-oberwelt-hinweis', 'true');""")
    p.reload(); wait_hub(run); p.wait_for_timeout(600)
    if not run.js('document.documentElement && getComputedStyle(document.documentElement).colorScheme.includes("dark")'):
        run.notes.append('Dunkelmodus nicht aktiv?')
    run.shot('d1-dunkel')
    if go_station(run, 'neuner-hauen'):
        p.wait_for_timeout(500); run.shot('d2-dunkel-wirtshaus')


def main():
    headless = '--sichtbar' not in sys.argv
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
            dev = dict(pw.devices['Pixel 7']); dev.pop('default_browser_type', None); dev.update(has_touch=True, is_mobile=True)
            for name, fn, scheme in [('oberwelt', flow, 'light'), ('oberwelt', dark, 'dark')]:
                ctx = browser.new_context(**dev, color_scheme=scheme)
                page = ctx.new_page()
                run = Run(page, ctx.new_cdp_session(page), name)
                try:
                    fn(run, base)
                except Exception as e:
                    run.errors.append(f'Ausnahme: {str(e).splitlines()[0]}')
                    try: run.shot('x-ausnahme')
                    except Exception: pass
                results.append((f'{name} ({scheme})', run)); ctx.close()
            browser.close()
    finally:
        srv.terminate()
    ok = True
    for label, r in results:
        good = not r.errors; ok &= good
        print(f"{'OK  ' if good else 'FAIL'} {label:<20} {', '.join(sorted(set(r.notes)))}")
        for e in r.errors:
            print(f'       - {e}')
    print('\nERGEBNIS:', 'bestanden' if ok else 'DURCHGEFALLEN')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
