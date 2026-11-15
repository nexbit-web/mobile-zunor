"""Крок 1 обведення (запускає run.py): чорнило контуру ink.png → осьові лінії
і суцільні плями → traced.json. Спершу так обводили лежачого кота для
узору чату; тут — сидячого кота з source.webp."""
import json
import math
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import contourpy

SCALE = 2            # чорнило — у 2× від картинки
img = np.array(Image.open('ink.png').convert('L'))
ink = img < 128

# Кадрування до чорнила, щоб тоншення було швидким
ys, xs = np.nonzero(ink)
y0, y1, x0, x1 = ys.min() - 4, ys.max() + 5, xs.min() - 4, xs.max() + 5
ink = ink[y0:y1, x0:x1]
dt = ndi.distance_transform_edt(ink)


def zhang_suen(b):
    im = b.astype(np.uint8).copy()
    while True:
        changed = False
        for step in (0, 1):
            P = np.pad(im, 1)
            p2 = P[:-2, 1:-1]; p3 = P[:-2, 2:]; p4 = P[1:-1, 2:]; p5 = P[2:, 2:]
            p6 = P[2:, 1:-1]; p7 = P[2:, :-2]; p8 = P[1:-1, :-2]; p9 = P[:-2, :-2]
            B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
            seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.uint8) for i in range(8))
            if step == 0:
                c1 = p2 * p4 * p6; c2 = p4 * p6 * p8
            else:
                c1 = p2 * p4 * p8; c2 = p2 * p6 * p8
            m = (im == 1) & (B >= 2) & (B <= 6) & (A == 1) & (c1 == 0) & (c2 == 0)
            if m.any():
                im[m] = 0
                changed = True
        if not changed:
            return im.astype(bool)


# ─── Плями (зіниці, носик, веснянки): компоненти, «товсті» відносно довжини ───
lab, n = ndi.label(ink, structure=np.ones((3, 3)))
blob_mask = np.zeros_like(ink)
stats = []
for i in range(1, n + 1):
    comp = lab == i
    area = comp.sum()
    m = dt[comp].max()
    yy, xx = np.nonzero(comp)
    ratio = area / (m * m)
    stats.append((i, int(area), round(float(m), 1), round(float(ratio), 1), int(xx.min() + x0), int(yy.min() + y0), int(xx.max() - xx.min()), int(yy.max() - yy.min())))
if '--stats' in sys.argv:
    for s in sorted(stats, key=lambda s: s[3]):
        print(s)
    sys.exit()

# Плями: малі округлі компоненти (веснянки) цілком; у змішаних (очі, рот із
# носиком) — те, що товстіше за лінію (зіниці, носик): ядро dt > R, розширене назад.
R = 16
yy_, xx_ = np.mgrid[-20:21, -20:21]
disk = (xx_ ** 2 + yy_ ** 2) <= (R + 1.5) ** 2
for (i, area, m, ratio, *_r) in stats:
    comp = lab == i
    if area < 20:
        ink[comp] = False          # пилинки
        continue
    if ratio < 6:
        blob_mask |= comp
    elif m > R + 2 and ratio < 60:
        compf = ndi.binary_fill_holes(comp)
        dtf = ndi.distance_transform_edt(compf)
        reg = ndi.binary_dilation(dtf > R, structure=disk) & compf
        rl, rn = ndi.label(reg)
        for j in range(1, rn + 1):
            rj = rl == j
            ry, rx = np.nonzero(rj)
            span = max(ry.max() - ry.min(), rx.max() - rx.min())
            if span < 2.2 * 2 * dtf[rj].max():
                blob_mask |= rj
blob_ink = ink & blob_mask
line_mask = ink & ~ndi.binary_dilation(blob_mask, iterations=1)

# Кільця (сердечка): середина смуги — контур на відстані півтовщини від
# зовнішнього краю; без «відростка» в ямці, який дає тоншення.
rings = []
for (i, area, m, ratio, *_r) in stats:
    comp = lab == i
    if area < 20 or ratio < 60:
        continue
    closed_ = ndi.binary_closing(np.pad(comp, 12), structure=ndi.generate_binary_structure(2, 1), iterations=6)[12:-12, 12:-12]
    compf = ndi.binary_fill_holes(closed_ | comp)
    if False:
        hw = float(np.median(dt[zhang_suen(comp)]))
        rings.append((ndi.distance_transform_edt(compf), hw))
        line_mask &= ~comp

skel = zhang_suen(line_mask)
pts = set(zip(*np.nonzero(skel)))
NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def nbrs(p):
    return [(p[0] + dy, p[1] + dx) for dy, dx in NB if (p[0] + dy, p[1] + dx) in pts]


def adj(p, q):
    return abs(p[0] - q[0]) <= 1 and abs(p[1] - q[1]) <= 1


# Прибрати «сходинки»: піксель на куті між двома ортогональними сусідами,
# якщо решта його сусідів і так прилягає до них — зв'язність не зміниться.
changed = True
while changed:
    changed = False
    for p in list(pts):
        y, x = p
        for (a, b) in (((-1, 0), (0, 1)), ((0, 1), (1, 0)), ((1, 0), (0, -1)), ((0, -1), (-1, 0))):
            pa = (y + a[0], x + a[1]); pb = (y + b[0], x + b[1])
            if pa in pts and pb in pts:
                others = [q for q in nbrs(p) if q not in (pa, pb)]
                if all(adj(q, pa) or adj(q, pb) for q in others):
                    pts.discard(p)
                    changed = True
                    break

deg = {p: len(nbrs(p)) for p in pts}
junc = {p for p in pts if deg[p] >= 3}
node_of, nodes = {}, []
for p in junc:
    if p in node_of:
        continue
    stack, cl = [p], []
    node_of[p] = len(nodes)
    while stack:
        q = stack.pop(); cl.append(q)
        for r in nbrs(q):
            if r in junc and r not in node_of:
                node_of[r] = len(nodes); stack.append(r)
    nodes.append(cl)
for p in pts:
    if deg[p] <= 1 and p not in node_of:
        node_of[p] = len(nodes); nodes.append([p])


def is_end(nd):
    return nd >= 0 and len(nodes[nd]) == 1 and deg.get(nodes[nd][0], 0) <= 1


edges = []          # (вузол a, вузол b, [пікселі])
seen = set()
for ni, cl in enumerate(nodes):
    for start in cl:
        for q in nbrs(start):
            if q in node_of and node_of[q] == ni:
                continue
            if (start, q) in seen:
                continue
            path = [start, q]
            seen.add((start, q))
            prev, cur = start, q
            while cur not in node_of:
                nx = [r for r in nbrs(cur) if r != prev and r not in path[-3:]]
                if not nx:
                    break
                prev, cur = cur, nx[0]
                path.append(cur)
            if cur in node_of:
                seen.add((cur, prev))
                edges.append((ni, node_of[cur], path))
visited = set(p for _a, _b, pa in edges for p in pa) | set(node_of)
for p in list(pts):                       # чисті петлі без вузлів (кружечки)
    if p in visited:
        continue
    path = [p]; visited.add(p); cur = p
    while True:
        nx = [r for r in nbrs(cur) if r not in visited]
        if not nx:
            break
        cur = nx[0]; path.append(cur); visited.add(cur)
    if len(path) > 4:
        edges.append((-1, -1, path + [path[0]]))


def plen(pa):
    return sum(math.hypot(pa[i + 1][0] - pa[i][0], pa[i + 1][1] - pa[i][1]) for i in range(len(pa) - 1))


def node_deg(edges):
    dg = {}
    for a, b, _pa in edges:
        for nd in (a, b):
            if nd >= 0:
                dg[nd] = dg.get(nd, 0) + 1
    return dg


# Відростки: кінцеве ребро до розгалуження, коротше за ~товщину лінії
for _ in range(3):
    dg = node_deg(edges)
    keep = []
    for a, b, pa in edges:
        ea, eb = is_end(a), is_end(b)
        if ea ^ eb:
            other = b if ea else a
            j = pa[-1] if ea else pa[0]
            if dg.get(other, 0) >= 3 and plen(pa) < max(dt[j] * 1.8, 10):
                continue
        if a == b and a >= 0 and plen(pa) < 12:
            continue
        keep.append((a, b, pa))
    edges = keep


def merge(edges):
    """Злити ребра через вузли зі ступенем 2 — довгі плавні лінії."""
    while True:
        lists = {}
        for k, (a, b, _pa) in enumerate(edges):
            for nd in (a, b):
                if nd >= 0:
                    lists.setdefault(nd, []).append(k)
        target = next((nd for nd, ks in lists.items() if len(ks) == 2 and ks[0] != ks[1]), None)
        if target is None:
            return edges
        k1, k2 = lists[target]
        a1, b1, p1 = edges[k1]; a2, b2, p2 = edges[k2]
        if b1 != target:
            a1, b1, p1 = b1, a1, p1[::-1]
        if a2 != target:
            a2, b2, p2 = b2, a2, p2[::-1]
        if a1 == b2:          # замкнулось у петлю
            edges = [e for k, e in enumerate(edges) if k not in (k1, k2)] + [(-1, -1, p1 + p2[1:])]
        else:
            edges = [e for k, e in enumerate(edges) if k not in (k1, k2)] + [(a1, b2, p1 + p2[1:])]


edges = merge(edges)

# ─── Згладити, спростити, у координати малюнка ───
allx = [p[1] for _a, _b, pa in edges for p in pa]
ally = [p[0] for _a, _b, pa in edges for p in pa]
bx0, bx1, by0, by1 = min(allx), max(allx), min(ally), max(ally)
CXp, CYp = (bx0 + bx1) / 2, (by0 + by1) / 2
KK = float(sys.argv[1]) if len(sys.argv) > 1 else 0.3
EPS = float(sys.argv[2]) if len(sys.argv) > 2 else 1.6


def to_icon(y, x):
    return ((x - CXp) / SCALE * KK, (y - CYp) / SCALE * KK)


def smooth(pa, closed, sigma=3.5):
    a = np.array(pa, dtype=float)
    if len(a) < 5:
        return a
    if closed:
        a = a[:-1]
        s = np.stack([ndi.gaussian_filter1d(a[:, k], sigma, mode='wrap') for k in (0, 1)], 1)
        return np.vstack([s, s[:1]])
    s = np.stack([ndi.gaussian_filter1d(a[:, k], sigma, mode='nearest') for k in (0, 1)], 1)
    s[0], s[-1] = a[0], a[-1]
    return s


def rdp(a, eps):
    if len(a) < 3:
        return a
    st, en = a[0], a[-1]
    d = en - st
    ln = math.hypot(*d)
    if ln == 0:
        dists = np.hypot(*(a - st).T)
    else:
        dists = np.abs(d[0] * (a[:, 1] - st[1]) - d[1] * (a[:, 0] - st[0])) / ln
    i = int(np.argmax(dists))
    if dists[i] > eps:
        left = rdp(a[:i + 1], eps); right = rdp(a[i:], eps)
        return np.vstack([left[:-1], right])
    return np.vstack([st, en])


def fmt(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def catmull(ptsi, closed):
    if closed:
        ptsi = ptsi[:-1]
    n = len(ptsi)
    d = 'M%s %s' % (fmt(ptsi[0][0]), fmt(ptsi[0][1]))
    for i in (range(n) if closed else range(n - 1)):
        if closed:
            p0, p1, p2, p3 = ptsi[i - 1], ptsi[i], ptsi[(i + 1) % n], ptsi[(i + 2) % n]
        else:
            p0 = ptsi[max(i - 1, 0)]; p1 = ptsi[i]; p2 = ptsi[i + 1]; p3 = ptsi[min(i + 2, n - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += 'C%s %s %s %s %s %s' % tuple(map(fmt, (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])))
    return d + ('Z' if closed else '')


out = []
polys = []
for a, b, pa in edges:
    closed = pa[0] == pa[-1] or (a == b and a >= 0)
    s = smooth(pa, closed)
    if not closed:
        # Вільний кінець — продовжити на ~півтовщини (у джерелі кінці круглі)
        for idx in (0, -1):
            nd = a if idx == 0 else b
            if is_end(nd) and len(s) > 3:
                p = s[idx]
                q = s[min(6, len(s) - 1)] if idx == 0 else s[max(-7, -len(s))]
                v = p - q; ln = math.hypot(*v) or 1
                ext = dt[pa[idx][0], pa[idx][1]] * 0.9
                newp = p + v / ln * ext
                s = np.vstack([newp, s]) if idx == 0 else np.vstack([s, newp])
    r = rdp(s, EPS)
    if closed and len(r) < 5:
        r = s[:: max(1, len(s) // 8)]
        r = np.vstack([r, r[:1]])
    out.append(catmull([to_icon(y, x) for y, x in r], closed))
    polys.append({"pts": [[round(v, 1) for v in to_icon(y, x)] for y, x in (r[:-1] if closed else r)], "closed": bool(closed)})
for (edt_f, hw) in rings:
    g = contourpy.contour_generator(z=ndi.gaussian_filter(edt_f, 3.0), line_type='Separate')
    for c in g.lines(hw):
        c = np.array(c)
        yx = np.stack([c[:, 1], c[:, 0]], 1)
        r = rdp(yx, EPS * 0.8)
        if not np.allclose(r[0], r[-1]):
            r = np.vstack([r, r[:1]])
        out.append(catmull([to_icon(y, x) for y, x in r], True))
stroke_d = ''.join(out)

# Плями: контури (з дірками — відблиски в зіницях), заливка evenodd
gen = contourpy.contour_generator(z=ndi.gaussian_filter(blob_ink.astype(float), 1.0), line_type='Separate')
fills = []
blob_polys = []
for c in gen.lines(0.5):
    c = np.array(c)
    if len(c) < 6:
        continue
    yx = np.stack([c[:, 1], c[:, 0]], 1)
    r = rdp(yx, 1.3)
    if len(r) < 4:
        continue
    if not np.allclose(r[0], r[-1]):
        r = np.vstack([r, r[:1]])
    fills.append(catmull([to_icon(y, x) for y, x in r], True))
    blob_polys.append([[round(v, 1) for v in to_icon(y, x)] for y, x in r[:-1]])
fill_d = ''.join(fills)
json.dump({'stroke': stroke_d, 'fill': fill_d, 'cx': CXp, 'cy': CYp, 'x0': int(x0), 'y0': int(y0), 'k': KK,
           'ox': (int(x0) + CXp) / SCALE, 'oy': (int(y0) + CYp) / SCALE, 'polys': polys, 'blobs': blob_polys}, open('traced.json', 'w'))
print('ліній', len(out), 'плям', len(fills), 'stroke', len(stroke_d), 'fill', len(fill_d))
