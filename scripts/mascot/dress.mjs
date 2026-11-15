// Сцена «Вигляд» у налаштуваннях — сидячий кіт у трьох стилях.
//
// Власник: попередній кіт «сильно жирний і дуже багато різних елементів»,
// а треба як качка в Telegram — «професійно, круто і просто». Він приніс
// картинку сидячого кота (зроблену ШІ за нашою наліпкою cat-love), ми її
// обвели (cat-sitting.json: лінії, суцільні плями — зіниці, носик,
// веснянки, — заливки областей між лініями і плями смуг/відблисків
// усередині шерсті; хвіст і очі — окремими частинами). Тут кіт лише
// ПЕРЕФАРБОВУЄТЬСЯ під стиль і отримує одну-дві речі:
//   леопард — золотий у темних цятках, ікла;
//   рокер   — червоний з бірюзовим ІРОКЕЗОМ (власник: «ірокез, не шипи»);
//   лев     — пісочний, фіолетова грива, китиця на хвості.
// Над котом — ряд кружечків-кольорів (як у Telegram): обраний у кільці;
// ряд зсувається, кіт кліпає — і вже в новому стилі. Рух рівний, без
// пружин: дихає, кліпає, водить хвостом.
//
//   node scripts/mascot/dress.mjs [тека]   → assets/animations/cat-dress.json

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { A, K, el, fill, group, shapeLayer, smooth, stroke, sway } from './lottie-kit.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const cat = JSON.parse(readFileSync(join(here, 'cat-sitting.json'), 'utf8'))

const FR = 30
const TOTAL = 240 // 8 с: три стилі по 80 кадрів
const SWAPS = [80, 160, 240]
const INK = '#380c1e'
const LINE = 10
const WHITE = '#ffffff'
const EYE = '#ffece6'
const PLUM = '#721236'
const TONGUE = '#ec7896'

// Полотно: кіт (координати малюнка, центр силуету — 0, 0) зсунутий на O.
const W = 1200
const H = 1240
const O = [600, 710]
const at = ([x, y]) => [x + O[0], y + O[1]]
const shape = (pts, closed = true) => smooth(pts.map(at), { closed }).shape()

/** Окрас: шерсть, смуги (темніше), відблиски (світліше), всередині вуха. */
const STYLES = [
  {
    id: 'leopard',
    // Окрас — як тигр у Telegram (скриншот власника): соковитий помаранчевий.
    dot: '#ff7a1a',
    fur: { fur: '#fa6f16', dark: '#d9560b', light: '#ff9f55', plum: PLUM },
    costume: leopard,
  },
  {
    id: 'rocker',
    dot: '#ff2e4d',
    fur: { fur: '#e8303f', dark: '#b8162d', light: '#ff7a84', plum: '#6e0c22' },
    costume: rocker,
  },
  {
    id: 'lion',
    dot: '#6a33e0',
    fur: { fur: '#e8a64a', dark: '#c98a32', light: '#f8cd86', plum: '#6b3410' },
    costume: lion,
  },
]

const REGION = { fur: (c) => c.fur, eye: () => EYE, plum: (c) => c.plum, tongue: () => TONGUE }
const PATCH = { dark: (c) => c.dark, light: (c) => c.light, plum: (c) => c.plum }

/**
 * Частина кота (`body`, `tail`, `eyeL`, `eyeR`): згори — лінії, суцільні
 * плями (парно-непарна заливка: відблиски в зіницях — дірки), `extra`
 * (речі костюма під лініями), смуги й відблиски, унизу — заливки областей.
 */
function part(name, c, extra = []) {
  const lines = cat.strokes.filter((s) => s.part === name)
  const blobs = cat.blobs.filter((b) => b.part === name)
  const patches = cat.patches.filter((p) => p.part === name)
  const regions = cat.regions.filter((r) => (r.part ?? 'body') === name).sort((a, b) => a.area - b.area)
  return [
    ...(lines.length ? [group('lines', [...lines.map((l) => shape(l.pts, l.closed)), stroke(INK, LINE)])] : []),
    ...(blobs.length ? [group('blobs', [...blobs.map((b) => shape(b.pts)), { ...fill(INK), r: 2 }])] : []),
    ...extra,
    ...['plum', 'light', 'dark'].flatMap((k) => {
      const list = patches.filter((p) => p.cls === k)
      return list.length ? [group(`patch ${k}`, [...list.map((p) => shape(p.pts)), fill(PATCH[k](c))])] : []
    }),
    ...regions.map((r, i) => group(`region ${r.cls} ${i}`, [shape(r.pts), fill(REGION[r.cls](c))])),
  ]
}

const SPOT = '#4a1a05'
const spot = (x, y, r, color = SPOT) => group(`spot ${x} ${y}`, [el(...at([x, y]), r * 2, r * 1.8), fill(color)])
const blob = (nm, pts, color, w = LINE) => group(nm, [shape(pts), stroke(INK, w), fill(color)])

/** Леопард: темні цятки на голові, тілі, хвості й лапах; великі ікла. */
function leopard() {
  // Ікла ростуть З-ПІД верхньої губи: верхній край — рівно на її лінії
  // (y ≈ −184…−175, лінія 10 px його ховає), кінчики — униз у рот.
  const fang = (pts) => smooth(pts.map(at), { closed: true, sharp: [0, 2, 4] }).shape()
  return {
    body: [
      group('fangs', [
        fang([[64, -184], [72, -150], [86, -124], [98, -150], [106, -175]]),
        fang([[194, -175], [202, -150], [214, -124], [228, -150], [236, -184]]),
        stroke(INK, 5),
        fill(WHITE),
      ]),
      spot(30, -420, 13), spot(196, -428, 11), spot(-90, -320, 14), spot(372, -290, 13), spot(-100, -200, 10), spot(390, -190, 9),
      spot(-60, 30, 18), spot(300, 10, 17), spot(-10, 150, 13), spot(360, 140, 15), spot(-120, 290, 11), spot(-40, 420, 14), spot(400, 400, 13),
    ],
    tail: [spot(-400, -190, 16), spot(-320, -120, 12), spot(-420, 40, 15), spot(-380, 200, 16), spot(-350, 350, 12)],
  }
}

/** Рокер: бірюзові шипи стирчать з-за голови (власник: «шипи, щоб стирчали»). */
function rocker() {
  const C0 = [130, -250]
  const spike = (deg, len, w) => {
    const a = (deg * Math.PI) / 180
    const d = [Math.cos(a), Math.sin(a)]
    const n = [-d[1], d[0]]
    const edge = [C0[0] + 330 * d[0], C0[1] + 222 * d[1]]
    const b = [edge[0] - d[0] * 60, edge[1] - d[1] * 60]
    const t = [edge[0] + d[0] * len, edge[1] + d[1] * len]
    const k = (q, side) => [b[0] + (t[0] - b[0]) * q + n[0] * w * side, b[1] + (t[1] - b[1]) * q + n[1] * w * side]
    return group(`spike ${deg}`, [
      group('shine', [shape([k(0.35, -0.16), k(0.75, -0.06)], false), stroke('#b2fcff', 8)]),
      group('spike', [
        smooth([[b[0] - (n[0] * w) / 2, b[1] - (n[1] * w) / 2], t, [b[0] + (n[0] * w) / 2, b[1] + (n[1] * w) / 2]].map(at), { sharp: [0, 1, 2] }).shape(),
        stroke(INK, LINE),
        fill('#25e2e8'),
      ]),
    ])
  }
  // Між вухами — довші; крайні — за вухами.
  return { back: [spike(-98, 190, 84), spike(-115, 150, 72), spike(-81, 150, 72), spike(-131, 100, 60), spike(-65, 100, 60)] }
}

/** Пухнасте пасмо по колу/дузі: круглі «хмаринки» назовні, між ними гострі западинки. */
function fluff(cx, cy, rx, ry, n, dip, from = 0, to = 360, ryTop = ry) {
  const pts = []
  const sharp = []
  const step = (to - from) / n
  const P = (deg, r) => {
    const sn = Math.sin((deg * Math.PI) / 180)
    return [cx + rx * r * Math.cos((deg * Math.PI) / 180), cy + (sn < 0 ? ryTop : ry) * r * sn]
  }
  for (let k = 0; k < n; k++) {
    const a0 = from + k * step
    sharp.push(pts.length)
    pts.push(P(a0, 1 - dip))
    pts.push(P(a0 + step * 0.22, 0.97), P(a0 + step * 0.5, 1), P(a0 + step * 0.78, 0.97))
  }
  if (to - from < 360) {
    sharp.push(pts.length)
    pts.push(P(to, 1 - dip))
  }
  return { pts, sharp }
}
const fluffShape = ({ pts, sharp }) => smooth(pts.map(at), { sharp }).shape()

/** Лев: пухнаста фіолетова грива навколо голови й комір під підборіддям; китиця на хвості. */
function lion() {
  const MANE = '#3b1772'
  const MANE_MID = '#6230c4'
  // Комір під підборіддям (не довкола рота): угорі — пряма під щоками, унизу — круглі пасма.
  const ruffBottom = fluff(150, -60, 215, 150, 7, 0.14, 8, 172)
  const ruff = [...ruffBottom.pts, [-40, -70], [60, -26], [150, -14], [240, -26], [340, -70]]
  return {
    back: [
      // Згори пласкіша — не ховає кружечки; з боків — пишна.
      group('mane mid', [fluffShape(fluff(140, -262, 352, 302, 16, 0.12, 0, 360, 190)), fill(MANE_MID)]),
      group('mane', [fluffShape(fluff(140, -262, 404, 344, 16, 0.12, 0, 360, 228)), stroke(INK, LINE), fill(MANE)]),
    ],
    body: [group('ruff', [smooth(ruff.map(at), { sharp: [...ruffBottom.sharp, ruffBottom.pts.length] }).shape(), stroke(INK, LINE), fill(MANE)])],
    tail: [
      group('tuft shine', [shape([[-440, -200], [-410, -244], [-370, -258]], false), stroke('#8b5cf6', 10)]),
      group('tuft', [shape([[-486, -150], [-476, -226], [-420, -276], [-340, -270], [-282, -214], [-292, -168], [-318, -186], [-334, -150], [-362, -176], [-384, -140], [-410, -172], [-436, -138], [-458, -170]]), fill(MANE)]),
    ],
  }
}

// ——— Анімація ———————————————————————————————————————————————————

const FLOOR = at([100, 500])
/** Дихання: тіло ледь ширшає й росте від підлоги. */
const breath = A(sway([100, 100], [1.2, 1.8], 80, TOTAL))
/** Зміна стилю: кіт ледь «вдихає» — 100 → 94 → 100 (рівно, без пружини). */
const FULL = [100, 100, 100]
const SMALL = [94, 94, 100]
const pulse = A([
  [0, SMALL, 'out'],
  [9, FULL],
  ...SWAPS.flatMap((s) => [[s - 9, FULL, 'in'], ...(s < TOTAL ? [[s, SMALL, 'out'], [s + 9, FULL]] : [[s, SMALL]])]),
])
/** Хвіст водить від основи. */
const TAIL_BASE = at([-300, 420])
const tailWag = A(sway(-1.5, 3, 80, TOTAL))
/** Кліп: око стискається в рисочку перед зміною стилю й розплющується вже в новому; ще раз посеред стилю. */
const blinkKeys = (() => {
  const k = [[0, [100, 8]], [4, [100, 100]]]
  for (const s of SWAPS) {
    k.push([s - 44, [100, 100]], [s - 41, [100, 8]], [s - 38, [100, 100]])
    k.push([s - 7, [100, 100]], [s - 4, [100, 8]])
    if (s < TOTAL) k.push([s, [100, 8]], [s + 4, [100, 100]])
  }
  return k.sort((a, b) => a[0] - b[0])
})()
const eyeCenter = (nm) => {
  const r = cat.regions.find((g) => g.part === nm)
  const xs = r.pts.map((p) => p[0])
  const ys = r.pts.map((p) => p[1])
  return at([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2])
}

function catLayers(st, ip, op) {
  const c = st.fur
  const cos = st.costume()
  const eye = (nm) => {
    const ctr = eyeCenter(nm)
    return group(nm, part(nm, c), { p: ctr, a: ctr, s: A(blinkKeys) })
  }
  const parentNull = {
    ddd: 0, ind: 0, ty: 3, nm: `cat ${st.id}`, sr: 1,
    ks: { o: K(0), r: K(0), p: K([...FLOOR, 0]), a: K([...FLOOR, 0]), s: breath },
    ao: 0, ip, op, st: 0, bm: 0,
  }
  const layers = [
    shapeLayer(`${st.id} eyes`, [eye('eyeL'), eye('eyeR')], { ip, op }),
    shapeLayer(`${st.id} body`, part('body', c, cos.body ?? []), { ip, op }),
    ...(cos.back ? [shapeLayer(`${st.id} back`, cos.back, { ip, op })] : []),
    shapeLayer(`${st.id} tail`, part('tail', c, cos.tail ?? []), { p: TAIL_BASE, a: TAIL_BASE, r: tailWag, ip, op }),
  ]
  return { parentNull, layers }
}

function scene() {
  const cats = STYLES.map((st, i) => catLayers(st, i === 0 ? 0 : SWAPS[i - 1], SWAPS[i]))
  // Ряд кружечків: великі, низом трохи ЗА головою (шар під котом); по
  // центру — кільце; видно три, ряд зсувається на один.
  const C = [O[0] + 130, 190]
  const GAP = 270
  const steps = [0, ...SWAPS.flatMap((s) => [s - 14, s - 2]), TOTAL]
  const shiftAt = steps.map((_, i) => Math.floor(i / 2))
  const dots = []
  for (let k = -1; k <= STYLES.length + 1; k++) {
    const color = STYLES[((k % STYLES.length) + STYLES.length) % STYLES.length].dot
    const rel = steps.map((t, i) => [t, k - shiftAt[i]])
    dots.push(
      group(`dot ${k}`, [el(0, 0, 190), fill(color)], {
        p: A(rel.map(([t, r]) => [t, [C[0] + r * GAP, C[1]]])),
        s: A(rel.map(([t, r]) => [t, Math.abs(r) <= 1 ? [100, 100] : [0, 0]])),
      }),
    )
  }
  const picker = shapeLayer('picker', [group('ring', [el(C[0], C[1], 272), stroke('#a1a1aa', 13)]), ...dots], { op: TOTAL })
  const shadow = shapeLayer('shadow', [group('shadow', [el(FLOOR[0], FLOOR[1] + 6, 900, 60), fill(INK, 10)])], { op: TOTAL })
  const pulseNull = {
    ddd: 0, ty: 3, nm: 'pulse', sr: 1,
    ks: { o: K(0), r: K(0), p: K([...FLOOR, 0]), a: K([...FLOOR, 0]), s: pulse },
    ao: 0, ip: 0, op: TOTAL, st: 0, bm: 0,
  }

  // Згори вниз: коти, кружечки (за котом), тінь. Шари кота — діти його
  // null (дихання), той — дитина спільного null (пульсація на зміні).
  const layers = []
  let ind = 1
  pulseNull.ind = ind++
  for (const { parentNull, layers: ls } of cats) {
    parentNull.ind = ind++
    parentNull.parent = pulseNull.ind
    for (const l of ls) {
      l.ind = ind++
      l.parent = parentNull.ind
      layers.push(l)
    }
    layers.push(parentNull)
  }
  picker.ind = ind++
  shadow.ind = ind++
  layers.push(picker, pulseNull, shadow)
  return { v: '5.9.6', fr: FR, ip: 0, op: TOTAL, w: W, h: H, nm: 'cat-dress', ddd: 0, assets: [], layers, markers: [] }
}

/** Вершини кривих — до десятих пікселя (файл менший); решта — до сотих (кольори 0…1). */
function roundPaths(o) {
  if (Array.isArray(o)) return o.forEach(roundPaths)
  if (!o || typeof o !== 'object') return
  if (o.ty === 'sh' && o.ks?.k?.v) {
    for (const key of ['v', 'i', 'o']) o.ks.k[key] = o.ks.k[key].map((p) => p.map((x) => Math.round(x * 10) / 10))
  }
  Object.values(o).forEach(roundPaths)
}

const out = join(process.argv[2] ?? join(here, '..', '..', 'assets', 'animations'), 'cat-dress.json')
const doc = scene()
roundPaths(doc)
writeFileSync(
  out,
  JSON.stringify(doc, (_k, v) => {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('NaN/Infinity у Lottie — iOS такого не прийме')
    return typeof v === 'number' ? Math.round(v * 100) / 100 : v
  }),
)
console.log('→', out)
