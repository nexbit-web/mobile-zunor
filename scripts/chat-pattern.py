"""
Узор шпалер чату застосунку: web/static/chat-pattern.svg (узор сайту) +
знак Zunor контуром на місці кількох малюнків і маскот-кіт, що лежить на
пузі (власник: «у тому ж стилі, лініями»). Пише
src/components/chat/chat-pattern.ts. Кота готує chat-pattern-cat.py
(chat-pattern-cat.txt).

    python scripts/chat-pattern.py            # згенерувати
    python scripts/chat-pattern.py --list     # малюнки-кандидати (розміри)
    python scripts/chat-pattern.py --preview out.svg   # SVG для перегляду

Як: кожен <path> сайту — багато малюнків (контури, залиті чорним).
Розбираємо шляхи на підконтури, групуємо ті, що перекриваються, у
малюнки, вибираємо кілька підходящого розміру подалі один від одного й
від країв плитки (вона повторюється), прибираємо їх і малюємо на їхньому
місці знак Zunor обведеним контуром тієї самої товщини (LINE).
"""

import io
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', 'web', 'static', 'chat-pattern.svg')
OUT = os.path.join(HERE, '..', 'src', 'components', 'chat', 'chat-pattern.ts')
CAT = os.path.join(HERE, 'chat-pattern-cat.txt')

W, H = 1440, 2960
#: Товщина ліній узору (кільце «o» сайту — ~2,5 одиниці).
LINE = 2.6
#: Скільки знаків на плитку і якого розміру малюнки замінюємо.
COUNT = 6
MIN_SIDE, MAX_SIDE = 66, 120
#: Найбільша висота знака — як середній малюнок узору.
LOGO_MAX = 104
#: Від краю плитки — малюнок не має переходити на сусідню.
MARGIN = 40
#: Кіт — на місці великих широких малюнків (лежить, тож широкий).
CATS = 2
CAT_MIN_W, CAT_MAX_W = 150, 330
CAT_MIN_H, CAT_MAX_H = 70, 230
#: Від кота до найближчого знака — щоб не злипались.
CAT_GAP = 200
#: Нахил і дзеркало котів — по-різному, як малюнки узору.
CAT_POSES = [(-6, 1), (5, -1), (-3, -1), (7, 1)]
#: Нахил знаків — як у малюнків узору, різний.
ANGLES = [-14, 10, -6, 16, -10, 8, -18, 12]

#: Знак Zunor (components/zunor-mark.tsx, web/static/logo.svg), 393 × 411.
LOGO_W, LOGO_H = 393, 411
LOGO = (
    'M168.1 405.9C123.4 401.9 77.8 385.3 50.4 363.0C-11.3 312.5 -10.6 211.2 52.2 115.9C66.7 93.8 77.9 80.0 96.0 61.9C129.1 28.8 143.2 22.7 151.1 38.1C153.1 42.2 153.2 43.1 152.5 61.9C151.8 81.0 151.8 81.6 154.0 84.2C155.6 86.4 157.0 87.0 159.8 87.0C164.3 87.0 166.6 85.1 174.6 75.0C195.6 48.4 230.7 11.2 238.7 7.1C241.5 5.7 244.8 5.0 248.6 5.0C254.1 5.0 254.5 5.2 259.0 9.8C263.2 13.9 264.1 15.7 266.8 24.5C272.0 41.5 279.6 70.0 288.1 104.5C292.5 122.6 296.8 138.7 297.6 140.2C299.4 143.6 301.9 145.0 306.2 145.0C310.9 145.0 313.2 143.2 328.2 127.6C350.0 104.9 356.1 100.9 363.7 104.7C370.3 108.0 372.7 112.3 376.6 127.6C403.3 233.6 386.4 316.1 328.1 364.3C289.1 396.7 231.8 411.6 168.1 405.9Z'
    'M187.9 348.0C200.0 341.5 213.5 322.9 218.4 305.9C220.5 298.9 226.0 255.8 226.0 246.9C226.0 233.2 219.4 215.3 211.3 207.2C191.4 187.3 161.7 202.2 147.0 239.4C140.8 255.2 138.8 265.7 138.3 286.0C137.6 311.2 139.9 323.1 148.2 337.0C151.6 342.7 159.0 349.0 164.4 350.8C170.5 352.9 181.0 351.7 187.9 348.0Z'
    'M67.6 319.0C69.9 317.8 73.7 314.9 75.9 312.5C80.9 307.1 89.3 290.4 92.0 280.8C94.0 273.6 99.0 233.0 99.0 224.4C99.0 212.5 92.8 194.4 86.1 186.8C80.0 179.8 70.0 177.9 61.3 182.1C47.3 188.9 34.4 216.1 31.1 246.3C25.8 294.0 44.0 330.4 67.6 319.0Z'
)

ARGS = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'T': 2,
        'A': 7, 'Z': 0}


def fmt(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


NUM = re.compile(r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?')
CMDS = 'MmLlHhVvCcSsQqTtAaZz'


def tokens(d):
    """Команди й числа шляху. У дузі прапорці — по одній цифрі: стиснений
    запис «a5 5 0 01-5 5» інакше прочитався б як число 01."""
    out = []
    i = 0
    cmd = None
    arg = 0
    while i < len(d):
        ch = d[i]
        if ch.isspace() or ch == ',':
            i += 1
            continue
        if ch in CMDS:
            out.append((ch, i, i + 1))
            cmd = ch.upper()
            arg = 0
            i += 1
            continue
        if cmd == 'A' and arg % 7 in (3, 4):
            out.append((ch, i, i + 1))
            arg += 1
            i += 1
            continue
        m = NUM.match(d, i)
        if not m:
            raise ValueError('bad path at %d: %r' % (i, d[i:i + 20]))
        out.append((m.group(), m.start(), m.end()))
        arg += 1
        i = m.end()
    return out


def arc_points(x0, y0, x1, y1, r):
    """Рамка дуги без повного розрахунку: кінці й «горб» в обидва боки."""
    c = math.hypot(x1 - x0, y1 - y0)
    if c == 0:
        return [(x1, y1)]
    half = c / 2
    sag = r - math.sqrt(r * r - half * half) if r >= half else half
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    nx, ny = -(y1 - y0) / c, (x1 - x0) / c
    return [(x1, y1), (mx + nx * sag, my + ny * sag),
            (mx - nx * sag, my - ny * sag)]


def subpaths(d):
    """Підконтури шляху: (текст із абсолютним M на початку, точки)."""
    toks = tokens(d)
    out = []
    i = 0
    cx = cy = sx = sy = 0.0
    cur = None
    while i < len(toks):
        cmd = toks[i][0]
        if cmd not in CMDS:
            raise ValueError('number without command at %d' % toks[i][1])
        i += 1
        up = cmd.upper()
        rel = cmd != up
        n = ARGS[up]
        if up == 'Z':
            cx, cy = sx, sy
            continue
        first = True
        while i + n <= len(toks) and toks[i][0] not in CMDS:
            vals = [float(t[0]) for t in toks[i:i + n]]
            if up == 'M' and first:
                x, y = vals
                if rel:
                    x += cx
                    y += cy
                cx, cy, sx, sy = x, y, x, y
                cur = {'start': (x, y), 'head_end': toks[i + n - 1][2],
                       'points': [(x, y)], 'implicit': 'l' if rel else 'L'}
                out.append(cur)
                i += n
                first = False
                continue
            if up in ('M', 'L', 'T'):
                x, y = vals
                if rel:
                    x += cx
                    y += cy
                pts, nxt = [(x, y)], (x, y)
            elif up == 'H':
                nxt = (vals[0] + (cx if rel else 0), cy)
                pts = [nxt]
            elif up == 'V':
                nxt = (cx, vals[0] + (cy if rel else 0))
                pts = [nxt]
            elif up in ('C', 'S', 'Q'):
                pairs = [(vals[k], vals[k + 1]) for k in range(0, n, 2)]
                pts = [((px + cx, py + cy) if rel else (px, py))
                       for px, py in pairs]
                nxt = pts[-1]
            else:  # A
                x, y = vals[5], vals[6]
                if rel:
                    x += cx
                    y += cy
                r = max(abs(vals[0]), abs(vals[1]))
                pts, nxt = arc_points(cx, cy, x, y, r), (x, y)
            cur['points'].extend(pts)
            cx, cy = nxt
            i += n
    # Текст кожного підконтуру: «M x y» + решта як була (відносні команди
    # після M залежать лише від точок цього ж підконтуру).
    starts = [t[1] for t in toks if t[0] in 'Mm'] + [len(d)]
    for k, sp in enumerate(out):
        tail = d[sp['head_end']:starts[k + 1]]
        head = 'M%s %s' % (fmt(sp['start'][0]), fmt(sp['start'][1]))
        stripped = tail.lstrip()
        if stripped and stripped[0] not in 'MmLlHhVvCcSsQqTtAaZz':
            # Після «m x y» ще пари — це неявні lineto.
            tail = sp['implicit'] + stripped
        sp['text'] = head + tail
        xs = [p[0] for p in sp['points']]
        ys = [p[1] for p in sp['points']]
        sp['box'] = (min(xs), min(ys), max(xs), max(ys))
    return out


def doodles(paths):
    """Малюнки: підконтури, чиї рамки перекриваються (union-find)."""
    items = [(pi, sp) for pi, sps in enumerate(paths) for sp in sps]
    parent = list(range(len(items)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    order = sorted(range(len(items)), key=lambda k: items[k][1]['box'][0])
    active = []
    for k in order:
        b = items[k][1]['box']
        active = [j for j in active if items[j][1]['box'][2] + 3 >= b[0]]
        for j in active:
            c = items[j][1]['box']
            if b[1] <= c[3] + 3 and c[1] <= b[3] + 3:
                parent[find(j)] = find(k)
        active.append(k)
    groups = {}
    for k in range(len(items)):
        groups.setdefault(find(k), []).append(k)
    out = []
    for ks in groups.values():
        boxes = [items[k][1]['box'] for k in ks]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes),
               max(b[2] for b in boxes), max(b[3] for b in boxes))
        out.append({'members': ks, 'box': box})
    return items, out


def torus(a, b):
    dx = abs(a[0] - b[0])
    dy = abs(a[1] - b[1])
    return math.hypot(min(dx, W - dx), min(dy, H - dy))


def pick(groups):
    """COUNT малюнків підходящого розміру, якомога далі один від одного."""
    cand = []
    for g in groups:
        x0, y0, x1, y1 = g['box']
        w, h = x1 - x0, y1 - y0
        if not (MIN_SIDE <= w <= MAX_SIDE and MIN_SIDE <= h <= MAX_SIDE):
            continue
        if x0 < MARGIN or y0 < MARGIN or x1 > W - MARGIN or y1 > H - MARGIN:
            continue
        # Не надто видовжені — знак майже квадратний.
        if max(w, h) / min(w, h) > 1.45:
            continue
        g['center'] = ((x0 + x1) / 2, (y0 + y1) / 2)
        cand.append(g)
    # Перший — найближчий до середини плитки, далі — найдальший від уже
    # вибраних (на плитці, що повторюється).
    cand.sort(key=lambda g: math.hypot(g['center'][0] - W / 2,
                                       g['center'][1] - H / 2))
    chosen = cand[:1]
    while len(chosen) < COUNT and len(chosen) < len(cand):
        best = max((g for g in cand if g not in chosen),
                   key=lambda g: min(torus(g['center'], c['center'])
                                     for c in chosen))
        chosen.append(best)
    return chosen


def pick_cats(groups, logos):
    """CATS великих широких малюнків подалі від знаків і один від одного."""
    cand = []
    for g in groups:
        x0, y0, x1, y1 = g['box']
        w, h = x1 - x0, y1 - y0
        if not (CAT_MIN_W <= w <= CAT_MAX_W and CAT_MIN_H <= h <= CAT_MAX_H):
            continue
        if w / h < 1.15:
            continue
        if x0 < 30 or y0 < 30 or x1 > W - 30 or y1 > H - 30:
            continue
        c = ((x0 + x1) / 2, (y0 + y1) / 2)
        if logos and min(torus(c, l['center']) for l in logos) < CAT_GAP:
            continue
        g['center'] = c
        cand.append(g)
    cand.sort(key=lambda g: -(g['box'][2] - g['box'][0]))
    chosen = cand[:1]
    while len(chosen) < CATS and len(chosen) < len(cand):
        chosen.append(max((g for g in cand if g not in chosen),
                          key=lambda g: min(torus(g['center'], c['center'])
                                            for c in chosen)))
    return chosen


def load_cat():
    lines = io.open(CAT, encoding='utf-8').read().splitlines()
    w, h = (float(v) for v in lines[1].split())
    return w, h, lines[2]


def cat_group(cats):
    w, h, d = load_cat()
    parts = []
    for k, g in enumerate(cats):
        x0, y0, x1, y1 = g['box']
        # Вписати в місце прибраного малюнка; товщина ліній — майже та сама.
        s = min((x1 - x0) / w, (y1 - y0) / h) * 1.02
        s = max(0.88, min(1.1, s))
        angle, flip = CAT_POSES[k % len(CAT_POSES)]
        cx, cy = g['center']
        parts.append('<path transform="translate(%s %s) rotate(%s) scale(%s %s)" d="%s"/>'
                     % (fmt(cx), fmt(cy), angle, '%.3f' % (s * flip),
                        '%.3f' % s, d))
    return '<g fill="#000" fill-rule="evenodd">' + ''.join(parts) + '</g>'


def build():
    svg = io.open(SRC, encoding='utf-8').read().strip()
    path_re = re.compile(r'<path d="([^"]+)"\s*/>')
    ds = path_re.findall(svg)
    paths = [subpaths(d) for d in ds]
    items, groups = doodles(paths)
    chosen = pick(groups)
    cats = pick_cats(groups, chosen)
    return svg, path_re, paths, items, groups, chosen, cats


def logo_group(chosen):
    parts = []
    for k, g in enumerate(chosen):
        x0, y0, x1, y1 = g['box']
        # Трохи більший за прибраний малюнок — довкола нього порожньо, а
        # знак, вписаний упритул, виходив дрібнішим за сусідів.
        s = min((x1 - x0) / LOGO_W, (y1 - y0) / LOGO_H) * 1.12
        # …але не завеликий: як середній малюнок узору.
        s = min(s, LOGO_MAX / LOGO_H)
        cx, cy = g['center']
        parts.append(
            '<path transform="translate(%s %s) rotate(%s) scale(%s) '
            'translate(%s %s)" stroke-width="%s" d="%s"/>'
            % (fmt(cx), fmt(cy), ANGLES[k % len(ANGLES)], ('%.4f' % s),
               fmt(-LOGO_W / 2), fmt(-LOGO_H / 2), fmt(LINE / s), LOGO))
    return ('<g fill="none" stroke="#000" stroke-linejoin="round" '
            'stroke-linecap="round">' + ''.join(parts) + '</g>')


def render():
    svg, path_re, paths, items, groups, chosen, cats = build()
    drop = set()
    for g in chosen + cats:
        for k in g['members']:
            drop.add(id(items[k][1]))
    new_ds = []
    for sps in paths:
        kept = [sp['text'] for sp in sps if id(sp) not in drop]
        new_ds.append(''.join(kept))
    it = iter(new_ds)
    out = path_re.sub(lambda m: '<path d="%s"/>' % next(it), svg)
    # Знаки — поруч із малюнками, у тій самій обрізці плитки.
    extra = logo_group(chosen) + cat_group(cats)
    out = out.replace('</g><defs>', '</g>' + extra + '<defs>', 1)
    if extra not in out:
        raise SystemExit('не знайшов місця для знаків (</g><defs>)')
    return out, chosen, cats


def main():
    if '--list' in sys.argv:
        _, _, _, _, groups, chosen, cats = build()
        sizes = sorted(groups, key=lambda g: -(g['box'][2] - g['box'][0]))
        print('малюнків:', len(groups))
        for g in chosen:
            x0, y0, x1, y1 = g['box']
            print('вибрано: %4d,%4d  %3dx%3d' % (x0, y0, x1 - x0, y1 - y0))
        for g in cats:
            x0, y0, x1, y1 = g['box']
            print('кіт:     %4d,%4d  %3dx%3d' % (x0, y0, x1 - x0, y1 - y0))
        return
    out, chosen, cats = render()
    if '--preview' in sys.argv:
        dest = sys.argv[sys.argv.index('--preview') + 1]
        io.open(dest, 'w', encoding='utf-8').write(out)
        print('preview:', dest)
        return
    ts = (
        '// ЗГЕНЕРОВАНО (mobile/scripts/chat-pattern.py) з\n'
        '// web/static/chat-pattern.svg — узор шпалер чату сайту, і на місці\n'
        '// кількох малюнків — знак Zunor і кіт-маскот контуром (власник).\n'
        '// Рядком у бандлі, а не файлом-ресурсом: Skia розбирає його одразу, без\n'
        '// завантаження й растеризації, тож шпалери стоять із першого кадру.\n'
        '// Змінився узор на сайті — `python scripts/chat-pattern.py`.\n'
        '// prettier-ignore\n'
        'export const CHAT_PATTERN_SVG =\n  %s\n' % json.dumps(out, ensure_ascii=False)
    )
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(ts)
    print('записав', os.path.relpath(OUT), '— знаків:', len(chosen),
          'котів:', len(cats))


if __name__ == '__main__':
    main()
