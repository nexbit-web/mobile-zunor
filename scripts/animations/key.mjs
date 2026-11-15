// «Ключ доступу»: золотий ключ заходить у замкову щілину, провертається
// — довкола розходиться кільце, — виходить, щілина зникає, ключ лишається.
// Угорі «Безпеки» (settings/key-art.tsx). Грається ОДИН раз, коли людина
// відкрила сторінку, — не по колу.
//
// Принцип — як у ключа доступу в Telegram (власник приніс; розібрали їхній
// файл, але не вставляли — намальовано тут, своїм кодом). Фізика та сама:
//   - ключ — ОДНЕ тверде тіло (вушко, комірець, стрижень, зубці) у 3D;
//   - камера з перспективою: ближче — більше (вушко біля камери велике,
//     кінчик далеко — малий);
//   - щілина стоїть ПОПЕРЕК осі ключа, ключ їде вздовж своєї осі й
//     заходить рівно в неї; те, що вже в щілині, — сховане (лезо
//     обрізається площиною оправи);
//   - провертається навколо СВОЄЇ осі: вушко ребром повертається й
//     лягає плазом.
// Кожен STEP-й кадр модель повертається, проєктується, і контури йдуть
// морфами (як у них). Темна обвідка, градієнти в 5 точок, блики; 2,6 с
// при 60 к/с; рівно, без пружин.
//
// ЗАРАЗ НЕ ВИКОРИСТОВУЄТЬСЯ: власник повернув легкий замок
// (scripts/animations/padlock.mjs) — цей файл ~240 КБ. Лежить в
// archive/key у корені (разом із key-art.tsx). Відома вада: на кадрах
// ~136–139 (повернення в спокій) обвідка вушка перескакує між двома
// варіантами (disc → hull) — у дірочці на мить «блимає» стінка.
//
// Запуск — вручну:  node scripts/animations/key.mjs [тека]
// Результат — ../archive/key/key.json.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { K, rgb } from '../mascot/lottie-kit.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = process.argv[2] ?? join(here, '..', '..', '..', 'archive', 'key')

const FR = 60
const OP = 156 // 2,6 с; перший і останній кадри — той самий ключ навскоси
const W = 400
const H = 400
const STEP = 5

// ——— Кольори ——————————————————————————————————————————————————
const OUTLINE = '#6a4000'
const SHINE = '#fff8b0'
const FACE = [
  [0, '#fff35a'],
  [0.3, '#fbd62b'],
  [0.6, '#f2bc1e'],
  [0.85, '#df9f1a'],
  [1, '#c78515'],
]
const SIDE = [
  [0, '#e9ad1a'],
  [0.5, '#c58613'],
  [1, '#8f5a0c'],
]
const HOLE_DARK = [
  [0, '#4a2c05'],
  [1, '#1c1002'],
]
const SLOT = '#0f0801'

// ——— Вектори, матриці, кватерніони ———————————————————————————————
const rad = (d) => (d * Math.PI) / 180
const add = (a, b) => a.map((x, i) => x + b[i])
const sub = (a, b) => a.map((x, i) => x - b[i])
const scale = (a, k) => a.map((x) => x * k)
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a) => scale(a, 1 / Math.hypot(...a))
const lerp = (a, b, t) => (Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * t) : a + (b - a) * t)

const Rx = (d) => {
  const c = Math.cos(rad(d))
  const s = Math.sin(rad(d))
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ]
}
const Ry = (d) => {
  const c = Math.cos(rad(d))
  const s = Math.sin(rad(d))
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ]
}
const Rz = (d) => {
  const c = Math.cos(rad(d))
  const s = Math.sin(rad(d))
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ]
}
const mul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]))
const apply = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2])
/** Матриця зі стовпців (куди йдуть осі x, y, z). */
const fromAxes = (X, Y, Z) => [0, 1, 2].map((i) => [X[i], Y[i], Z[i]])

function quat(M) {
  const tr = M[0][0] + M[1][1] + M[2][2]
  let q
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    q = [(M[2][1] - M[1][2]) / s, (M[0][2] - M[2][0]) / s, (M[1][0] - M[0][1]) / s, s / 4]
  } else if (M[0][0] > M[1][1] && M[0][0] > M[2][2]) {
    const s = Math.sqrt(1 + M[0][0] - M[1][1] - M[2][2]) * 2
    q = [s / 4, (M[0][1] + M[1][0]) / s, (M[0][2] + M[2][0]) / s, (M[2][1] - M[1][2]) / s]
  } else if (M[1][1] > M[2][2]) {
    const s = Math.sqrt(1 + M[1][1] - M[0][0] - M[2][2]) * 2
    q = [(M[0][1] + M[1][0]) / s, s / 4, (M[1][2] + M[2][1]) / s, (M[0][2] - M[2][0]) / s]
  } else {
    const s = Math.sqrt(1 + M[2][2] - M[0][0] - M[1][1]) * 2
    q = [(M[0][2] + M[2][0]) / s, (M[1][2] + M[2][1]) / s, s / 4, (M[1][0] - M[0][1]) / s]
  }
  return q
}
function matrix([x, y, z, w]) {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ]
}
function slerp(A, B, t) {
  const a = quat(A)
  let b = quat(B)
  let c = dot(a, b)
  if (c < 0) {
    b = scale(b, -1)
    c = -c
  }
  if (c > 0.9995) return matrix(norm(lerp(a, b, t)))
  const th = Math.acos(c)
  const s = Math.sin(th)
  return matrix(add(scale(a, Math.sin((1 - t) * th) / s), scale(b, Math.sin(t * th) / s)))
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t) => 1 - (1 - t) ** 3
/** Частка проходу між кадрами a і b (з кривою). */
const phase = (f, a, b, ease = easeInOut) => ease(Math.min(Math.max((f - a) / (b - a), 0), 1))

// ——— Камера ————————————————————————————————————————————————————
/**
 * Камера з перспективою: ближче (z більше) — більше. Біля щілини дивиться
 * трохи згори (VIEW_TILT) — видно, як вушко лягає плазом; у спокої —
 * рівно, без нахилу (власник: ключ має стояти рівно, у профіль).
 */
const CAM_D = 420
const VIEW_TILT = Rx(-14)
const IDENTITY = Rx(0)
let VIEW = IDENTITY
const UNIT = 1.26 // одиниць моделі на піксель у центрі кадру

// ——— Модель ключа (свої координати: x — від кінчика до вушка) ————
const T = 22 // товщина — масивний ключ, видно торець
/**
 * Лезо разом із зубцями — ОДНА пластина (профіль): зубці — продовження
 * леза, а не бруски під ним (окремими вони «лізли за ключ»).
 */
const BLADE = [
  [0, -14],
  [112, -14],
  [112, 14],
  [52, 14],
  [52, 27],
  [32, 27],
  [32, 14],
  [22, 14],
  [22, 35],
  [0, 35],
]
const COLLAR = { x0: 106, x1: 122, y0: -21, y1: 21, t: T + 6 }
const BOW = { c: [172, 0], r: 56, t: T }
const EYE = { c: [188, -17], r: 19 }
/**
 * Вісь ключа — посередині ПЕРЕРІЗУ леза із зубцями (y −14…35 → 10,5), а не
 * по стрижню: уздовж неї ключ заходить у щілину й навколо неї
 * провертається, тож переріз лишається в темній дірці й не налазить на
 * золотий обідок (власник: «заходить за бордер»).
 */
const KEY_MID = [116, 10.5, 0]

// ——— Пози ——————————————————————————————————————————————————————
/** Спокій: ключ рівно дивиться на нас, навскоси (вушко вгорі праворуч). */
const R_REST = Rz(-45)
/** Вісь ключа в щілині: праворуч і трохи до камери; зубці — донизу. */
const PHI = 26
const AXIS = norm([Math.cos(rad(PHI)), 0, Math.sin(rad(PHI))])
const R_ALIGN = fromAxes(AXIS, [0, 1, 0], cross(AXIS, [0, 1, 0]))
/** Щілина (центр передньої грані оправи) — у світі. */
const HOLE = [-70, 22, -60]
/**
 * Оправа й темна дірка в ній. Переріз ключа (49 × 22 навколо осі) з
 * обвідкою — ~30 від осі в будь-якому повороті: дірка 32 — із запасом,
 * золотий обідок (32…46) лишається рівним колом.
 */
const PLATE_R = 46
const HOLE_R = 32
/** Скільки кінчик перед щілиною перед заходом і наскільки заходить. */
const APPROACH = -18
const DEPTH = 94

// Хронологія (кадри при 60 к/с):
// 0–12   «вдих»;        12–36  до щілини, збоку; щілина проявляється (16–33);
// 36–56  заходить;      58–76  провертається, кільце (58–100);
// 82–100 назад;         102–122 виходить; щілина гасне (112–126);
// 122–150 навскоси, як на початку.
function keyPose(f) {
  // Орієнтація.
  const toAlign = phase(f, 12, 36) * (1 - phase(f, 122, 150))
  let R = slerp(R_REST, R_ALIGN, toAlign)
  const breath = Math.sin(Math.PI * phase(f, 0, 24, (t) => t)) * 1
  R = mul(R, Rz(-5 * breath * (1 - toAlign)))
  const roll = 90 * (phase(f, 58, 76) - phase(f, 82, 100))
  // Вушко лягає гранню ДОГОРИ — до камери, що дивиться трохи згори: так
  // воно ніколи не стає до нас ребром (інакше «паличка» посередині).
  R = mul(R, Rx(roll))
  // Наскільки кінчик за площиною оправи (відʼємне — ще перед нею).
  const s = APPROACH + (DEPTH - APPROACH) * (phase(f, 36, 56) - phase(f, 102, 122))
  // Положення: середина ключа у спокої — в (0, 0, 0); у щілині — на осі.
  const midRest = [0, 0, 0]
  const midAlign = add(HOLE, scale(AXIS, KEY_MID[0] - s))
  const mid = lerp(midRest, midAlign, toAlign)
  const size = 1 - 0.04 * breath
  return { R, mid, s, size, align: toAlign, roll }
}

/** Точка моделі ключа → світ. */
const keyToWorld = (pose) => (v) => add(pose.mid, scale(apply(pose.R, sub(v, KEY_MID)), pose.size))
/** Світ → екран (без зсуву «камери»). */
function project(p) {
  const q = apply(VIEW, p)
  const k = CAM_D / (CAM_D - q[2])
  return [q[0] * k * UNIT, q[1] * k * UNIT]
}
const toCamera = (p) => apply(VIEW, p)
const CAMERA = [0, 0, CAM_D]
/** Чи видно грань із нормаллю n у точці p (світ). */
const facing = (p, n) => dot(apply(VIEW, n), sub(CAMERA, toCamera(p))) > 0

// ——— Геометрія ——————————————————————————————————————————————————
/** Гладкий контур через точки кривої: дотичні — з похідної кривої. */
function curveShape(fn, from, to, n, closed) {
  const count = closed ? n : n + 1
  const step = (to - from) / n
  const v = []
  const i = []
  const o = []
  for (let k = 0; k < count; k++) {
    const t = from + k * step
    const p = fn(t)
    // Дуга нульової довжини (вушко дивиться прямо в камеру — одна з дуг
    // обвідки стягується в точку): step = 0, і 0/0 дало б NaN → null у
    // JSON. Lottie в браузері це ковтає, а iOS не читає файл узагалі.
    const e = Math.abs(step) > 1e-9 ? step * 0.01 : 1e-4
    const d = scale(sub(fn(t + e), fn(t - e)), 1 / (2 * e))
    const h = scale(d, step / 3)
    v.push(p)
    i.push(scale(h, -1))
    o.push(h)
  }
  if (!closed) {
    i[0] = [0, 0]
    o[count - 1] = [0, 0]
  }
  return { v, i, o, c: closed }
}
const poly = (pts) => ({ v: pts, i: pts.map(() => [0, 0]), o: pts.map(() => [0, 0]), c: true })
/** Невидима грань: усі вершини в одній точці (кількість вершин та сама). */
const collapsed = (n, at) => poly(Array.from({ length: n }, () => at))

/**
 * Пластина: 6 граней (по 4 вершини). Видимі — свої, невидимі — точкою.
 * `clip` — обрізати по x (те, що вже в щілині).
 */
function slab(toWorld, { x0, x1, y0, y1, t }, clip = -Infinity) {
  const a = Math.max(x0, clip)
  const gone = a >= x1
  const b = gone ? a : x1
  const z0 = -t / 2
  const z1 = t / 2
  const P = (x, y, z) => toWorld([x, y, z])
  const c = (x, y, z) => P(x, y, z)
  const faces = [
    { nm: 'front', n: [0, 0, 1], pts: [c(a, y0, z1), c(b, y0, z1), c(b, y1, z1), c(a, y1, z1)], kind: 'face' },
    { nm: 'back', n: [0, 0, -1], pts: [c(a, y0, z0), c(a, y1, z0), c(b, y1, z0), c(b, y0, z0)], kind: 'face' },
    { nm: 'top', n: [0, -1, 0], pts: [c(a, y0, z0), c(b, y0, z0), c(b, y0, z1), c(a, y0, z1)], kind: 'side' },
    { nm: 'bottom', n: [0, 1, 0], pts: [c(a, y1, z1), c(b, y1, z1), c(b, y1, z0), c(a, y1, z0)], kind: 'side' },
    { nm: 'end', n: [-1, 0, 0], pts: [c(a, y0, z0), c(a, y0, z1), c(a, y1, z1), c(a, y1, z0)], kind: 'side' },
    { nm: 'root', n: [1, 0, 0], pts: [c(b, y0, z1), c(b, y0, z0), c(b, y1, z0), c(b, y1, z1)], kind: 'side' },
  ]
  return faces.map((fc) => {
    const center = scale(fc.pts.reduce(add), 1 / 4)
    const worldN = sub(toWorld([1, 0, 0].map((_, i) => fc.n[i] + KEY_MID[i])), toWorld(KEY_MID))
    const seen = !gone && facing(center, worldN)
    const scr = fc.pts.map(project)
    const mid = scale(scr.reduce(add), 1 / 4)
    return { nm: fc.nm, kind: fc.kind, shape: seen ? poly(scr) : collapsed(4, mid), mid, span: seen ? spanOf(scr) : 1 }
  })
}
const spanOf = (pts) => {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 1
}

/**
 * Диск (вушко, оправа): коло радіуса r у площині (C, U, V), товщина —
 * уздовж N на t (назад). Обрис — дві дуги граней і дві дотичні
 * (видимі ребра циліндра), завжди однаково вершин. `prev` — кут дотику з
 * минулого кадру, щоб вершини не перескакували.
 */
/**
 * Пластина довільного профілю (лезо з зубцями): грань — увесь профіль,
 * бічні стінки — по одній на ребро (видимі — свої, невидимі — точкою).
 * `clip` — те, що вже в щілині (x < clip), сховане: вершини притиснуті до
 * площини оправи (профіль прямокутний — це й є обрізка).
 */
function prism(toWorld, profile, t, clip = -Infinity) {
  // Переріз профілю площиною x = clip: від найнижчої до найвищої точки
  // перетину. Вершина, що вже в щілині, лягає на площину В МЕЖАХ перерізу —
  // інакше від неї тягнувся «хвіст» уздовж площини поза ключем.
  const ys = []
  profile.forEach((p, i) => {
    const q = profile[(i + 1) % profile.length]
    if (p[0] === q[0]) return
    const k = (clip - p[0]) / (q[0] - p[0])
    if (k >= 0 && k <= 1) ys.push(p[1] + k * (q[1] - p[1]))
  })
  const lo = ys.length ? Math.min(...ys) : 0
  const hi = ys.length ? Math.max(...ys) : 0
  const inside = profile.map(([x]) => x >= clip)
  const pts = profile.map(([x, y], i) => (inside[i] ? [x, y] : [clip, Math.min(Math.max(y, lo), hi)]))
  const front = pts.map(([x, y]) => toWorld([x, y, t / 2]))
  const back = pts.map(([x, y]) => toWorld([x, y, -t / 2]))
  const origin = toWorld([0, 0, 0])
  const worldDir = (v) => sub(toWorld(v), origin)
  const zN = worldDir([0, 0, 1])
  const seenFront = facing(front[0], zN)
  const faceScr = (seenFront ? front : back).map(project)
  // Знак площі профілю — щоб нормалі ребер дивились назовні.
  const area = pts.reduce((a, p, i) => a + (p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1]), 0)
  const sides = pts.map((p, i) => {
    const j = (i + 1) % pts.length
    const e = sub(pts[j], p)
    const n2 = area > 0 ? [e[1], -e[0]] : [-e[1], e[0]]
    const quad = [front[i], front[j], back[j], back[i]]
    const center = scale(quad.reduce(add), 1 / 4)
    const len = Math.hypot(...e)
    // Стінка, що вся вже в щілині, — притиснута до площини оправи: це не
    // ключ, а «латка» на оправі (власник: «вилазить фігня на бордер»).
    const buried = !inside[i] && !inside[j]
    const seen = !buried && len > 0.01 && facing(center, worldDir([n2[0], n2[1], 0]))
    const scr = quad.map(project)
    const mid = scale(scr.reduce(add), 1 / 4)
    return { nm: `side ${i}`, kind: 'side', shape: seen ? poly(scr) : collapsed(4, mid), mid, span: seen ? spanOf(scr) : 1 }
  })
  return { face: poly(faceScr), mid: scale(faceScr.reduce(add), 1 / faceScr.length), span: spanOf(faceScr), sides }
}

/**
 * Перетин двох однакових кіл (передня й задня дірочка), спроєктованих на
 * екран, — як еліпс-лінза: центр посередині, уздовж зсуву вужча на
 * половину зсуву. Зсув ≥ діаметра — порожньо (точка).
 */
const LENS_N = 12
function lens(ringA, ringB) {
  const P1 = ringA(0)
  const C1 = scale(add(ringA(0), ringA(Math.PI)), 0.5)
  const C2 = scale(add(ringB(0), ringB(Math.PI)), 0.5)
  const U = sub(P1, C1)
  const V = sub(ringA(Math.PI / 2), C1)
  const d = sub(C2, C1)
  const det = U[0] * V[1] - U[1] * V[0]
  const a = Math.abs(det) < 1e-6 ? 0 : (d[0] * V[1] - d[1] * V[0]) / det
  const b = Math.abs(det) < 1e-6 ? 0 : (U[0] * d[1] - U[1] * d[0]) / det
  // У площині дірочки (одиничні кола в 0 і в (a, b)) — промені з середини
  // перетину під СТАЛИМИ кутами θ: вершина k щокадру на тому самому
  // напрямку. (Еліпс, повернутий уздовж зсуву, крутив вершини між кадрами,
  // коли зсув майже нуль, — морф перекручувався, дірочка «мелькала».)
  const m = [a / 2, b / 2]
  const reach = (w, c) => {
    const mc = sub(m, c)
    const bw = dot(w, mc)
    const disc = bw * bw - dot(mc, mc) + 1
    return disc > 0 ? Math.max(0, -bw + Math.sqrt(disc)) : 0
  }
  const empty = Math.hypot(a, b) >= 2
  const at = (x, y) => add(C1, add(scale(U, x), scale(V, y)))
  const v = []
  for (let k = 0; k < LENS_N; k++) {
    const th = (2 * Math.PI * k) / LENS_N
    const w = [Math.cos(th), Math.sin(th)]
    const rho = empty ? 0 : Math.min(reach(w, [0, 0]), reach(w, [a, b]))
    v.push(at(m[0] + w[0] * rho, m[1] + w[1] * rho))
  }
  // Кутики лінзи гострі — дотичні з сусідніх вершин, коротші (без петель).
  const i = []
  const o = []
  v.forEach((p, k) => {
    const prev = v[(k + LENS_N - 1) % LENS_N]
    const next = v[(k + 1) % LENS_N]
    const h = scale(sub(next, prev), 1 / 6)
    i.push(scale(h, -1))
    o.push(h)
  })
  return { v, i, o, c: true }
}

const DISC_N = 12
function disc({ C, U, V, N, r, t }, prev) {
  const front = C
  const back = sub(C, scale(N, t))
  const ring = (base) => (th) => project(add(base, add(scale(U, r * Math.cos(th)), scale(V, r * Math.sin(th)))))
  const seenFront = facing(front, N)
  const face = seenFront ? front : back
  // Ребра-дотичні: де бічна стінка дивиться повз камеру.
  const mid = scale(add(front, back), 0.5)
  const w = sub(toCamera(mid), CAMERA)
  const Uc = apply(VIEW, U)
  const Vc = apply(VIEW, V)
  const A = dot(Uc, w)
  const B = dot(Vc, w)
  const R0 = Math.hypot(A, B)
  const base = Math.atan2(B, A)
  const off = Math.acos(Math.max(-1, Math.min(1, -r / R0)))
  let t1 = base - off
  if (prev !== undefined) {
    while (t1 - prev > Math.PI) t1 -= 2 * Math.PI
    while (prev - t1 > Math.PI) t1 += 2 * Math.PI
  }
  const span = 2 * off
  const half = DISC_N / 2
  // Дві можливі обвідки — беремо ширшу (вона й обіймає обидві грані).
  const make = (onFront) => {
    const arcA = curveShape(ring(onFront ? front : back), t1, t1 + span, half, false)
    const arcB = curveShape(ring(onFront ? back : front), t1 + span, t1 + 2 * Math.PI, half, false)
    return { v: [...arcA.v, ...arcB.v], i: [...arcA.i, ...arcB.i], o: [...arcA.o, ...arcB.o], c: true }
  }
  const area = (s) => Math.abs(s.v.reduce((acc, p, k) => acc + (p[0] * s.v[(k + 1) % s.v.length][1] - s.v[(k + 1) % s.v.length][0] * p[1]), 0))
  const h1 = make(true)
  const h2 = make(false)
  const hull = area(h1) >= area(h2) ? h1 : h2
  return {
    face: curveShape(ring(face), 0, 2 * Math.PI, DISC_N, true),
    hull,
    t1,
    center: project(face),
    span: spanOf(curveShape(ring(face), 0, 2 * Math.PI, 8, true).v),
    seenFront,
    ring,
    front,
    back,
  }
}

// ——— Кадри ————————————————————————————————————————————————————
const samples = []
for (let f = 0; f <= OP; f += STEP) samples.push(f)
if (samples[samples.length - 1] !== OP) samples.push(OP)

let bowT
let plateT
const raw = samples.map((f) => {
  const pose = keyPose(f)
  VIEW = slerp(IDENTITY, VIEW_TILT, pose.align)
  const toW = keyToWorld(pose)
  // Частина в щілині — схована: лезо обрізане площиною оправи (x < s).
  const clip = pose.align > 0.999 ? pose.s : -Infinity
  const blade = prism(toW, BLADE, T, clip)
  const collar = slab(toW, COLLAR)

  // Вушко — диск у площині ключа.
  const dirX = norm(sub(toW([1, 0, 0]), toW([0, 0, 0])))
  const dirY = norm(sub(toW([0, 1, 0]), toW([0, 0, 0])))
  const dirZ = norm(sub(toW([0, 0, 1]), toW([0, 0, 0])))
  const k = pose.size
  const bowC = toW([BOW.c[0], BOW.c[1], T / 2])
  const bow = disc({ C: bowC, U: dirX, V: dirY, N: dirZ, r: BOW.r * k, t: BOW.t * k }, bowT)
  bowT = bow.t1
  const eyeC = toW([EYE.c[0], EYE.c[1], T / 2])
  const eyeRing = (base) => (th) => project(add(base, add(scale(dirX, EYE.r * k * Math.cos(th)), scale(dirY, EYE.r * k * Math.sin(th)))))
  const eyeFace = bow.seenFront ? eyeC : sub(eyeC, scale(dirZ, BOW.t * k))
  const eyeOther = bow.seenFront ? sub(eyeC, scale(dirZ, BOW.t * k)) : eyeC
  const eyeFront = curveShape(eyeRing(eyeFace), 0, 2 * Math.PI, 8, true)
  // Наскрізь видно лише там, де передня й задня дірочки перекриваються
  // (лінза); коли вушко ребром — ніде, стінка суцільна (власник: «бокова
  // грань пуста, видно верх і низ дірки»).
  const eyeBack = lens(eyeRing(eyeFace), eyeRing(eyeOther))
  // Блик на вушку: дуга вгорі зліва.
  const shine = curveShape((th) => project(add(bow.seenFront ? bow.front : bow.back, add(scale(dirX, BOW.r * k * 0.78 * Math.cos(th)), scale(dirY, BOW.r * k * 0.78 * Math.sin(th))))), rad(195), rad(255), 3, false)
  // Блик уздовж стрижня (верх передньої грані).
  const shaftShine = poly([project(toW([Math.max(10, clip + 4), -6, T / 2 + 0.5])), project(toW([100, -6, T / 2 + 0.5]))])
  shaftShine.c = false

  // Щілина: диск-оправа поперек осі.
  const hs = Math.max(phase(f, 16, 33, easeOut) * (1 - phase(f, 112, 126)), 0.001)
  const pU = [0, 1, 0]
  const pV = norm(cross(AXIS, pU))
  const plate = disc({ C: HOLE, U: pV, V: pU, N: AXIS, r: PLATE_R * hs, t: 12 * hs }, plateT)
  plateT = plate.t1
  const inPlane = (r) => (th) => project(add(HOLE, add(scale(pV, r * Math.cos(th)), scale(pU, r * Math.sin(th)))))
  const inner = curveShape(inPlane(HOLE_R * hs), 0, 2 * Math.PI, 12, true)
  // Прорізь — у циліндрі замка: провертається разом із ключем (той самий
  // кут), тож завжди під перерізом ключа й не визирає з-під нього.
  // Поки ключ у замку, прорізь лише визирала б збоку від нього — ховаємо
  // (стягується під переріз), а коли ключ виходить, — знову.
  const turn = rad(pose.roll)
  const slot = hs * (1 - phase(f, 38, 46) + phase(f, 110, 118))
  const at = (x, y) => {
    const yy = y * Math.cos(turn) - x * Math.sin(turn)
    const xx = y * Math.sin(turn) + x * Math.cos(turn)
    return project(add(HOLE, add(scale(pV, xx * slot), scale(pU, yy * slot))))
  }
  const slotHead = curveShape((th) => at(9 * Math.cos(th), -11 + 9 * Math.sin(th)), 0, 2 * Math.PI, 8, true)
  const slotFoot = poly([at(-4, -5), at(4, -5), at(8, 19), at(-8, 19)])

  // Кільце: коло в площині оправи, росте й тоншає.
  const rp = phase(f, 58, 100, (t) => t)
  const ring = curveShape(inPlane(PLATE_R * (1 + 1.15 * easeOut(rp))), 0, 2 * Math.PI, 12, true)
  const ringW = rp > 0 && rp < 1 ? 24 * (1 - easeOut(rp)) : 0

  // Рамка видимого — для «камери».
  const pts = [...bow.hull.v, ...blade.face.v, ...collar.flatMap((fc) => fc.shape.v), ...(hs > 0.3 ? plate.hull.v : [])]
  return { f, blade, collar, bow, eyeFront, eyeBack, shine, shaftShine, plate, inner, slotHead, slotFoot, ring, ringW, box: pts }
})

// «Камера»: тримає видиме посередині кадру — плавно (згладжена рамка).
const centers = raw.map((g) => {
  const xs = g.box.map((p) => p[0])
  const ys = g.box.map((p) => p[1])
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
})
const smooth = centers.map((_, i) => {
  const near = centers.slice(Math.max(0, i - 3), i + 4)
  return scale(near.reduce(add), 1 / near.length)
})
// Початок і кінець — рівно по центру кадру (той самий ключ).
const restC = centers[0]
const offsets = smooth.map((c, i) => {
  const f = raw[i].f
  const w = phase(f, 6, 30) * (1 - phase(f, 128, 152))
  return sub([W / 2, H / 2], lerp(restC, c, w))
})

// Зсунути все на «камеру».
function shift(shape, d) {
  return { ...shape, v: shape.v.map((p) => add(p, d)) }
}
const geo = raw.map((g, i) => {
  const d = offsets[i]
  const mv = (s) => shift(s, d)
  const slabMv = (fs) => fs.map((fc) => ({ ...fc, shape: mv(fc.shape), mid: add(fc.mid, d) }))
  return {
    f: g.f,
    bladeFace: mv(g.blade.face),
    bladeFaceMid: add(g.blade.mid, d),
    bladeSpan: g.blade.span,
    bladeSides: slabMv(g.blade.sides),
    collar: slabMv(g.collar),
    bowFace: mv(g.bow.face),
    bowHull: mv(g.bow.hull),
    bowC: add(g.bow.center, d),
    bowSpan: g.bow.span,
    eyeFront: mv(g.eyeFront),
    eyeBack: mv(g.eyeBack),
    shine: mv(g.shine),
    shaftShine: mv(g.shaftShine),
    plateFace: mv(g.plate.face),
    plateHull: mv(g.plate.hull),
    plateC: add(g.plate.center, d),
    plateSpan: g.plate.span,
    inner: mv(g.inner),
    slotHead: mv(g.slotHead),
    slotFoot: mv(g.slotFoot),
    ring: mv(g.ring),
    ringW: g.ringW,
  }
})

// ——— Lottie ————————————————————————————————————————————————————
const r1 = (x) => Math.round(x)
const roundShape = (s) => ({ v: s.v.map((p) => p.map(r1)), i: s.i.map((p) => p.map(r1)), o: s.o.map((p) => p.map(r1)), c: s.c })

function inRange(range) {
  if (!range) return geo
  const [a, b] = range
  const inside = geo.filter((g) => g.f >= a && g.f <= b)
  const before = geo.filter((g) => g.f < a).pop()
  const after = geo.find((g) => g.f > b)
  return [before, ...inside, after].filter(Boolean)
}
function animShape(nm, pick, range) {
  const list = inRange(range)
  return {
    ty: 'sh',
    nm,
    ks: {
      a: 1,
      k: list.map((g, idx) => {
        const s = [roundShape(pick(g))]
        if (idx === list.length - 1) return { t: g.f, s }
        return { t: g.f, s, i: { x: 1, y: 1 }, o: { x: 0, y: 0 } }
      }),
    },
  }
}
function animValue(pick, range) {
  const list = inRange(range)
  return {
    a: 1,
    k: list.map((g, idx) => {
      const v = pick(g)
      const s = Array.isArray(v) ? v.map(r1) : [r1(v)]
      if (idx === list.length - 1) return { t: g.f, s }
      const n = s.length
      return { t: g.f, s, i: { x: Array(n).fill(1), y: Array(n).fill(1) }, o: { x: Array(n).fill(0), y: Array(n).fill(0) } }
    }),
  }
}
const solid = (hex) => ({ ty: 'fl', c: K(rgb(hex)), o: K(100), r: 1 })
const line = (hex, w, o = 100) => ({ ty: 'st', c: K(rgb(hex)), o: K(o), w: typeof w === 'number' ? K(w) : w, lc: 2, lj: 2, ml: 4 })
function grad(stops, pick, rule = 1, range) {
  return {
    ty: 'gf',
    o: K(100),
    r: rule,
    bm: 0,
    g: { p: stops.length, k: K(stops.flatMap(([at, hex]) => [at, ...rgb(hex).slice(0, 3)])) },
    s: animValue((g) => {
      const { c, span } = pick(g)
      return [c[0] - span * 0.75, c[1] - span * 0.75]
    }, range),
    e: animValue((g) => {
      const { c, span } = pick(g)
      return [c[0] + span * 0.75, c[1] + span * 0.75]
    }, range),
    t: 1,
  }
}
const tr = () => ({ ty: 'tr', p: K([0, 0]), a: K([0, 0]), s: K([100, 100]), r: K(0), o: K(100), sk: K(0), sa: K(0) })
const gr = (nm, items) => ({ ty: 'gr', nm, it: [...items, tr()] })
function layer(nm, shapes, { ip = 0, op = OP } = {}) {
  return { ddd: 0, ty: 4, nm, sr: 1, ks: { o: K(100), r: K(0), p: K([0, 0, 0]), a: K([0, 0, 0]), s: K([100, 100, 100]) }, ao: 0, shapes, ip, op, st: 0, bm: 0 }
}

/**
 * Грані пластини: кожна — своя група, заливка над обвідкою (видно лише
 * зовнішню половину обвідки — темний край і лінії між гранями).
 * Грані, яких не видно за весь час, — не пишемо.
 */
function slabGroups(nm, pick) {
  const names = ['front', 'back', 'top', 'bottom', 'end', 'root']
  return names
    .map((fn, idx) => {
      const ever = geo.some((g) => pick(g)[idx].span > 1)
      if (!ever) return null
      const kind = pick(geo[0])[idx].kind
      return gr(`${nm} ${fn}`, [
        animShape(fn, (g) => pick(g)[idx].shape),
        grad(kind === 'face' ? FACE : SIDE, (g) => ({ c: pick(g)[idx].mid, span: Math.max(pick(g)[idx].span, 4) })),
        line(OUTLINE, 7),
      ])
    })
    .filter(Boolean)
}

/** Бічні стінки леза: під гранню; яких не видно за весь час — не пишемо. */
function bladeSideGroups() {
  return BLADE.map((_, idx) => {
    const ever = geo.some((g) => g.bladeSides[idx].span > 1)
    if (!ever) return null
    return gr(`blade side ${idx}`, [
      animShape('side', (g) => g.bladeSides[idx].shape),
      grad(SIDE, (g) => ({ c: g.bladeSides[idx].mid, span: Math.max(g.bladeSides[idx].span, 4) })),
      line(OUTLINE, 7),
    ])
  }).filter(Boolean)
}

// Ключ (згори вниз): блики, вушко (грань над стінкою), комірець, лезо (грань над стінками).
const keyLayer = layer('key', [
  gr('bow shine', [animShape('arc', (g) => g.shine), line(SHINE, 6, 75)]),
  gr('bow face', [animShape('outer', (g) => g.bowFace), animShape('eye', (g) => g.eyeFront), grad(FACE, (g) => ({ c: g.bowC, span: g.bowSpan }), 2), line(OUTLINE, 6)]),
  gr('bow side', [animShape('hull', (g) => g.bowHull), animShape('eye back', (g) => g.eyeBack), grad(SIDE, (g) => ({ c: g.bowC, span: g.bowSpan }), 2), line(OUTLINE, 12)]),
  ...slabGroups('collar', (g) => g.collar),
  gr('blade shine', [animShape('shine', (g) => g.shaftShine), line(SHINE, 4, 70)]),
  gr('blade face', [animShape('face', (g) => g.bladeFace), grad(FACE, (g) => ({ c: g.bladeFaceMid, span: g.bladeSpan })), line(OUTLINE, 7)]),
  ...bladeSideGroups(),
])

// Щілина: силует, глибина, оправа.
const HOLE_RANGE = [14, 128]
const RING_RANGE = [58, 101]
const holeLayer = layer(
  'keyhole',
  [
    gr('slot', [animShape('head', (g) => g.slotHead, HOLE_RANGE), animShape('foot', (g) => g.slotFoot, HOLE_RANGE), solid(SLOT)]),
    gr('inner', [animShape('inner', (g) => g.inner, HOLE_RANGE), grad(HOLE_DARK, (g) => ({ c: g.plateC, span: g.plateSpan * 0.6 }), 1, HOLE_RANGE)]),
    gr('face', [animShape('face', (g) => g.plateFace, HOLE_RANGE), grad(FACE, (g) => ({ c: g.plateC, span: g.plateSpan }), 1, HOLE_RANGE), line(OUTLINE, 6)]),
    gr('side', [animShape('hull', (g) => g.plateHull, HOLE_RANGE), grad(SIDE, (g) => ({ c: g.plateC, span: g.plateSpan }), 1, HOLE_RANGE), line(OUTLINE, 12)]),
  ],
  { ip: HOLE_RANGE[0], op: HOLE_RANGE[1] },
)

// Кільце: колір міняє застосунок (colorFilters, шар «ring»): біле в темній
// темі, золоте — у світлій.
const ringLayer = layer('ring', [gr('ring', [animShape('ring', (g) => g.ring, RING_RANGE), line('#ffffff', animValue((g) => g.ringW, RING_RANGE))])], {
  ip: RING_RANGE[0],
  op: RING_RANGE[1],
})

function animation() {
  // Ключ над щілиною (те, що вже в ній, обрізане), кільце — під ключем.
  const layers = [keyLayer, ringLayer, holeLayer].map((l, i) => ({ ...l, ind: i + 1 }))
  return { v: '5.9.6', fr: FR, ip: 0, op: OP, w: W, h: H, nm: 'key', ddd: 0, assets: [], layers, markers: [] }
}

// NaN/Infinity у JSON стають null: Lottie в браузері їх мовчки ковтає, а
// iOS відкидає ВЕСЬ файл — і перевикористаний нативний вид показує те, що
// в ньому було до того (знак Zunor замість ключа). Тож — не записуємо.
const json = JSON.stringify(animation(), (k, v) => {
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`key.json: ${v} у «${k}»`)
  return v
})
const file = join(outDir, 'key.json')
writeFileSync(file, json)
console.log('→', file, `${samples.length} ключових кадрів`)
