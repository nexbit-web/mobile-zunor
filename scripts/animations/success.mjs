// «Успіх»: зелений кружечок із галочкою — і вибух конфеті з-за нього.
// Показуємо, коли заявку опубліковано (zunor/zunor-chat.tsx).
//
// Ідея — з Lottie «gopay successful payment» (власник приніс), але
// намальовано тут наново: маленьке полотно, наші кольори, рівно — без
// пружин (кружечок не роздувається й не стискається, лише виростає).
//
// Запуск — вручну:  node scripts/animations/success.mjs [тека]
// Результат — assets/animations/success.json, комітиться.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { A, el, fill, group, rc, shapeLayer, smooth, star, stroke, trim } from '../mascot/lottie-kit.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = process.argv[2] ?? join(here, '..', '..', 'assets', 'animations')

const FR = 30
const OP = 54 // 1,8 с; грається один раз, далі стоїть останній кадр
const SIZE = 400
const C = SIZE / 2

const GREEN = '#34c759' // TINT.green застосунку
const WHITE = '#ffffff'
/** Конфеті — кольори речей кота (scripts/mascot/build.mjs). */
const CONFETTI = ['#1f6feb', '#ffc53d', '#ff7aa8', '#36c3a0', '#f4802a', '#34c759']

/** Радіус кружечка. */
const R = 76

// ——— Кружечок і галочка ——————————————————————————————————————

/** Кружечок виростає з точки за 0,4 с — рівно, без перельоту. */
const circle = shapeLayer('circle', [group('circle', [el(C, C, R * 2), fill(GREEN)])], {
  p: [C, C],
  a: [C, C],
  s: A([
    [0, [0, 0], 'out'],
    [12, [100, 100]],
  ]),
  op: OP,
})

/** Галочка малюється, щойно кружечок виріс. */
const tick = shapeLayer(
  'tick',
  [
    group('tick', [
      smooth(
        [
          [C - 34, C + 2],
          [C - 10, C + 26],
          [C + 36, C - 22],
        ],
        { closed: false, sharp: [0, 1, 2] },
      ).shape(),
      trim(
        A([
          [10, 0, 'out'],
          [24, 100],
        ]),
      ),
      stroke(WHITE, 17),
    ]),
  ],
  { op: OP },
)

// ——— Вибух ———————————————————————————————————————————————————

/**
 * Хвиля: зелене кільце розходиться від кружечка й тане. Ореол і хвиля —
 * напівпрозорий зелений, а не світло-зелений: у темній темі світлий
 * виглядав би сірим.
 */
const wave = shapeLayer('wave', [group('ring', [el(C, C, R * 2), stroke(GREEN, 6)])], {
  p: [C, C],
  a: [C, C],
  s: A([
    [4, [100, 100], 'out'],
    [26, [205, 205]],
  ]),
  o: A([
    [0, 0],
    [4, 0],
    [5, 55],
    [26, 0],
  ]),
  op: OP,
})

/** Ореол під кружечком: спалахує й тоне за ним. */
const halo = shapeLayer('halo', [group('halo', [el(C, C, R * 2), fill(GREEN, 24)])], {
  p: [C, C],
  a: [C, C],
  s: A([
    [2, [0, 0], 'out'],
    [16, [150, 150]],
    [40, [100, 100]],
  ]),
  op: OP,
})

/**
 * Шматочки конфеті: `[кут °, відстань, форма, колір, поворот]`. Вилітають
 * з-за кружечка, сповільнюються, ледь осідають униз, кружляють і тануть.
 */
const PIECES = [
  [-92, 150, 'strip', 0, 160],
  [-64, 178, 'dot', 1, 0],
  [-40, 124, 'star', 2, 120],
  [-12, 168, 'arc', 3, -200],
  [14, 132, 'strip', 4, 220],
  [40, 176, 'dot', 0, 0],
  [64, 128, 'star', 5, -140],
  [92, 164, 'arc', 1, 180],
  [118, 134, 'strip', 2, -160],
  [146, 180, 'dot', 3, 0],
  [170, 126, 'star', 4, 160],
  [198, 166, 'arc', 5, -220],
  [224, 132, 'strip', 3, 200],
  [248, 174, 'dot', 2, 0],
  [-120, 128, 'dot', 4, 0],
  [-150, 172, 'strip', 5, -180],
]

function piece([deg, dist, kind, ci, spin], i) {
  const color = CONFETTI[ci]
  const a = (deg * Math.PI) / 180
  const at = (k) => [C + Math.cos(a) * dist * k, C + Math.sin(a) * dist * k]
  const start = 4 + (i % 3) // не всі разом
  const out = at(1)
  const shape =
    kind === 'dot'
      ? [el(0, 0, 18), fill(color)]
      : kind === 'strip'
        ? [rc(0, 0, 26, 10, 5), fill(color)]
        : kind === 'star'
          ? [star(0, 0, 5, 14, 7, 0, 3, 3), fill(color)]
          : [
              // Закрутка: півкола товстою лінією.
              smooth(
                [
                  [-12, 4],
                  [-8, -8],
                  [4, -12],
                  [12, -4],
                ],
                { closed: false },
              ).shape(),
              stroke(color, 7),
            ]
  return group(`piece ${i}`, shape, {
    p: A(
      [
        [start, at(0.25), 'out'],
        [start + 22, out],
        [OP - 8, [out[0], out[1] + 22]],
      ],
      { spatial: true },
    ),
    r: A([
      [start, 0, 'out'],
      [OP - 8, spin],
    ]),
    s: A([
      [start, [0, 0], 'out'],
      [start + 5, [100, 100]],
    ]),
    o: A([
      [start + 20, 100],
      [OP - 8, 0],
    ]),
  })
}

const confetti = shapeLayer('confetti', PIECES.map(piece), { op: OP })

// ——— Запис ———————————————————————————————————————————————————

/** Шари: перші — зверху. Групи всередині — у своєму порядку. */
function animation() {
  return {
    v: '5.9.6',
    fr: FR,
    ip: 0,
    op: OP,
    w: SIZE,
    h: SIZE,
    nm: 'success',
    ddd: 0,
    assets: [],
    layers: [tick, circle, wave, halo, confetti].map((l, i) => ({ ...l, ind: i + 1 })),
    markers: [],
  }
}

function compact(o) {
  return JSON.stringify(o, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))
}

const file = join(outDir, 'success.json')
writeFileSync(file, compact(animation()))
console.log('→', file)
