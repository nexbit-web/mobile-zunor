// «Безпека» в налаштуваннях (settings/padlock-art.tsx): навісний замок і
// ключ. Ключ підлітає до щілини, заходить, тричі пробує провернути (третій
// раз — щосили), дужка щоразу смикається й тримає; ключ виходить і
// відходить, біля дужки спалахують іскорки — замок надійний. Петля 6 с.
//
// Малюнок — плаский, але «зроблений»: градієнти, тонка обвідка в тон
// (не чорна), сталева дужка з бликом і тінню, накладка навколо щілини,
// золотий ключ із бородкою. Рух — лише перетвореннями шарів (жодних
// морфів), тож файл легкий. Рівно, без пружин.
//
// Запуск — вручну:  node scripts/animations/padlock.mjs [тека]
// Результат — assets/animations/padlock.json, комітиться.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { A, K, Path, el, fill, group, rc, rgb, shapeLayer, smooth, star, stroke, twinkle } from '../mascot/lottie-kit.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = process.argv[2] ?? join(here, '..', '..', 'assets', 'animations')

const FR = 60
const OP = 360 // 6 с, петля
const W = 400
const H = 320

// ——— Кольори ——————————————————————————————————————————————————
const BODY = [
  [0, '#5c9dff'],
  [0.45, '#2f7af0'],
  [1, '#1b58c9'],
]
const BODY_LINE = '#0d3580'
const PLATE = [
  [0, '#ffffff'],
  [1, '#c3ccd9'],
]
const KEYHOLE = '#0c1d44'
const STEEL = '#d3d9e2'
const STEEL_LINE = '#56606e'
const STEEL_SHADE = '#a7b1bf'
const GOLD = [
  [0, '#ffe57a'],
  [0.5, '#fbc52c'],
  [1, '#e39b12'],
]
const GOLD_LINE = '#8a5200'
const SPARK = '#ffc53d'

// ——— Розмітка (пікселі полотна) ————————————————————————————————
const CX = 200
/** Корпус. */
const BODY_BOX = { x0: 116, x1: 284, y0: 156, y1: 286, r: 28 }
/** Щілина — посередині корпусу, трохи вище центру. */
const HOLE = [CX, 214]
/** Дужка: ноги й центр дуги. */
const SHACKLE = { left: 152, right: 248, cy: 110, bottom: 178, tube: 24, line: 5 }

/** Статичний лінійний градієнт від s до e. `r` 2 — парно-непарна заливка. */
function gradient(stops, s, e, r = 1) {
  return {
    ty: 'gf',
    o: K(100),
    r,
    bm: 0,
    g: { p: stops.length, k: K(stops.flatMap(([at, hex]) => [at, ...rgb(hex).slice(0, 3)])) },
    s: K(s),
    e: K(e),
    t: 1,
  }
}

// ——— Дужка ————————————————————————————————————————————————————
/** U-подібна трубка радіуса r навколо центру дуги; ноги — до `bottom`. */
function arch(r, { from = 'left', to = 'right', bottom = SHACKLE.bottom } = {}) {
  const { cy } = SHACKLE
  const lx = CX - r
  const rx = CX + r
  const p = new Path()
  if (from === 'left') p.move(lx, bottom).line(lx, cy)
  else p.move(CX, cy - r)
  if (from === 'left') p.quarter(CX, cy - r, lx, cy - r)
  if (to === 'right') p.quarter(rx, cy, rx, cy - r).line(rx, bottom)
  return p.shape()
}
const halfSpan = (SHACKLE.right - SHACKLE.left) / 2
/** Кадри, коли ключ пробує провернути: [початок, вершина, кінець, сила 0…1]. */
const TRIES = [
  [117, 123, 131, 0.65],
  [141, 147, 155, 0.65],
  [170, 178, 190, 1],
]
/** Ривок: швидко вгору (без перельоту) і рівно назад. */
function jolt(rest, peak) {
  const keys = [[0, rest]]
  for (const [a, top, b, k] of TRIES) {
    keys.push([a, rest, 'out'], [top, peak(k)], [b, rest])
  }
  keys.push([OP, rest])
  return A(keys)
}
const shackleLayer = shapeLayer(
  'shackle',
  [
    // Блик — по зовнішньому краю лівої ноги й дуги; тінь — по внутрішньому
    // краю правої. Обидва — вужчі за трубку, всередині неї.
    group('shine', [arch(halfSpan + 6, { to: 'none' }), stroke('#ffffff', 5, 75)]),
    group('shade', [arch(halfSpan - 6, { from: 'top' }), stroke(STEEL_SHADE, 5)]),
    group('tube', [arch(halfSpan), stroke(STEEL, SHACKLE.tube)]),
    group('outline', [arch(halfSpan), stroke(STEEL_LINE, SHACKLE.tube + SHACKLE.line * 2)]),
  ],
  { p: jolt([0, 0], (k) => [0, -5 - 4 * k]), op: OP },
)

// ——— Корпус ————————————————————————————————————————————————————
const { x0, x1, y0, y1, r: br } = BODY_BOX
const bw = x1 - x0
const bh = y1 - y0
const keyholeShape = () => [
  el(HOLE[0], HOLE[1] - 4, 17),
  smooth(
    [
      [HOLE[0] - 4, HOLE[1]],
      [HOLE[0] + 4, HOLE[1]],
      [HOLE[0] + 7, HOLE[1] + 20],
      [HOLE[0] - 7, HOLE[1] + 20],
    ],
    { sharp: [0, 1, 2, 3] },
  ).shape(),
]
const bodyLayer = shapeLayer(
  'body',
  [
    // Щілина й накладка навколо неї.
    group('keyhole', [...keyholeShape(), fill(KEYHOLE)]),
    group('plate', [el(HOLE[0], HOLE[1] + 4, 52), stroke(BODY_LINE, 4), gradient(PLATE, [HOLE[0] - 20, HOLE[1] - 22], [HOLE[0] + 20, HOLE[1] + 30])]),
    // Блики: смужка зліва й світлий кант під верхом.
    group('shine', [rc(x0 + 20, y0 + bh / 2 + 6, 9, bh - 52, 4.5), fill('#ffffff', 32)]),
    group('rim', [rc(CX, y0 + 9, bw - 36, 6, 3), fill('#ffffff', 26)]),
    // Нижній край — темніший (обʼєм), під заливкою корпусу не видно.
    group('body', [rc(CX, (y0 + y1) / 2, bw, bh, br), stroke(BODY_LINE, 5), gradient(BODY, [CX, y0], [CX, y1])]),
  ],
  // Третя, сильна спроба — корпус ледь осідає разом із ривком дужки.
  { p: A([[0, [0, 0]], [170, [0, 0], 'out'], [178, [0, 2]], [190, [0, 0]], [OP, [0, 0]]]), op: OP },
)

// ——— Ключ ————————————————————————————————————————————————————
// Свої координати: кінчик — у (0, 0), ключ тягнеться ліворуч, зубці внизу.
const BOW = { c: [-104, 0], r: 25, hole: 8.5 }
const blade = () =>
  smooth(
    [
      [-80, -5],
      [-3, -5],
      [1, 0],
      [-3, 5],
      [-10, 5],
      [-10, 13],
      [-17, 13],
      [-17, 9],
      [-23, 9],
      [-23, 13],
      [-30, 13],
      [-30, 5],
      [-80, 5],
    ],
    { sharp: Array.from({ length: 13 }, (_, i) => i) },
  ).shape()
const bowShine = () => {
  const [cx, cy] = BOW.c
  const at = (deg, rr) => [cx + rr * Math.cos((deg * Math.PI) / 180), cy + rr * Math.sin((deg * Math.PI) / 180)]
  return smooth([at(200, 17), at(225, 17), at(250, 17)], { closed: false }).shape()
}
const keyShapes = [
  group('shine bow', [bowShine(), stroke('#ffffff', 3.5, 70)]),
  group('shine blade', [new Path().move(-66, -2).line(-36, -2).shape(), stroke('#ffffff', 2.5, 60)]),
  group('collar', [rc(-74, 0, 9, 22, 2.5), stroke(GOLD_LINE, 4), gradient(GOLD, [-74, -11], [-74, 11])]),
  group('bow', [el(BOW.c[0], BOW.c[1], BOW.r * 2), el(BOW.c[0], BOW.c[1], BOW.hole * 2), stroke(GOLD_LINE, 4.5), gradient(GOLD, [BOW.c[0], -BOW.r], [BOW.c[0], BOW.r], 2)]),
  group('blade', [blade(), stroke(GOLD_LINE, 4), gradient(GOLD, [0, -6], [0, 14])]),
]

/** Де кінчик: у спокої, перед щілиною, у замку. */
const REST = [HOLE[0] - 46, HOLE[1]]
const REST_UP = [REST[0], REST[1] - 5]
const READY = [HOLE[0] - 12, HOLE[1]]
const IN = [HOLE[0] + 26, HOLE[1]]
const keyMoves = A(
  [
    [0, REST],
    [36, REST],
    [84, READY],
    [111, IN],
    [204, IN],
    [228, READY],
    [270, REST],
    [304, REST_UP],
    [338, REST],
    [OP, REST],
  ],
  { spatial: true },
)
// Пробує провернути: ключ «стискається» по висоті (ніби крутиться навколо
// своєї осі) — і повертається, бо замок не пускає.
/** Ключ трохи більший за свої координати — солідніший поруч із замком. */
const KEY_SCALE = 112
const keyTurn = (() => {
  const full = [KEY_SCALE, KEY_SCALE]
  const keys = [[0, full]]
  for (const [a, top, b, k] of TRIES) keys.push([a, full, 'out'], [top, [KEY_SCALE, (KEY_SCALE * (94 - 30 * k)) / 100]], [b, full])
  keys.push([OP, full])
  return A(keys)
})()
/** Ключ видно лише ліворуч від щілини — далі він «у замку». */
const matte = shapeLayer('key matte', [group('visible', [rc(HOLE[0] / 2, H / 2, HOLE[0], H, 0), fill('#ffffff')])], { op: OP, td: 1 })
const keyLayer = shapeLayer('key', keyShapes, { p: keyMoves, s: keyTurn, op: OP, tt: 1 })

// ——— Іскорки й тінь ———————————————————————————————————————————————
const sparkle = (nm, x, y, rr, at) => group(nm, [star(0, 0, 4, rr, rr * 0.36, 0, 0, 30), fill(SPARK)], { p: [x, y], s: twinkle(at, 36) })
const sparks = shapeLayer('sparkles', [sparkle('right', 296, 72, 13, [258]), sparkle('left', 106, 98, 8, [276])], { op: OP })
const shadow = shapeLayer('shadow', [group('shadow', [el(CX, y1 + 14, bw + 10, 14), fill('#000000', 9)])], { op: OP })

const layers = [sparks, matte, keyLayer, bodyLayer, shackleLayer, shadow].map((l, i) => ({ ...l, ind: i + 1 }))
const animation = { v: '5.9.6', fr: FR, ip: 0, op: OP, w: W, h: H, nm: 'padlock', ddd: 0, assets: [], layers, markers: [] }

// NaN/Infinity у JSON стають null — iOS тоді не читає файл узагалі.
const json = JSON.stringify(animation, (k, v) => {
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`padlock.json: ${v} у «${k}»`)
  return typeof v === 'number' ? Math.round(v * 1000) / 1000 : v
})
const file = join(outDir, 'padlock.json')
writeFileSync(file, json)
console.log('→', file, `${(json.length / 1024).toFixed(1)} КБ`)
