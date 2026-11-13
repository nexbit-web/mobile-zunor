// Маленький набір для Lottie руками: значення, ключові кадри, фігури,
// шари. Лише те, що треба сценам кота (build.mjs). Координати — у
// пікселях полотна, кути — у градусах, час — у кадрах.

/** #rrggbb → [r, g, b, 1] у частках. */
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]
}

// Криві. Lottie: `o` — перша точка керування (вихід із кадру), `i` —
// друга (вхід у наступний). Без перельоту: y ∈ [0, 1] — жодних пружин.
export const EASE = {
  inOut: { o: [0.42, 0], i: [0.58, 1] },
  out: { o: [0.16, 1], i: [0.3, 1] },
  in: { o: [0.7, 0], i: [0.84, 0] },
  linear: { o: [0, 0], i: [1, 1] },
}

const dims = (v) => (Array.isArray(v) ? v.length : 1)
const arr = (v) => (Array.isArray(v) ? v : [v])

/** Незмінне значення. */
export const K = (v) => ({ a: 0, k: v })

/**
 * Ключові кадри: `[[кадр, значення, крива?], …]`. Крива — того відрізка,
 * що ПОЧИНАЄТЬСЯ з цього кадру (за замовчуванням inOut).
 */
export function A(keys, { spatial = false } = {}) {
  return {
    a: 1,
    k: keys.map(([t, v, curve = 'inOut'], idx) => {
      const s = arr(v)
      if (idx === keys.length - 1) return { t, s }
      const e = EASE[curve]
      const n = spatial ? 1 : dims(v)
      const pick = (p, j) => (spatial ? p[j] : Array(n).fill(p[j]))
      const frame = {
        t,
        s,
        o: { x: pick(e.o, 0), y: pick(e.o, 1) },
        i: { x: pick(e.i, 0), y: pick(e.i, 1) },
      }
      if (spatial) {
        frame.to = s.map(() => 0)
        frame.ti = s.map(() => 0)
      }
      return frame
    }),
  }
}

/**
 * Плавне коливання: base → base+amp → base … кожні півперіоду, до `total`.
 * `total` кратне `period` — петля без шва. `high` — почати з вершини
 * (щоб кілька речей не рухались в унісон).
 */
export function sway(base, amp, period, total, high = false) {
  const keys = []
  const at = (k) =>
    Array.isArray(base) ? base.map((b, i) => b + arr(amp)[i] * k) : base + amp * k
  for (let t = 0, i = high ? 1 : 0; t <= total; t += period / 2, i++) {
    keys.push([t, at(i % 2)])
  }
  return keys
}

// ——— Контури ———————————————————————————————————————————————

/**
 * Контур як в SVG: moveTo / lineTo / curveTo / arcTo (чверть кола) і
 * close. Вершина Lottie має дотичні in/out ВІДНОСНО себе.
 */
export class Path {
  constructor() {
    this.v = []
    this.i = []
    this.o = []
    this.closed = false
  }
  get last() {
    return this.v[this.v.length - 1]
  }
  move(x, y) {
    this.v.push([x, y])
    this.i.push([0, 0])
    this.o.push([0, 0])
    return this
  }
  line(x, y) {
    return this.move(x, y)
  }
  /** Кубічна: c1, c2 — абсолютні точки керування. */
  curve(c1x, c1y, c2x, c2y, x, y) {
    const [px, py] = this.last
    this.o[this.o.length - 1] = [c1x - px, c1y - py]
    this.v.push([x, y])
    this.i.push([c2x - x, c2y - y])
    this.o.push([0, 0])
    return this
  }
  /** Дуга чверті кола до (x, y); `cw` — за годинниковою (екранні осі). */
  quarter(x, y, cx, cy) {
    // Кут дуги — 90°: точки керування на дотичних, довжина k·r.
    const [px, py] = this.last
    const k = 0.5523
    const c1 = [px + (cx - px) * k, py + (cy - py) * k]
    const c2 = [x + (cx - x) * k, y + (cy - y) * k]
    return this.curve(c1[0], c1[1], c2[0], c2[1], x, y)
  }
  close() {
    // Остання вершина в тій самій точці, що перша, — зливаємо.
    const [fx, fy] = this.v[0]
    const [lx, ly] = this.last
    if (this.v.length > 1 && Math.hypot(fx - lx, fy - ly) < 0.01) {
      this.i[0] = this.i.pop()
      this.v.pop()
      this.o.pop()
    }
    this.closed = true
    return this
  }
  shape(nm = 'path') {
    return {
      ty: 'sh',
      nm,
      ks: K({ i: this.i, o: this.o, v: this.v, c: this.closed }),
    }
  }
}

/** Плавна крива крізь точки (Catmull-Rom). `sharp` — індекси кутів. */
export function smooth(points, { closed = true, tension = 1, sharp = [] } = {}) {
  const n = points.length
  const p = new Path()
  const tan = (j) => {
    if (sharp.includes(j)) return [0, 0]
    const a = points[closed ? (j - 1 + n) % n : Math.max(0, j - 1)]
    const b = points[closed ? (j + 1) % n : Math.min(n - 1, j + 1)]
    return [((b[0] - a[0]) / 6) * tension, ((b[1] - a[1]) / 6) * tension]
  }
  points.forEach(([x, y], j) => {
    const t = tan(j)
    p.v.push([x, y])
    p.i.push([-t[0], -t[1]])
    p.o.push([t[0], t[1]])
  })
  if (!closed) {
    p.i[0] = [0, 0]
    p.o[n - 1] = [0, 0]
  }
  p.closed = closed
  return p
}

/**
 * Контур, що змінюється: `[[кадр, Path, крива?], …]`, у всіх контурів —
 * однаково вершин. Криві — числами, як експортує Bodymovin.
 */
export function morph(nm, keys) {
  return {
    ty: 'sh',
    nm,
    ks: {
      a: 1,
      k: keys.map(([t, p, curve = 'inOut'], idx) => {
        const s = [{ i: p.i, o: p.o, v: p.v, c: p.closed }]
        if (idx === keys.length - 1) return { t, s }
        const e = EASE[curve]
        return { t, s, o: { x: e.o[0], y: e.o[1] }, i: { x: e.i[0], y: e.i[1] } }
      }),
    },
  }
}

/** Прямокутник із заокругленням як контур (щоб поєднувати з хвостиком). */
export function roundRect(x0, y0, x1, y1, r) {
  return new Path()
    .move(x0 + r, y0)
    .line(x1 - r, y0)
    .quarter(x1, y0 + r, x1, y0)
    .line(x1, y1 - r)
    .quarter(x1 - r, y1, x1, y1)
    .line(x0 + r, y1)
    .quarter(x0, y1 - r, x0, y1)
    .line(x0, y0 + r)
    .quarter(x0 + r, y0, x0, y0)
    .close()
}

// ——— Фігури й стилі —————————————————————————————————————————

export const el = (x, y, w, h = w) => ({ ty: 'el', d: 1, p: K([x, y]), s: K([w, h]) })
export const rc = (x, y, w, h, r) => ({ ty: 'rc', d: 1, p: K([x, y]), s: K([w, h]), r: K(r) })
/** Зірка: `points` променів, зовнішній і внутрішній радіуси. */
export const star = (x, y, points, outer, inner, rot = 0, roundOuter = 0, roundInner = 0) => ({
  ty: 'sr',
  sy: 1,
  d: 1,
  pt: K(points),
  p: K([x, y]),
  r: K(rot),
  or: K(outer),
  ir: K(inner),
  os: K(roundOuter),
  is: K(roundInner),
})
export const fill = (hex, o = 100) => ({ ty: 'fl', c: K(rgb(hex)), o: typeof o === 'number' ? K(o) : o, r: 1 })
export const stroke = (hex, w, o = 100) => ({
  ty: 'st',
  c: K(rgb(hex)),
  o: typeof o === 'number' ? K(o) : o,
  w: K(w),
  lc: 2,
  lj: 2,
  ml: 4,
})
/** Пунктир: штрих, проміжок, зсув (зсув можна анімувати — «біжить»). */
export const dashed = (st, dash, gap, offset = K(0)) => ({
  ...st,
  d: [
    { n: 'd', nm: 'dash', v: K(dash) },
    { n: 'g', nm: 'gap', v: K(gap) },
    { n: 'o', nm: 'offset', v: offset },
  ],
})

/** Ключі одного циклу `[[t, v, крива?], …]` (t у [0, period)) — `times` разів. */
export function repeat(keys, period, times) {
  const out = []
  for (let n = 0; n < times; n++) for (const [t, v, c] of keys) out.push([t + n * period, v, c])
  return out
}

/** Іскра: з нічого виростає й гасне; `at` — кадри початку спалахів. */
export function twinkle(at, len = 24) {
  const keys = []
  for (const t of at) keys.push([t, [0, 0]], [t + len / 2, [100, 100]], [t + len, [0, 0]])
  return A(keys)
}

/** Обрізка контуру (поява галочки): s/e у відсотках. */
export const trim = (e, s = K(0)) => ({ ty: 'tm', s, e, o: K(0), m: 1 })

/** Перетворення групи. Будь-яке поле — число/масив або A(…). */
export function tr({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) {
  const v = (x) => (x && x.a !== undefined ? x : K(x))
  return { ty: 'tr', p: v(p), a: v(a), s: v(s), r: v(r), o: v(o), sk: K(0), sa: K(0) }
}

/** Група: фігури, далі стилі (перші в списку малюються зверху). */
export const group = (nm, items, transform = {}) => ({ ty: 'gr', nm, it: [...items, tr(transform)] })

/** Наліпка: контур чорнилом поверх заливки — як у кота. */
export const sticker = (nm, shapes, color, ink, w = 9, transform = {}) =>
  group(nm, [...[].concat(shapes), stroke(ink, w), fill(color)], transform)

// ——— Шари ————————————————————————————————————————————————————

let nextInd = 1000

/** Шар фігур. Перетворення шару — як у групи, але 3D-масиви. */
export function shapeLayer(nm, shapes, { p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100, parent, ip = 0, op, ...rest } = {}) {
  const v3 = (x) => {
    const to3 = (v) => (v.length === 2 ? [...v, 0] : v)
    if (x && x.a === 1) return { a: 1, k: x.k.map((f) => ({ ...f, s: to3(f.s), ...(f.to ? { to: to3(f.to), ti: to3(f.ti) } : {}) })) }
    if (x && x.a === 0) return x
    return K(Array.isArray(x) && x.length === 2 ? [...x, 0] : x)
  }
  const v1 = (x) => (x && x.a !== undefined ? x : K(x))
  return {
    ddd: 0,
    ind: nextInd++,
    ty: 4,
    nm,
    sr: 1,
    ks: { o: v1(o), r: v1(r), p: v3(p), a: v3(a), s: v3(s) },
    ao: 0,
    shapes,
    ip,
    op,
    st: 0,
    bm: 0,
    ...(parent !== undefined ? { parent } : {}),
    ...rest,
  }
}
