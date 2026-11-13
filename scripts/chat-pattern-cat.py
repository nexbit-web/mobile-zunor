"""
Кіт для узору шпалер (chat-pattern.py): маскот, що лежить на пузі
(scripts/mascot/cat-love.source.json, кадр 0, без сердечок) — лише його
темні контури, тієї ж товщини, що лінії узору. Пише
scripts/chat-pattern-cat.txt — шлях (d) у одиницях узору, з центром у 0.

    python scripts/chat-pattern-cat.py

Потрібні Chrome (кадр малює lottie-web з web/node_modules) і numpy +
Pillow. Запускати лише коли міняється сам кіт: узор бере готовий файл.

Як: кадр 2000 px у браузері → темні пікселі (контур маскота, без
бордової заливки рота й вух) → потовщені до товщини ліній узору →
поле покриття → ізолінія 0.5 (marching squares) → спрощення → шлях,
заливка even-odd (зовнішні й внутрішні краї ліній).
"""

import io
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, 'mascot', 'cat-love.source.json')
LOTTIE = os.path.join(HERE, '..', '..', 'web', 'node_modules', 'lottie-web',
                      'build', 'player', 'lottie_svg.min.js')
OUT = os.path.join(HERE, 'chat-pattern-cat.txt')
CHROME = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome',
]

#: Ширина кота в узорі (одиниці плитки 1440 × 2960).
WIDTH = 205
#: Товщина ліній — трохи більша за LINE узору (2.6): кіт ставиться в
#: масштабі ~0.9–1, і там лінії виходять такі самі, як у сусідів.
LINE = 2.85
#: Растр для обведення — пікселів на одиницю узору.
PX = 4
#: Контур маскота — темніший за цю яскравість (бордова заливка ~48 — ні).
DARK = 42
#: Спрощення ламаної — в одиницях узору.
EPS = 0.16

PAGE = r'''<!doctype html><html><body style="margin:0;background:#fff">
<script src="lottie.js"></script><div id="c" style="width:2000px;height:2000px"></div>
<script>
const a = lottie.loadAnimation({container: document.getElementById('c'),
  renderer: 'svg', loop: false, autoplay: false, animationData: DATA});
a.addEventListener('DOMLoaded', () => {
  a.goToAndStop(0, true);
  setTimeout(() => {
    const box = document.getElementById('c').getBoundingClientRect();
    // Сердечка — над котом, у верхній половині кадру: лише кіт.
    document.querySelectorAll('#c path').forEach((p) => {
      const r = p.getBoundingClientRect();
      if (r.height > 0 && r.bottom < box.top + box.height * 0.47) {
        p.style.display = 'none';
      }
    });
  }, 300);
});
</script></body></html>'''


def render(tmp):
    chrome = next((c for c in CHROME if shutil.which(c) or os.path.exists(c)),
                  None)
    if not chrome:
        raise SystemExit('потрібен Chrome')
    shutil.copy(LOTTIE, os.path.join(tmp, 'lottie.js'))
    data = json.load(io.open(SOURCE, encoding='utf-8'))
    page = os.path.join(tmp, 'cat.html')
    io.open(page, 'w', encoding='utf-8').write(
        PAGE.replace('DATA', json.dumps(data)))
    png = os.path.join(tmp, 'cat.png')
    subprocess.run([chrome, '--headless=new', '--disable-gpu',
                    '--hide-scrollbars', '--virtual-time-budget=8000',
                    '--window-size=2000,2000', '--screenshot=' + png,
                    'file:///' + page.replace('\\', '/')],
                   check=True, capture_output=True)
    return png


def dilate(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r and (dx or dy):
                out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def field(png):
    """Поле покриття ліній (0…1) у растрі PX пікселів на одиницю."""
    im = np.asarray(Image.open(png).convert('RGB')).astype(float)
    lum = 0.299 * im[..., 0] + 0.587 * im[..., 1] + 0.114 * im[..., 2]
    nonwhite = im.sum(-1) < 740
    ys, xs = np.nonzero(nonwhite)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    dark = lum[y0:y1, x0:x1] < DARK
    w_px = x1 - x0
    # Своя товщина контуру маскота в цьому кадрі — медіана «товщин» по
    # рядках; потовщуємо до LINE в масштабі узору.
    runs = []
    for row in dark[::7]:
        edges = np.flatnonzero(np.diff(row.astype(int)))
        runs += [b - a for a, b in zip(edges[::2], edges[1::2]) if b - a < 40]
    own = float(np.median(runs))
    want = LINE * w_px / WIDTH
    r = max(0, int(round((want - own) / 2)))
    thick = dilate(np.pad(dark, r + 2), r)
    scale = WIDTH * PX / w_px
    h, w = thick.shape
    img = Image.fromarray(thick.astype(np.float32), mode='F')
    small = img.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                       Image.BOX)
    f = np.asarray(small, dtype=float)
    print('кадр %dx%d px, контур %.1f px → %.1f px (r=%d)'
          % (w_px, y1 - y0, own, want, r))
    return np.pad(f, 1)


def contours(f, level=0.5):
    """Ізолінії поля (marching squares), замкнені ламані в пікселях."""
    h, w = f.shape
    above = f >= level

    def point(edge):
        kind, y, x = edge
        if kind == 'h':  # між (y, x) і (y, x + 1)
            a, b = f[y, x], f[y, x + 1]
            t = (level - a) / (b - a) if b != a else 0.5
            return (x + t, y)
        a, b = f[y, x], f[y + 1, x]
        t = (level - a) / (b - a) if b != a else 0.5
        return (x, y + t)

    nxt = {}
    cells = np.argwhere(
        (above[:-1, :-1] != above[:-1, 1:]) | (above[:-1, :-1] != above[1:, :-1])
        | (above[1:, 1:] != above[:-1, 1:]) | (above[1:, 1:] != above[1:, :-1]))
    for y, x in cells:
        tl, tr = int(above[y, x]), int(above[y, x + 1])
        br, bl = int(above[y + 1, x + 1]), int(above[y + 1, x])
        top, right = ('h', y, x), ('v', y, x + 1)
        bottom, left = ('h', y + 1, x), ('v', y, x)
        case = (tl << 3) | (tr << 2) | (br << 1) | bl
        # Обхід за годинниковою: «усередині» (вище рівня) — праворуч.
        segs = {
            1: [(left, bottom)], 2: [(bottom, right)], 3: [(left, right)],
            4: [(right, top)], 6: [(bottom, top)], 7: [(left, top)],
            8: [(top, left)], 9: [(top, bottom)], 11: [(top, right)],
            12: [(right, left)], 13: [(right, bottom)], 14: [(bottom, left)],
        }.get(case)
        if case in (5, 10):
            centre = (f[y, x] + f[y, x + 1] + f[y + 1, x] + f[y + 1, x + 1]) / 4
            if case == 5:
                segs = ([(left, top), (right, bottom)] if centre >= level
                        else [(left, bottom), (right, top)])
            else:
                segs = ([(top, right), (bottom, left)] if centre >= level
                        else [(top, left), (bottom, right)])
        for a, b in segs or []:
            nxt[a] = b
    loops = []
    seen = set()
    for start in list(nxt):
        if start in seen:
            continue
        loop = []
        e = start
        while e not in seen and e in nxt:
            seen.add(e)
            loop.append(point(e))
            e = nxt[e]
        if len(loop) > 2:
            loops.append(loop)
    return loops


def simplify(pts, eps):
    """Рамер — Дуглас — Пекер для замкненої ламаної."""
    def rdp(seq):
        if len(seq) < 3:
            return seq
        (ax, ay), (bx, by) = seq[0], seq[-1]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-9
        best, idx = 0.0, 0
        for i in range(1, len(seq) - 1):
            px, py = seq[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > best:
                best, idx = d, i
        if best <= eps:
            return [seq[0], seq[-1]]
        return rdp(seq[:idx + 1])[:-1] + rdp(seq[idx:])
    # Замкнену ріжемо в найдальшій від першої точці.
    far = max(range(len(pts)), key=lambda i: math.hypot(
        pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]))
    a = rdp(pts[:far + 1])
    b = rdp(pts[far:] + [pts[0]])
    return a[:-1] + b[:-1]


def num(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def path(loops, cx, cy):
    out = []
    for loop in loops:
        x0, y0 = loop[0]
        parts = ['M%s %s' % (num(x0 - cx), num(y0 - cy))]
        px, py = round(x0, 1), round(y0, 1)
        for x, y in loop[1:]:
            x, y = round(x, 1), round(y, 1)
            dx, dy = x - px, y - py
            parts.append('l%s%s%s' % (num(dx), '' if num(dy).startswith('-') else ' ', num(dy)))
            px, py = x, y
        out.append(''.join(parts) + 'z')
    return ''.join(out)


def main():
    sys.setrecursionlimit(20000)
    with tempfile.TemporaryDirectory() as tmp:
        f = field(render(tmp))
    loops = contours(f)
    # У пікселях → в одиниці узору; дрібне сміття (менше пів одиниці) — геть.
    unit = [[(x / PX, y / PX) for x, y in loop] for loop in loops]
    unit = [l for l in unit if max(p[0] for p in l) - min(p[0] for p in l) > 0.5
            or max(p[1] for p in l) - min(p[1] for p in l) > 0.5]
    unit = [simplify(l, EPS) for l in unit]
    xs = [p[0] for l in unit for p in l]
    ys = [p[1] for l in unit for p in l]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    d = path(unit, cx, cy)
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(
        '# Кіт для узору (scripts/chat-pattern-cat.py): ширина висота, далі d.\n'
        '%s %s\n%s\n' % (num(w), num(h), d))
    print('записав %s: %d контурів, %d точок, %d знаків, %sx%s'
          % (os.path.relpath(OUT), len(unit), sum(len(l) for l in unit),
             len(d), num(w), num(h)))


if __name__ == '__main__':
    main()
