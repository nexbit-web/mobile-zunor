"""Крок 2 обведення (запускає run.py). Заливки кота з картинки: області між лініями (кожна — свого кольору)
і плями всередині шерсті (смуги, відблиски). Координати — як у traced.json."""
import json
import sys

import contourpy
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

t = json.load(open('traced.json'))
OX, OY = t['ox'], t['oy']
a = np.array(Image.open('src.png').convert('RGB')).astype(float)
H, W, _ = a.shape

PAL = {
    'bg': (234, 234, 234),
    'ink': (58, 6, 24),
    'fur': (252, 126, 42),
    'dark': (212, 90, 18),
    'light': (255, 162, 96),
    'eye': (255, 236, 230),
    'plum': (114, 18, 54),
    'tongue': (236, 120, 150),
}
names = list(PAL)
cent = np.array([PAL[n] for n in names], float)
d = ((a[:, :, None, :] - cent[None, None]) ** 2).sum(-1)
cls = np.argmin(d, -1)
ci = {n: i for i, n in enumerate(names)}

ink = a.max(axis=2) < 90
bg = cls == ci['bg']
inside = ndi.binary_fill_holes(~bg)          # силует
free = inside & ~ink

lab, n = ndi.label(free)                     # області між лініями (4-зв'язність)
sizes = ndi.sum(free, lab, range(1, n + 1))


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    st, en = pts[0], pts[-1]
    dd = en - st
    ln = np.hypot(*dd)
    dist = np.hypot(*(pts - st).T) if ln == 0 else np.abs(dd[0] * (pts[:, 1] - st[1]) - dd[1] * (pts[:, 0] - st[0])) / ln
    i = int(np.argmax(dist))
    if dist[i] > eps:
        return np.vstack([rdp(pts[:i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([st, en])


def outlines(mask, eps=1.2, min_area=60):
    """Зовнішні контури маски → списки точок (x, y) у координатах малюнка."""
    res = []
    ll, nn = ndi.label(mask)
    for j in range(1, nn + 1):
        m = ndi.binary_fill_holes(ll == j)
        if m.sum() < min_area:
            continue
        g = contourpy.contour_generator(z=ndi.gaussian_filter(np.pad(m, 4).astype(float), 1.2), line_type='Separate')
        best = max(g.lines(0.5), key=len)
        pts = rdp(np.array(best), eps)[:-1]
        if len(pts) >= 3:
            res.append([[round(x - 4 - OX, 1), round(y - 4 - OY, 1)] for x, y in pts])
    return res


regions, patches = [], []
# Тулуб (найбільша область шерсті) — хвіст ховається під нього: заливку
# хвоста тягнемо під тулуб, щоб хвіст гойдався без щілин.
big = int(np.argmax(sizes)) + 1
body_under = ndi.binary_dilation(lab == big, iterations=9)
# Далеко від зовнішнього краю силуету: там продовження хвоста не визирне,
# хоч би як хвіст гойдався.
deep = ndi.distance_transform_edt(inside) > 28
for j in range(1, n + 1):
    if sizes[j - 1] < 120:
        continue
    m = lab == j
    counts = {nm: int((cls[m] == ci[nm]).sum()) for nm in names}
    tot = sum(counts.values())
    kind = 'fur'
    for nm, share in (('eye', 0.45), ('plum', 0.45), ('tongue', 0.35)):
        if counts[nm] > share * tot:
            kind = nm
    # Під лінії: розширити в чорнило — до середини лінії, не за її край
    grown = ndi.binary_dilation(m, iterations=4) & (inside)
    is_tail = j != big and kind == 'fur' and m.sum() > 0.2 * sizes[big - 1]
    if is_tail:
        # Разом із лінією між хвостом і тулубом — одна зв'язна форма
        grown |= ndi.binary_dilation(m, iterations=70) & body_under & deep
        gl, gn = ndi.label(grown)
        grown = gl == (np.argmax(ndi.sum(grown, gl, range(1, gn + 1))) + 1)
    for pts in outlines(grown):
        regions.append({'cls': kind, 'pts': pts, 'area': int(m.sum()), **({'tail': True} if is_tail else {})})
    if kind == 'fur':
        # Плями всередині шерсті: без смужок антиаліасингу біля ліній
        near_ink = ndi.binary_dilation(ink, iterations=3)
        for nm in ('dark', 'light', 'plum'):
            pm = m & (cls == ci[nm]) & ~near_ink
            pm = ndi.binary_opening(pm, iterations=2)
            pm = ndi.binary_dilation(pm, iterations=5) & grown
            for pts in outlines(pm, eps=1.2, min_area=250):
                patches.append({'cls': nm, 'pts': pts})

# Язик — лише найбільший (решта — хибні смужки)
tongues = sorted([r for r in regions if r['cls'] == 'tongue'], key=lambda r: -r['area'])
regions = [r for r in regions if r['cls'] != 'tongue' or r is tongues[0]]

# ── Частини: хвіст і очі (для анімації) ──
from PIL import ImageDraw


def mask_of(pts, grow=0):
    im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(im).polygon([(x + OX, y + OY) for x, y in pts], fill=1)
    m = np.array(im, bool)
    if grow > 0:
        m = ndi.binary_dilation(m, iterations=grow)
    elif grow < 0:
        m = ndi.binary_erosion(m, iterations=-grow)
    return m


def share_in(m, pts):
    hit = 0
    for x, y in pts:
        xi, yi = int(round(x + OX)), int(round(y + OY))
        hit += 0 <= xi < W and 0 <= yi < H and m[yi, xi]
    return hit / max(1, len(pts))


def centroid(pts):
    return [sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)]


furs = sorted([r for r in regions if r['cls'] == 'fur'], key=lambda r: -r['area'])
tail_r = next(r for r in regions if r.get('tail'))
body_r = furs[0] if furs[0] is not tail_r else furs[1]
tail_full = mask_of(tail_r['pts'])
# Лінії хвоста лежать на його краю: смуга довкола хвоста, що не зачіпає тулуб
tail_m = ndi.binary_dilation(tail_full, iterations=12) & ~ndi.binary_dilation(mask_of(body_r['pts']), iterations=12)
eyes = sorted([r for r in regions if r['cls'] == 'eye'], key=lambda r: centroid(r['pts'])[0])
eye_m = {'eyeL': mask_of(eyes[0]['pts'], 24), 'eyeR': mask_of(eyes[1]['pts'], 24)}
eye_near = {'eyeL': mask_of(eyes[0]['pts'], 48), 'eyeR': mask_of(eyes[1]['pts'], 48)}
eyes[0]['part'], eyes[1]['part'] = 'eyeL', 'eyeR'


def part_of(pts, thresh=0.8, use_centroid=False):
    probe = [centroid(pts)] if use_centroid else pts
    for nm, m in eye_m.items():
        if share_in(m, probe) >= thresh:
            return nm
    # Короткі рисочки повік біля очей — теж очі (кліпають разом)
    span = max(max(p[0] for p in pts) - min(p[0] for p in pts), max(p[1] for p in pts) - min(p[1] for p in pts))
    if span < 40:
        for nm, m in eye_near.items():
            if share_in(m, [centroid(pts)]) >= 1:
                return nm
    if share_in(tail_m if not use_centroid else tail_full, probe) >= (0.6 if not use_centroid else 1):
        return 'tail'
    return 'body'


for r in regions:
    r.setdefault('part', 'tail' if r is tail_r else 'body')
for pch in patches:
    pch['part'] = part_of(pch['pts'], use_centroid=True)
strokes = [{'pts': q['pts'], 'closed': q['closed'], 'part': part_of(q['pts'])} for q in t['polys']]
blobs = [{'pts': b, 'part': part_of(b, use_centroid=True)} for b in t['blobs']]
# Ехпорт: усе в координатах малюнка (центр силуету — 0, 0)
json.dump({'regions': regions, 'patches': patches, 'strokes': strokes, 'blobs': blobs}, open('cat-sitting.json', 'w'))
from collections import Counter
print('лінії', Counter(s['part'] for s in strokes), 'плями-заливки', Counter(b['part'] for b in blobs), 'смуги', Counter(p['part'] for p in patches))

print('областей', len(regions), {k: sum(1 for r in regions if r['cls'] == k) for k in ('fur', 'eye', 'plum', 'tongue')}, 'плям', len(patches))
