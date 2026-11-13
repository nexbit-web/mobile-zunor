// Рудий кіт-талісман — анімації для анкети нового акаунта.
//
// Кіт — той самий, що в наліпці `cat-love.source.json` (Lottie «кіт
// закоханий»): з неї взято морду (очі, ніс-сердечко, рот, ластовиння,
// рум'янець) і зіниці. Тіло, що СИДИТЬ, голова, вуха, лапи, хвіст і речі
// довкола намальовані тут, у тих самих кольорах і тим самим контуром.
//
// Запуск — вручну:  node scripts/mascot/build.mjs [сцена] [тека]
// Результат — assets/animations/cat-*.json, комітиться.
//
// Сцени — по одній, як домовились із власником:
//   hello — «Познайомимось»: сидить, усміхається, дивиться на хмаринку;
//   think — «Яку роботу берете»: лікоть на коліні, лапка під підборіддям,
//           переводить погляд із відра зі шваброю на пульверизатор, над
//           головою — знаки питання.
//   show  — «Покажіть себе клієнтам»: тримає планшет зі своїм профілем;
//   champion — анкету надіслано: піднімає кубок, конфеті (кубок і конфеті
//           — з `champion.source.json`, на кубку замість зірки знак Zunor);
//   lock  — «Безпека» в налаштуваннях: кіт-грабіжник у чорній масці
//           пробує відімкнути замок чужим ключем — не виходить.
//   dress — «Вигляд» у налаштуваннях: за котом крутяться кружечки кольорів,
//           обрав — кіт міняє стиль (леопард, рокер, лев).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { A, K, Path, dashed, el, fill, group, morph, rc, shapeLayer, smooth, star, stroke, sway, tr, trim, twinkle } from './lottie-kit.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', '..', 'assets', 'animations')
const source = JSON.parse(readFileSync(join(here, 'cat-love.source.json'), 'utf8'))
/** Lottie «Trophy» (людина з кубком і конфеті, власник приніс): беремо кубок і конфеті. */
const champion = JSON.parse(readFileSync(join(here, 'champion.source.json'), 'utf8'))
const zunorMark = JSON.parse(readFileSync(join(outDir, 'zunor-mark-blink.json'), 'utf8'))

// Кольори наліпки.
const INK = '#380c1e'
const WHITE = '#ffffff'
const ORANGE = '#f4802a'
const ORANGE_LIGHT = '#ffa766'
const ORANGE_DARK = '#d45c10'
const ORANGE_DEEP = '#e36a1e'
const PLUM = '#651536'
/** Окрас кота: шерсть, груди, смужки на лобі, смужки на боках і хвості, вухо всередині. */
const GINGER = { base: ORANGE, light: ORANGE_LIGHT, dark: ORANGE_DARK, deep: ORANGE_DEEP, ear: PLUM }
// Речі довкола кота.
const BLUE = '#1f6feb'
const BLUE_DEEP = '#174ea6'
const MINT = '#36c3a0'
const MINT_DEEP = '#1f9c7c'
const STEEL = '#e8ebf0'
const WOOD = '#e3a65e'
const SPONGE = '#ffd23f'
const SPONGE_DEEP = '#e6b422'
const SKY = '#cfe3ff'
const GLASS = '#a9cdfa'
const PINK = '#ff7aa8'
const GOLD = '#ffc53d'
const GOLD_DEEP = '#e9a31b'
const STEEL_DARK = '#c3cad4'
const MASK = '#1d1820'
const EMPTY = '#e3e5ea'
const TEXT = '#3a3a44'
const LINE_GRAY = '#dfe3ea'
const BEZEL = '#2d2f36'
const MINT_SOFT = '#bdeedd'
const SUN_SOFT = '#ffe7a3'

const FR = 30
const OP = 180 // 6 с, петля
const LINE = 11 // товщина контуру, як у наліпки

const clone = (o) => JSON.parse(JSON.stringify(o))
const main = source.assets.find((a) => a.id === 'comp_0')
const srcLayer = (nm) => main.layers.find((l) => l.nm === nm)
const body = srcLayer('body')
/** Групи тіла наліпки (у її координатах; тіло зсунуте на 492, 380). */
const BODY_AT = [492, 380]
const bodyGroups = (...names) => clone(body.shapes.filter((s) => names.includes(s.nm)))
const subGroups = (nm, ...idx) => {
  const g = clone(body.shapes.find((s) => s.nm === nm))
  g.it = g.it.filter((it) => it.ty !== 'gr' || idx.includes(Number(it.nm.split(' ')[1])))
  return g
}

/** Контур-наліпка: заливка, поверх — контур. */
const blob = (nm, pts, color, opts = {}) => group(nm, [smooth(pts, opts).shape(), stroke(INK, LINE), fill(color)])
/** Відкрита лінія. */
const line = (pts) => smooth(pts, { closed: false }).shape()
/** Смужки: товсті лінії, без контуру. */
const stripes = (nm, lines, color = ORANGE_DARK, w = 15) => group(nm, [...lines.map(line), stroke(color, w)])
/** «Трубка» з контуром: та сама лінія товстіше чорнилом під кольоровою. */
const tube = (nm, pts, color, w, extra = []) =>
  group(nm, [...extra, group('fill', [line(pts), stroke(color, w)]), group('outline', [line(pts), stroke(INK, w + LINE * 2)])])

// ——— Сидячий кіт ——————————————————————————————————————————————————
// Координати — наліпки (морда стоїть, де стояла: очі ≈ y 434, рот ≈ 550).

const EYE_L = [622, 434]
const EYE_R = [758, 436]

/**
 * Поза:
 *  pivot  — точка, навколо якої хилиться голова (шия; або лапка під
 *           підборіддям — тоді голова «спирається» на неї);
 *  tilt   — ключі нахилу голови;
 *  look   — ключі зіниць `[кадр, [x, y] лівої, [x, y] правої]`;
 *  blinkAt, twitch {left, right} — кадри кліпання й смикання вух;
 *  mouth  — 'smile' (рот наліпки) або 'hmm' (задумливий);
 *  brows  — брови (одна піднята);
 *  chinPaw — права лапка під підборіддям, лікоть на коліні;
 *  hold   — обома лапками тримає перед грудьми фото (полароїд);
 *  wink   — кадр, коли праве око підморгує;
 *  key    — права лапа з ключем біля замка (сцена «Безпека»);
 *  mask   — чорна маска грабіжника з прорізами для очей;
 *  browKeys — брови, що міняються: `[кадр, ліва, права]` (точки);
 *  sweat  — кадр, коли по лобі стікає крапля поту;
 *  fur    — окрас (GINGER за замовчуванням), `bands` — свої кольори смужок хвоста;
 *  total, breathe — довжина петлі й період подиху (кадри, кратні);
 *  blinkKeys — свої ключі кліпання (замість blinkAt);
 *  costume {front, paint, back, neck, coat, tail, body, noEars} — костюм (сцена «Вигляд»).
 */
function sittingCat(pose) {
  const { pivot, tilt, look, blinkAt, twitch, mouth = 'smile', brows = false, chinPaw = false, hold = false, wink, raise = false, key = false, mask = false, browKeys, sweat, joy, tailWag = 90, fur = GINGER, total = OP, breathe = 90, blinkKeys, costume = {} } = pose
  // Права передня лапа зайнята (підборіддя, кубок, ключ) — на грудях лише ліва.
  const oneArm = chinPaw || raise || key
  // Подих: усе тіло ледь росте від підлоги, голова (й лапка під нею) — вгору.
  const lift = A(sway([...pivot, 0], [0, -5, 0], breathe, total), { spatial: true })

  const head = {
    ddd: 0,
    ind: 900,
    ty: 3,
    nm: 'head',
    sr: 1,
    ks: { o: K(0), r: A(tilt), p: lift, a: K([...pivot, 0]), s: K([100, 100, 100]) },
    ao: 0,
    ip: 0,
    op: total,
    st: 0,
    bm: 0,
  }
  const child = (layer) => ({ ...layer, parent: head.ind })

  // Очі: кожне — свій шар, щоб кліпати (стиснути по вертикалі). Зіниці —
  // діти ока: кліпають разом із ним.
  // Кліпання — око стискається в рисочку; підморгування — зникає зовсім
  // (лишається щаслива дужка, без сплющеного ока під нею).
  const closes = (times, hold = 1, to = 8) =>
    times.flatMap((t) => [
      [t, [100, 100]],
      [t + 3, [100, to]],
      [t + 3 + hold, [100, to]],
      [t + 7 + hold, [100, 100]],
    ])
  const WINK_HOLD = 16
  // Радість: з кадру `joy` обидва ока зажмурені до кінця (дужки «^ ^»).
  const joyKeys = joy === undefined ? [] : [[0, [100, 100]], [joy, [100, 100]], [joy + 3, [100, 0]]]
  const blinkL = blinkKeys ?? (joy === undefined ? closes(blinkAt) : joyKeys)
  const blinkR = joy === undefined ? [...blinkL, ...(wink ? closes([wink], WINK_HOLD, 0) : [])].sort((a, b) => a[0] - b[0]) : joyKeys
  const eye = (nm, center, groups, keys) =>
    child(shapeLayer(nm, groups, { p: center, a: [center[0] - BODY_AT[0], center[1] - BODY_AT[1]], s: A(keys), op: total }))
  const eyeL = eye('eye left', EYE_L, [subGroups('Group 37', 1, 2), ...bodyGroups('Group 8', 'Group 38')], blinkL)
  const eyeR = eye('eye right', EYE_R, [subGroups('Group 37', 3, 4), ...bodyGroups('Group 10', 'Group 39')], blinkR)

  const pupil = (src, eyeLayer, side) => {
    const l = clone(srcLayer(src))
    // Координати зіниці — у шарі ока (тіло наліпки зсунуте на BODY_AT).
    const local = (p) => [p[0] - BODY_AT[0], p[1] - BODY_AT[1], 0]
    l.ks.p = A(look.map(([t, left, right]) => [t, local(side === 'left' ? left : right)]), { spatial: true })
    l.ip = 0
    l.op = total
    l.ind = eyeLayer.ind + 500
    l.parent = eyeLayer.ind
    return l
  }
  const pupilR = pupil('l pupil', eyeR, 'right')
  const pupilL = pupil('r pupil', eyeL, 'left')

  // Морда без очей: рум'янець, ластовиння; рот — наліпки або свій.
  const cheeks = ['Group 1', 'Group 2', 'Group 3']
  const smileMouth = ['Group 9', 'Group 34', 'Group 35', 'Group 36']
  // Під маскою рум'янець і ластовиння визирали б з-під краю — без них.
  const faceGroups = [...(mask ? [] : cheeks), ...(mouth === 'smile' ? smileMouth : [])]
  const face = faceGroups.length ? [child(shapeLayer('face', bodyGroups(...faceGroups), { p: BODY_AT, op: total }))] : []
  const own = []
  if (mouth === 'hmm') {
    // Ніс-сердечко (як у наліпки) і стулений рот, зсунутий набік.
    own.push(
      group('mouth', [line([[697, 486], [698, 502]]), line([[664, 520], [688, 530], [710, 524], [728, 510]]), stroke(INK, 9)]),
      group('nose', [smooth([[697, 490], [678, 476], [676, 461], [688, 455], [697, 463], [706, 455], [718, 461], [716, 476]], { sharp: [0, 4] }).shape(), fill(INK)]),
    )
  }
  if (brows) {
    // Ліва — рівна, права — піднята: «хм».
    own.push(group('brows', [line([[592, 392], [618, 384], [644, 390]]), line([[734, 380], [762, 364], [792, 372]]), stroke(INK, 9)]))
  }
  if (browKeys) {
    const brow = (nm, side) => morph(nm, browKeys.map(([t, ...pts]) => [t, smooth(pts[side], { closed: false })]))
    own.push(group('brows', [brow('left', 0), brow('right', 1), stroke(INK, 9)]))
  }
  if (sweat !== undefined) {
    // Крапля з-під маски стікає скронею й тане.
    own.push(
      group('sweat', [smooth([[0, -24], [14, 4], [0, 16], [-14, 4]], { sharp: [0] }).shape(), stroke(INK, 5), fill(SKY)], {
        p: A([
          [sweat, [836, 360]],
          [sweat + 40, [852, 424], 'in'],
        ]),
        s: A([
          [sweat, [0, 0], 'out'],
          [sweat + 8, [135, 135]],
        ]),
        o: A([
          [sweat + 30, 100],
          [sweat + 40, 0],
        ]),
      }),
    )
  }
  if (joy !== undefined) {
    own.push(
      group('joy', [line([[596, 442], [622, 424], [648, 442]]), line([[732, 444], [758, 426], [784, 444]]), stroke(INK, 9)], {
        o: A([
          [0, 0],
          [joy + 2, 0],
          [joy + 3, 100],
        ]),
      }),
    )
  }
  if (wink) {
    // Підморгнув: око — щасливою дужкою, поки стиснуте.
    own.push(
      group('wink', [line([[732, 444], [758, 426], [784, 444]]), stroke(INK, 9)], {
        o: A([
          [0, 0],
          [wink + 2, 0],
          [wink + 3, 100],
          [wink + 4 + WINK_HOLD, 100],
          [wink + 5 + WINK_HOLD, 0],
        ]),
      }),
    )
  }
  const features = own.length ? [child(shapeLayer('features', own, { op: total }))] : []

  // Маска грабіжника: чорна смуга через очі з прорізами (парно-непарна
  // заливка — у прорізах видно руду шерсть довкола очей; самі очі — шари
  // вище). Під носом — виріз. Узол і хвостики — за головою, теліпаються.
  const robber = mask
    ? [
        child(
          shapeLayer(
            'mask',
            [
              group('band', [
                smooth([[468, 418], [520, 392], [600, 380], [690, 396], [780, 380], [862, 390], [912, 416], [910, 470], [850, 488], [770, 496], [730, 476], [690, 440], [650, 476], [606, 496], [530, 488], [470, 470]]).shape(),
                el(607, 440, 140, 100),
                el(770, 442, 122, 96),
                stroke(INK, LINE),
                { ...fill(MASK), r: 2 },
              ]),
            ],
            { op: total },
          ),
        ),
      ]
    : []
  const ties = mask
    ? [
        child(
          shapeLayer(
            'mask ties',
            [
              group('knot', [el(474, 444, 36, 42), stroke(INK, LINE), fill(MASK)]),
              tube('tie top', [[478, 436], [442, 414], [404, 422]], MASK, 20),
              tube('tie bottom', [[478, 452], [446, 474], [418, 500]], MASK, 20),
            ],
            { p: [478, 444], a: [478, 444], r: A(sway(-5, 10, 60, total)), op: total },
          ),
        ),
      ]
    : []

  // Голова: широка й кругленька, на лобі — смужки, як у наліпки.
  const skull = child(
    shapeLayer(
      'skull',
      [
        stripes('forehead', [
          [[648, 346], [662, 372], [664, 398]],
          [[700, 342], [700, 372], [698, 392]],
          [[752, 350], [738, 374], [734, 396]],
        ], fur.dark),
        blob('head', [[690, 336], [842, 364], [906, 470], [884, 582], [790, 640], [690, 654], [590, 640], [496, 582], [474, 470], [538, 364]], fur.base),
      ],
      { op: total },
    ),
  )

  // Вуха — за головою; час від часу смикаються.
  const ear = (nm, outer, inner, at, twitchAt, dir) =>
    child(
      shapeLayer(nm, [group('inner', [smooth(inner).shape(), fill(fur.ear)]), blob('ear', outer, fur.base)], {
        p: at,
        a: at,
        r: A([
          [0, 0],
          [twitchAt, 0],
          [twitchAt + 4, 12 * dir],
          [twitchAt + 12, 0],
          [total, 0],
        ]),
        op: total,
      }),
    )
  const earL = ear('ear left', [[516, 430], [500, 344], [522, 312], [574, 334], [616, 368]], [[536, 402], [526, 350], [540, 334], [570, 350], [592, 374]], [556, 380], twitch.left, -1)
  const earR = ear('ear right', [[864, 430], [880, 344], [858, 312], [806, 334], [764, 368]], [[844, 402], [854, 350], [840, 334], [810, 350], [788, 374]], [824, 380], twitch.right, 1)

  // Тулуб і лапи дихають (трохи ширшають і ростуть від підлоги).
  const breath = A(sway([100, 100], [1.5, 2.5], breathe, total))
  const legs = hold
    ? []
    : [
        [[600, 758], [588, 840], [584, 906]],
        [[658, 782], [652, 850], [656, 906]],
        ...(oneArm
          ? []
          : [
              [[722, 782], [728, 850], [724, 906]],
              [[780, 758], [792, 840], [796, 906]],
            ]),
      ]
  const toes = hold ? [] : oneArm ? [606, 638] : [606, 638, 742, 774]
  const front = shapeLayer(
    'front',
    [
      group('toes', [...toes.map((x) => line([[x, 910], [x, 926]])), stroke(INK, 7)]),
      group('paws', [...(hold ? [] : [el(622, 922, 112, 52)]), ...(oneArm || hold ? [] : [el(758, 922, 112, 52)]), stroke(INK, LINE), fill(fur.base)]),
      // Передні лапи — лише лінії на грудях, як у мальованих котів.
      group('legs', [...legs.map(line), stroke(INK, 9)]),
      group('chest', [smooth([[628, 640], [690, 662], [752, 640], [758, 724], [730, 822], [690, 850], [650, 822], [622, 724]]).shape(), fill(fur.light)]),
    ],
    { p: [690, 940], a: [690, 940], s: breath, op: total },
  )
  const haunch = (nm, pts, lines) => group(nm, [stripes('stripes', lines, fur.deep, 16), blob('haunch', pts, fur.base)])
  const torso = shapeLayer(
    'torso',
    [
      haunch(
        'haunch left',
        [[480, 790], [552, 762], [612, 806], [624, 880], [588, 930], [500, 936], [452, 900], [448, 840]],
        [
          [[492, 812], [526, 806], [552, 826]],
          [[476, 852], [512, 846], [540, 868]],
        ],
      ),
      haunch(
        'haunch right',
        [[900, 790], [828, 762], [768, 806], [756, 880], [792, 930], [880, 936], [928, 900], [932, 840]],
        [
          [[888, 812], [854, 806], [828, 826]],
          [[904, 852], [868, 846], [840, 868]],
        ],
      ),
      group('back paws', [el(502, 938, 104, 40), el(878, 938, 104, 40), stroke(INK, LINE), fill(fur.base)]),
      stripes('side stripes', [
        [[512, 700], [548, 690], [570, 708]],
        [[868, 700], [832, 690], [810, 708]],
      ], fur.deep, 16),
      blob('torso', [[570, 600], [810, 600], [872, 680], [904, 790], [894, 880], [830, 926], [690, 938], [550, 926], [486, 880], [476, 790], [508, 680]], fur.base),
    ],
    { p: [690, 940], a: [690, 940], s: breath, op: total },
  )

  // Лапка під підборіддям: лікоть лежить НА правому коліні (верхня лінія
  // стегна видна з обох боків ліктя), передпліччя звужується до зап'ястя,
  // на кінці — лапа з трьома пальчиками під щокою. Лікоть, передпліччя й
  // лапа — один силует: контур лише знадвору (усі контури під усіма
  // заливками). Поверх голови (лапа ПЕРЕД підборіддям) і підіймається з
  // подихом разом із головою — голова хилиться саме навколо неї.
  const arm = chinPaw ? [chinPawLayer(lift, pivot)] : hold ? holdLayers(lift, pivot) : raise ? [trophyArmLayer()] : key ? keyArmLayers() : []

  // Хвіст — товста «трубка» з-за лівого боку вгору, кінчик загнутий.
  // Смужки — відрізки тієї ж лінії. Гойдається від основи.
  const tailPts = [[548, 902], [452, 896], [392, 848], [374, 772], [394, 712], [430, 690]]
  const bands = fur.bands ?? [fur.deep, fur.deep, fur.deep]
  const band = (from, to, color) => group(`band ${from}`, [line(tailPts), trim(K(to), K(from)), stroke(color, 42)])
  const tail = shapeLayer('tail', [...(costume.tail ?? []), tube('tail', tailPts, fur.base, 42, [band(52, 60, bands[0]), band(68, 76, bands[1]), band(84, 92, bands[2])])], {
    p: [530, 900],
    a: [530, 900],
    r: A(sway(-3, 7, tailWag, total)),
    op: total,
  })

  // Костюм (сцена «Вигляд»): `front` — над мордою (під очима), `paint` —
  // розмальовка під мордою (над черепом), `back` — за головою й вухами,
  // `neck` — на грудях (над лапами), `coat` — на тулубі (під лапами),
  // `tail` — на хвості, `body` — готові шари за тулубом; `noEars` — без вух.
  const onHead = (nm, shapes) => (shapes ? [child(shapeLayer(nm, shapes, { op: total }))] : [])
  const onBody = (nm, shapes) => (shapes ? [shapeLayer(nm, shapes, { p: [690, 940], a: [690, 940], s: breath, op: total })] : [])
  const dressFront = onHead('costume front', costume.front)
  const dressPaint = onHead('costume paint', costume.paint)
  const dressBack = onHead('costume back', costume.back)
  const dressNeck = onBody('costume neck', costume.neck)
  const dressCoat = onBody('costume coat', costume.coat)
  const dressBody = costume.body ?? []
  const ears = costume.noEars ? [] : [earL, earR]

  const shadow = shapeLayer('shadow', [group('shadow', [el(690, 944, 600, 46), fill(INK, 10)])], { op: total })

  return {
    top: [...arm, head, pupilR, pupilL, eyeL, eyeR, ...features, ...dressFront, ...robber, ...face, ...dressPaint, skull, ...ties, ...ears, ...dressBack, ...dressNeck, front, ...dressCoat, torso, tail, ...dressBody],
    shadow,
  }
}

/** Точки еліпса, повернутого на `deg` (для силуетів із кількох фігур). */
function ellipsePts(cx, cy, rx, ry, deg, n = 10) {
  const r = (deg * Math.PI) / 180
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const x = rx * Math.cos(a)
    const y = ry * Math.sin(a)
    return [cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]
  })
}

/**
 * Лапа: подушечка й три пальчики в бік `d` (одиничний вектор), між
 * пальчиками — рисочки.
 */
function pawParts(P, d) {
  const n = [-d[1], d[0]]
  const at = (p, along, across) => [p[0] + d[0] * along + n[0] * across, p[1] + d[1] * along + n[1] * across]
  const shapes = () => [
    smooth(ellipsePts(P[0], P[1], 34, 30, Math.atan2(d[1], d[0]) * (180 / Math.PI))).shape(),
    ...[-20, 0, 20].map((k) => {
      const t = at(P, 28, k)
      return el(t[0], t[1], 28)
    }),
  ]
  const lines = [-10, 10].map((k) => line([at(P, 38, k), at(P, 22, k)]))
  return { shapes, lines }
}

/**
 * Силует із кількох фігур: контур лише знадвору (усі контури під усіма
 * заливками). Кожна фігура — своя група: в одній групі накладки з різним
 * обходом «вибивали» б одна одну (дірка в заливці).
 */
const silhouette = (nm, shapes, color, top = []) =>
  group(nm, [
    ...top,
    group('fill', shapes().map((sh, i) => group(`f${i}`, [sh, fill(color)]))),
    group('outline', shapes().map((sh, i) => group(`o${i}`, [sh, stroke(INK, LINE * 2)]))),
  ])

/** Права лапка під підборіддям (поза «думає»). */
function chinPawLayer(lift, pivot) {
  // Лікоть E на коліні, зап'ястя W під щокою; d — уздовж руки, n — упоперек.
  const E = [842, 750]
  const W = [772, 668]
  const len = Math.hypot(W[0] - E[0], W[1] - E[1])
  const d = [(W[0] - E[0]) / len, (W[1] - E[1]) / len]
  const n = [-d[1], d[0]]
  const at = (p, along, across) => [p[0] + d[0] * along + n[0] * across, p[1] + d[1] * along + n[1] * across]
  const paw = pawParts(at(W, 26, 0), d)
  const shapes = () => [
    el(E[0], E[1], 64),
    smooth([at(E, 0, 31), at(W, 0, 23), at(W, 0, -23), at(E, 0, -31)], { sharp: [0, 1, 2, 3] }).shape(),
    ...paw.shapes(),
  ]
  const bands = [0.35, 0.6].map((share) => {
    const c = at(E, len * share, 0)
    return line([at(c, 4, 19), at(c, -4, -19)])
  })
  return shapeLayer(
    'chin paw',
    [silhouette('arm', shapes, ORANGE, [group('toe lines', [...paw.lines, stroke(INK, 7)]), group('stripes', [...bands, stroke(ORANGE_DEEP, 11)])])],
    { p: lift, a: [...pivot, 0], op: OP },
  )
}

/**
 * Поза «показує»: обома лапками тримає перед грудьми планшет екраном до
 * людини — на екрані його профіль, як його побачать клієнти: аватарка,
 * імʼя, пʼять зірок (загоряються по одній), «про себе», фото робіт; у
 * кінці на аватарці — синя галочка «перевірено». Лапи — на боках
 * планшета, руки — від плечей; планшет ледь гойдається й дихає з котом.
 */
function holdLayers(lift, pivot) {
  const C = [690, 778]
  const cardLift = A(sway([...C, 0], [0, -5, 0], 90, OP), { spatial: true })
  const left = pawParts([552, 800], [1, 0])
  const right = pawParts([828, 800], [-1, 0])
  // Зірка рейтингу: сіра порожня, поверх — золота, що «загоряється».
  const STARS_AT = [20, 28, 36, 44, 52]
  const rating = STARS_AT.map((t, i) => {
    const x = 666 + i * 24
    return group(`star ${i}`, [
      group('gold', [star(0, 0, 5, 12, 5.5, 0, 6, 6), stroke(INK, 3), fill(GOLD)], {
        p: [x, 740],
        s: A([
          [t, [0, 0], 'out'],
          [t + 10, [100, 100]],
          [160, [100, 100], 'in'],
          [170, [0, 0]],
        ]),
      }),
      group('empty', [star(x, 740, 5, 12, 5.5, 0, 6, 6), fill(EMPTY)]),
    ])
  })
  const thumb = (x, color) =>
    group(`photo ${x}`, [
      group('glint', [star(x + 8, 836, 4, 8, 3, 0, 0, 25), fill(WHITE)]),
      group('photo', [rc(x, 842, 40, 32, 6), stroke(INK, 3), fill(color)]),
    ])
  const tablet = shapeLayer(
    'tablet',
    [
      silhouette('paw left', left.shapes, ORANGE, [group('lines', [...left.lines, stroke(INK, 7)])]),
      silhouette('paw right', right.shapes, ORANGE, [group('lines', [...right.lines, stroke(INK, 7)])]),
      // Галочка «перевірено» на аватарці.
      group(
        'verified',
        [group('tick', [line([[-6, 0], [-1, 5], [7, -5]]), stroke(WHITE, 4)]), group('badge', [el(0, 0, 24), stroke(INK, 4), fill(BLUE)])],
        {
          p: [636, 748],
          s: A([
            [64, [0, 0], 'out'],
            [76, [100, 100]],
            [160, [100, 100], 'in'],
            [168, [0, 0]],
          ]),
        },
      ),
      kitty(612, 724, 58),
      group('avatar', [el(612, 724, 64), stroke(INK, 4), fill(SKY)]),
      ...rating,
      group('name', [rc(712, 712, 118, 15, 7.5), fill(TEXT)]),
      group('about', [rc(690, 784, 176, 10, 5), rc(672, 802, 140, 10, 5), fill(LINE_GRAY)]),
      thumb(640, SKY),
      thumb(690, MINT_SOFT),
      thumb(740, SUN_SOFT),
      group('screen', [rc(690, 778, 262, 192, 12), fill(WHITE)]),
      group('camera', [el(690, 674, 6), fill(WHITE, 40)]),
      group('tablet', [rc(690, 778, 290, 222, 24), stroke(INK, LINE), fill(BEZEL)]),
    ],
    { p: cardLift, a: [...C, 0], r: A(sway(-3, 3, 180, OP)), op: OP },
  )
  const arms = shapeLayer(
    'arms',
    [
      tube('arm left', [[574, 688], [530, 742], [546, 800]], ORANGE, 44),
      tube('arm right', [[806, 688], [850, 742], [834, 800]], ORANGE, 44),
    ],
    { p: lift, a: [...pivot, 0], op: OP },
  )
  return [tablet, arms]
}

/**
 * Кубок із Champion.json у стилі кота: золоті частини — з контуром, ручки
 * під чашею (інакше їхні контури лягали б на чашу), замість червоної
 * зірки — білий знак Zunor з контуром (власник). `grip` — точка на ніжці,
 * за яку його тримає лапа.
 */
function trophy(at, scale) {
  const src = clone(champion.layers.find((l) => l.nm === 'Trophy'))
  const part = (nm) => src.shapes.find((g) => g.nm === nm)
  const outlined = (g) => {
    g.it.splice(g.it.findIndex((x) => x.ty === 'fl'), 0, stroke(INK, 21))
    return g
  }
  // Знак: контур статичний (очі — перший кадр, без кліпання), біла заливка.
  const mark = clone(zunorMark.layers[0].shapes[0])
  mark.it = mark.it.map((x) => (x.ty === 'sh' && x.ks.a === 1 ? { ...x, ks: K(x.ks.k[0].s[0]) } : x))
  const fl = mark.it.find((x) => x.ty === 'fl')
  fl.c = K([1, 1, 1, 1])
  mark.it.splice(mark.it.indexOf(fl), 0, stroke(INK, 44))
  mark.it[mark.it.length - 1] = tr({ a: [196, 205], p: [372, 664], s: [30, 30], r: -6 })
  mark.nm = 'zunor'
  return group(
    'trophy',
    [part('Group 1'), part('Group 2'), mark, outlined(part('Group 6')), outlined(part('Group 3')), outlined(part('Group 4'))],
    { a: [334, 822], p: at, s: [scale, scale] },
  )
}

/**
 * Права лапа з кубком: плече S, лапа P (рука вгору й убік, щоб кубок не
 * закривав морду). Кіт піднімає кубок і двічі ним «качає», далі ледь
 * погойдує. Лапа — поверх ніжки кубка, рука — під ним.
 */
function trophyArmLayer() {
  const S = [812, 700]
  const deg = -50
  const len = 240
  const d = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)]
  const n = [-d[1], d[0]]
  const at = (p, along, across) => [p[0] + d[0] * along + n[0] * across, p[1] + d[1] * along + n[1] * across]
  const P = at(S, len, 0)
  const paw = pawParts(P, [d[1], -d[0]])
  const armShapes = () => [
    el(S[0], S[1], 64),
    smooth([at(S, 0, 31), at(P, 0, 24), at(P, 0, -24), at(S, 0, -31)], { sharp: [0, 1, 2, 3] }).shape(),
  ]
  const bands = [0.4, 0.62].map((share) => {
    const c = at(S, len * share, 0)
    return line([at(c, -4, 21), at(c, 4, -21)])
  })
  const shine = group('shine', [star(0, 0, 4, 22, 8, 0, 0, 25), stroke(INK, 5), fill(WHITE)], {
    p: [P[0] + 112, P[1] - 222],
    s: twinkle([22, 70, 118], 30),
  })
  return shapeLayer(
    'trophy arm',
    [
      shine,
      silhouette('paw', paw.shapes, ORANGE, [group('lines', [...paw.lines, stroke(INK, 7)])]),
      trophy(P, 68),
      silhouette('arm', armShapes, ORANGE, [group('stripes', [...bands, stroke(ORANGE_DEEP, 11)])]),
    ],
    {
      p: A(sway([...S, 0], [0, -4, 0], 90, OP), { spatial: true }),
      a: [...S, 0],
      r: A([
        [0, 18],
        [12, 0, 'out'],
        [20, 9],
        [28, 0],
        [36, 9],
        [44, 0],
        [80, 4],
        [116, 0],
        [150, 4],
      ]),
      op: OP,
    },
  )
}

/** Щілина замка (сцена «Безпека») — сюди входить ключ. */
const KEYHOLE = [1070, 848]

/**
 * Ключ від чашечки лапи (0, 0) управо: вушко з дірочкою (відблиск
 * угорі — перебігає вниз, коли ключ перевертається), шийка, борідка із
 * зубцями знизу біля кінчика.
 */
function keyShapes() {
  const sharp = Array.from({ length: 13 }, (_, i) => i)
  return [
    group('shine', [line([[49, -25], [60, -27], [71, -23]]), stroke(WHITE, 6)]),
    group('collar', [rc(106, 0, 14, 32, 4), stroke(INK, 8), fill(GOLD_DEEP)]),
    // Дірочка — парно-непарною заливкою (r: 2), контур — по обох краях.
    group('bow', [el(58, 0, 80), el(58, 0, 26), stroke(INK, 8), { ...fill(GOLD), r: 2 }]),
    group('blade', [
      smooth(
        [[100, -9], [196, -9], [206, 0], [198, 9], [196, 9], [196, 22], [188, 22], [188, 15], [182, 15], [182, 22], [174, 22], [174, 9], [100, 9]],
        { sharp },
      ).shape(),
      stroke(INK, 8),
      fill(GOLD),
    ]),
  ]
}

/**
 * Поза «грабіжник»: права лапа тримає чужий ключ перед животом,
 * підносить до замка, вставляє (що за щілиною — ховає маска) і пробує
 * провернути — ключ упирається: лапа смикає двічі, потім щосили, ключ
 * ледь хитається (scaleY 100 → 74), — і виймає ні з чим. Рука — від
 * плеча S до лапи; її контур змінюється разом із рухом лапи (ті самі
 * кадри й криві).
 */
function keyArmLayers() {
  const S = [812, 700]
  const [kx, ky] = KEYHOLE
  const REST = [730, 826]
  const READY = [kx - 214, ky] // кінчик — біля щілини
  const IN = [kx - 170, ky] // зайшов на 36
  const moves = [
    [0, REST],
    [18, REST],
    [42, READY],
    [56, IN],
    [112, IN],
    [124, READY],
    [146, REST],
    [180, REST],
  ]
  const along = (p) => {
    const len = Math.hypot(p[0] - S[0], p[1] - S[1])
    const d = [(p[0] - S[0]) / len, (p[1] - S[1]) / len]
    const n = [-d[1], d[0]]
    return { len, at: (q, a, b) => [q[0] + d[0] * a + n[0] * b, q[1] + d[1] * a + n[1] * b] }
  }
  const forearm = (p) => {
    const { at } = along(p)
    return smooth([at(S, 0, 31), at(p, 0, 24), at(p, 0, -24), at(S, 0, -31)], { sharp: [0, 1, 2, 3] })
  }
  const band = (share) => (p) => {
    const { at, len } = along(p)
    const c = at(S, len * share, 0)
    return smooth([at(c, -4, 21), at(c, 4, -21)], { closed: false })
  }
  const track = (nm, make) => morph(nm, moves.map(([t, p]) => [t, make(p)]))
  const arm = shapeLayer(
    'key arm',
    [
      silhouette('arm', () => [el(S[0], S[1], 64), track('forearm', forearm)], ORANGE, [
        group('stripes', [track('band 1', band(0.4)), track('band 2', band(0.62)), stroke(ORANGE_DEEP, 11)]),
      ]),
    ],
    { op: OP },
  )

  const at = A(moves, { spatial: true })
  const paw = pawParts([0, 0], [1, 0])
  const pawLayer = shapeLayer('key paw', [silhouette('paw', paw.shapes, ORANGE, [group('lines', [...paw.lines, stroke(INK, 7)])])], {
    p: at,
    // Смикає двічі, озирається, ще раз — щосили.
    r: A([
      [0, 0],
      [58, 0],
      [63, 18],
      [68, -2],
      [73, 18],
      [78, 0],
      [100, 0],
      [104, 26],
      [109, 0],
      [180, 0],
    ]),
    op: OP,
  })
  // Маска: видно лише те, що лівіше щілини.
  const matte = shapeLayer('key matte', [group('visible', [rc(kx - 500, ky, 1000, 900, 0), fill(WHITE)])], { op: OP, td: 1 })
  const key = shapeLayer('key', keyShapes(), {
    p: at,
    s: A([
      [0, [100, 100]],
      [58, [100, 100]],
      [63, [100, 74]],
      [68, [100, 100]],
      [73, [100, 74]],
      [78, [100, 100]],
      [100, [100, 100]],
      [104, [100, 66]],
      [109, [100, 100]],
      [180, [100, 100]],
    ]),
    op: OP,
    tt: 1,
  })
  return [pawLayer, matte, key, arm]
}

/**
 * Навісний замок поруч із котом: синій корпус, сталева дужка, щілина.
 * Кіт смикає ключ — дужка смикається вгору й одразу назад: тримає.
 */
function padlock() {
  const [x, y] = KEYHOLE
  const shackle = () =>
    new Path()
      .move(x - 60, y - 30)
      .line(x - 60, y - 148)
      .quarter(x, y - 208, x - 60, y - 208)
      .quarter(x + 60, y - 148, x + 60, y - 208)
      .line(x + 60, y - 30)
      .shape()
  const rattle = A([
    [0, [0, 0]],
    [58, [0, 0]],
    [63, [0, -5]],
    [68, [0, 0]],
    [73, [0, -5]],
    [78, [0, 0]],
    [100, [0, 0]],
    [104, [0, -7]],
    [109, [0, 0]],
    [180, [0, 0]],
  ])
  return shapeLayer(
    'padlock',
    [
      group('keyhole', [
        group('hole', [el(x, y, 32), fill(INK)]),
        group('slot', [smooth([[x - 7, y + 8], [x + 7, y + 8], [x + 12, y + 42], [x - 12, y + 42]], { sharp: [0, 1, 2, 3] }).shape(), fill(INK)]),
      ]),
      group('shine', [rc(x - 66, y + 14, 14, 92, 7), fill(WHITE, 35)]),
      group('body', [rc(x, y + 18, 184, 148, 30), stroke(INK, LINE), fill(BLUE)]),
      group('shackle', [group('fill', [shackle(), stroke(STEEL_DARK, 26)]), group('outline', [shackle(), stroke(INK, 26 + LINE * 2)])], { p: rattle }),
    ],
    { op: OP },
  )
}

/** Котяча мордочка-аватарка. */
function kitty(x, y, d) {
  const r = d / 2
  const ear = (dir) =>
    smooth(
      [
        [x + dir * r * 0.95, y - r * 0.2],
        [x + dir * r * 0.85, y - r * 1.12],
        [x + dir * r * 0.25, y - r * 0.8],
      ],
      { sharp: [0, 1, 2] },
    ).shape()
  return group('kitty', [
    group('eyes', [el(x - r * 0.36, y - r * 0.02, d * 0.14), el(x + r * 0.36, y - r * 0.02, d * 0.14), fill(INK)]),
    group('nose', [el(x, y + r * 0.24, d * 0.12, d * 0.08), fill(INK)]),
    group('face', [el(x, y + r * 0.08, d * 0.86), stroke(INK, 4), fill(ORANGE)]),
    group('ears', [ear(-1), ear(1), stroke(INK, 4), fill(ORANGE)]),
  ])
}

// ——— Пози ———————————————————————————————————————————————————————

const HELLO = {
  pivot: [690, 640],
  // Ледь хилить голову то в один бік, то в інший.
  tilt: sway(-2.5, 5, 180, OP),
  // Дивиться вгору (на хмаринку), раз — на людину.
  look: [
    [0, [628, 424], [756, 428]],
    [60, [628, 424], [756, 428]],
    [68, [622, 438], [752, 440]],
    [100, [622, 438], [752, 440]],
    [108, [628, 424], [756, 428]],
    [180, [628, 424], [756, 428]],
  ],
  blinkAt: [40, 112],
  twitch: { left: 70, right: 140 },
}

// Ліворуч відро (кадри 0–40), праворуч пульверизатор (52–95), далі
// вгору — думає (106–166), і знову ліворуч.
const LEFT = [[611, 437], [747, 439]]
const RIGHT = [[633, 437], [769, 439]]
const UP = [[624, 423], [758, 427]]
const THINK = {
  pivot: [744, 646],
  tilt: [
    [0, -4],
    [40, -4],
    [54, 4],
    [95, 4],
    [108, 0],
    [166, 0],
    [178, -4],
    [180, -4],
  ],
  look: [
    [0, ...LEFT],
    [40, ...LEFT],
    [50, ...RIGHT],
    [95, ...RIGHT],
    [104, ...UP],
    [166, ...UP],
    [176, ...LEFT],
    [180, ...LEFT],
  ],
  blinkAt: [44, 150],
  twitch: { left: 14, right: 64 },
  mouth: 'hmm',
  brows: true,
  chinPaw: true,
}

// Дивиться на людину, підморгує, раз зиркає на своє фото.
const AHEAD = [[622, 437], [758, 439]]
const DOWN = [[622, 444], [758, 446]]
const SHOW = {
  pivot: [690, 640],
  tilt: sway(-3, 6, 180, OP),
  look: [
    [0, ...AHEAD],
    [116, ...AHEAD],
    [124, ...DOWN],
    [146, ...DOWN],
    [154, ...AHEAD],
    [180, ...AHEAD],
  ],
  blinkAt: [40, 160],
  wink: 84,
  twitch: { left: 60, right: 130 },
  hold: true,
}

// Переміг: піднімає кубок, очі щасливо зажмурені, хвіст метляє.
const CHAMP = {
  pivot: [690, 640],
  tilt: [
    [0, 0],
    [12, 5],
    [30, 1],
    [48, 5],
    [66, 1],
    [84, 5],
    [102, 1],
    [120, 4],
    [180, 4],
  ],
  look: [
    [0, [630, 425], [766, 428]],
    [180, [630, 425], [766, 428]],
  ],
  blinkAt: [],
  joy: 12,
  twitch: { left: 24, right: 52 },
  raise: true,
  tailWag: 30,
}

// Грабіжник: озирається ліворуч-праворуч, береться за замок (брови
// насуплені, рот — хитрий), посеред спроби зиркає на людину; не вийшло
// — дивиться на людину розгублено: брови «будиночком», двічі кліпає,
// стікає крапля поту. Наприкінці — знову озирається (петля).
const AT_LOCK = [[633, 443], [769, 445]]
const SLY = [[586, 358], [616, 360], [646, 374]]
const SLY_R = [[734, 374], [764, 360], [794, 358]]
const SAD = [[586, 374], [616, 360], [646, 350]]
const SAD_R = [[734, 350], [764, 360], [794, 374]]
const LOCK = {
  pivot: [690, 640],
  tilt: [
    [0, 0],
    [20, 0],
    [42, 6],
    [116, 6],
    [134, -3],
    [166, -3],
    [180, 0],
  ],
  look: [
    [0, ...LEFT],
    [8, ...LEFT],
    [13, ...RIGHT],
    [20, ...RIGHT],
    [26, ...AT_LOCK],
    [84, ...AT_LOCK],
    [88, ...AHEAD],
    [96, ...AHEAD],
    [100, ...AT_LOCK],
    [118, ...AT_LOCK],
    [128, ...AHEAD],
    [166, ...AHEAD],
    [174, ...LEFT],
    [180, ...LEFT],
  ],
  blinkAt: [140, 152],
  twitch: { left: 106, right: 64 },
  mouth: 'hmm',
  mask: true,
  browKeys: [
    [0, SLY, SLY_R],
    [114, SLY, SLY_R],
    [124, SAD, SAD_R],
    [164, SAD, SAD_R],
    [176, SLY, SLY_R],
    [180, SLY, SLY_R],
  ],
  sweat: 126,
  key: true,
}

// ——— Речі ——————————————————————————————————————————————————————

/** Знак питання-наліпка: білий із контуром; вилазить і ховається. */
function question(nm, x, y, size, rot, from, to) {
  return group(
    nm,
    [
      group('dot', [el(0, 40, 20), stroke(INK, 7), fill(WHITE)]),
      tube('hook', [[-20, -22], [-14, -42], [4, -50], [22, -40], [22, -20], [6, -8], [0, 6], [0, 16]], WHITE, 11),
    ],
    {
      p: [x, y],
      r: A([
        [from, rot - 8],
        [from + 30, rot + 6],
        [to, rot - 4],
      ]),
      s: A([
        [from, [0, 0], 'out'],
        [from + 10, [size, size]],
        [to - 10, [size, size], 'in'],
        [to, [0, 0]],
      ]),
    },
  )
}

/** «Підіймається», поки кіт на нього дивиться. */
const considered = (base, keys) =>
  A(
    keys.map(([t, up]) => [t, [base[0], base[1] - (up ? 14 : 0), 0]]),
    { spatial: true },
  )

/** Відро з піною й шваброю (ліворуч). */
function bucket() {
  const base = [250, 945]
  return shapeLayer(
    'bucket',
    [
      group('foam', [el(212, 814, 34), el(244, 804, 42), el(278, 812, 34), el(304, 820, 22), stroke(INK, 6), fill(WHITE)]),
      tube('mop', [[266, 816], [182, 612]], WOOD, 12),
      group('water', [el(250, 826, 128, 18), fill(BLUE_DEEP)]),
      group('rim', [el(250, 826, 160, 34), stroke(INK, 9), fill(BLUE)]),
      group('handle', [line([[186, 834], [204, 782], [250, 764], [296, 782], [314, 834]]), stroke(INK, 8)]),
      group('shine', [rc(212, 884, 12, 74, 6), fill(WHITE, 35)]),
      group('body', [smooth([[182, 828], [318, 828], [304, 942], [196, 942]], { sharp: [0, 1, 2, 3] }).shape(), stroke(INK, LINE), fill(BLUE)]),
    ],
    {
      a: base,
      p: considered(base, [
        [0, true],
        [40, true],
        [50, false],
        [168, false],
        [180, true],
      ]),
      op: OP,
    },
  )
}

/** Пульверизатор і губка (праворуч). */
function spray() {
  const base = [1060, 945]
  return shapeLayer(
    'spray',
    [
      group('sponge holes', [el(1128, 934, 10, 7), el(1158, 940, 12, 8), el(1180, 930, 9, 6), fill(SPONGE_DEEP)]),
      group('sponge top', [rc(1152, 902, 96, 20, 8), stroke(INK, 8), fill(MINT_DEEP)]),
      group('sponge', [rc(1152, 926, 96, 40, 12), stroke(INK, LINE), fill(SPONGE)]),
      group('trigger', [smooth([[1000, 790], [984, 800], [980, 826], [992, 830], [998, 808], [1012, 794]], { sharp: [0, 5] }).shape(), stroke(INK, 8), fill(WHITE)]),
      group('nozzle', [rc(968, 766, 30, 20, 6), stroke(INK, 8), fill(STEEL)]),
      group('head', [rc(1030, 770, 108, 44, 14), stroke(INK, LINE), fill(WHITE)]),
      group('neck', [rc(1040, 802, 46, 28, 8), stroke(INK, 8), fill(STEEL)]),
      group('label star', [star(1040, 888, 4, 18, 6, 0, 0, 25), fill(MINT_DEEP)]),
      group('label', [rc(1040, 888, 66, 56, 12), fill(WHITE)]),
      group('shine', [rc(1006, 880, 10, 80, 5), fill(WHITE, 35)]),
      group('body', [rc(1040, 880, 104, 130, 26), stroke(INK, LINE), fill(MINT)]),
    ],
    {
      a: base,
      p: considered(base, [
        [0, false],
        [50, false],
        [60, true],
        [94, true],
        [104, false],
        [180, false],
      ]),
      op: OP,
    },
  )
}

// ——— Сцени ——————————————————————————————————————————————————————

function scene(nm, layers, frame, { assets = [], op = OP } = {}) {
  return {
    v: '5.9.6',
    fr: FR,
    ip: 0,
    op,
    w: frame.w,
    h: frame.h,
    nm,
    ddd: 0,
    assets: [{ id: 'scene', nm: 'scene', fr: FR, layers }, ...assets],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 0,
        nm: 'scene',
        refId: 'scene',
        sr: 1,
        ks: { o: K(100), r: K(0), p: K([0, 0, 0]), a: K([frame.x, frame.y, 0]), s: K([100, 100, 100]) },
        ao: 0,
        w: 1400,
        h: 1100,
        ip: 0,
        op: Math.max(OP, op),
        st: 0,
        bm: 0,
      },
    ],
    markers: [],
  }
}

/** Майстер, «Познайомимось»: сидить і вітається (хмаринку малює застосунок). */
function helloScene() {
  const cat = sittingCat(HELLO)
  return scene('cat-hello', [...cat.top, cat.shadow], { x: 320, y: 290, w: 740, h: 690 })
}

/** Майстер, «Яку роботу берете»: думає, що обрати. */
function thinkScene() {
  const cat = sittingCat(THINK)
  const marks = shapeLayer(
    'questions',
    [
      question('q left', 432, 414, 125, -14, 108, 170),
      question('q small', 372, 332, 72, -22, 128, 174),
      question('q right', 952, 396, 108, 12, 118, 172),
    ],
    { op: OP },
  )
  const shadows = shapeLayer('prop shadows', [group('shadows', [el(250, 948, 190, 24), el(1090, 948, 260, 24), fill(INK, 10)])], { op: OP })
  return scene('cat-think', [marks, ...cat.top, bucket(), spray(), cat.shadow, shadows], { x: 155, y: 290, w: 1070, h: 690 })
}

// ——— Запис ——————————————————————————————————————————————————————

/** Округлення: файли легші, точності вистачає. */
function compact(o) {
  return JSON.stringify(o, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))
}

/** Майстер, «Покажіть себе клієнтам»: показує свій профіль на планшеті. */
function showScene() {
  const cat = sittingCat(SHOW)
  const sparkle = (nm, x, y, r, at) =>
    group(nm, [star(0, 0, 4, r, r * 0.38, 0, 0, 25), stroke(INK, 6), fill(GOLD)], { p: [x, y], s: twinkle(at, 30) })
  const sparks = shapeLayer('sparkles', [sparkle('s left', 470, 640, 26, [70, 150]), sparkle('s right', 912, 600, 22, [8, 112])], { op: OP })
  return scene('cat-show', [sparks, ...cat.top, cat.shadow], { x: 320, y: 290, w: 740, h: 690 })
}

/**
 * Анкету надіслано / профіль створено: кіт на весь екран піднімає кубок,
 * з боків вибухає конфеті й сиплеться згори (конфеті — з Champion.json, як
 * є). Грається один раз (5 с); застосунок показує ~4 с і йде далі.
 */
function championScene() {
  const cat = sittingCat(CHAMP)
  const FRAME = { x: 190, y: 0, w: 1000, h: 1000 }
  // Ассети конфеті — під своїми іменами (у сцені вже є 'scene').
  const ids = { comp_0: 'confetti_top', comp_1: 'confetti_side', comp_2: 'confetti_burst' }
  const assets = champion.assets
    .filter((a) => ids[a.id])
    .map((a) => {
      const c = clone(a)
      c.id = ids[a.id]
      for (const l of c.layers) if (l.refId && ids[l.refId]) l.refId = ids[l.refId]
      return c
    })
  // Шари конфеті — у тому ж місці відносно кадру, що й у Champion.
  const confetti = ['Confetti top', 'Confetti 2', 'Confetti'].map((nm, i) => {
    const l = clone(champion.layers.find((x) => x.nm === nm))
    l.refId = ids[l.refId]
    l.ind = 1100 + i
    const p = l.ks.p.k
    l.ks.p = K([p[0] + FRAME.x, p[1] + FRAME.y, p[2] ?? 0])
    return l
  })
  return scene('cat-champion', [...confetti, ...cat.top, cat.shadow], FRAME, { assets, op: 150 })
}

/** «Безпека» в налаштуваннях: грабіжник не може відімкнути замок. */
function lockScene() {
  const cat = sittingCat(LOCK)
  const sparkle = (nm, x, y, r, at) =>
    group(nm, [star(0, 0, 4, r, r * 0.38, 0, 0, 25), stroke(INK, 6), fill(GOLD)], { p: [x, y], s: twinkle(at, 30) })
  const sparks = shapeLayer('sparkles', [sparkle('s right', 1160, 668, 24, [128, 152]), sparkle('s left', 984, 690, 16, [140])], { op: OP })
  const shadow = shapeLayer('lock shadow', [group('shadow', [el(1070, 946, 240, 24), fill(INK, 10)])], { op: OP })
  return scene('cat-lock', [sparks, ...cat.top, padlock(), cat.shadow, shadow], { x: 320, y: 290, w: 870, h: 690 })
}

// ——— «Вигляд»: кіт у різних стилях ————————————————————————————————

const DRESS_TOTAL = 240 // 8 с: три стилі по 80 кадрів
/** Кадри, коли кіт міняє стиль (240 — це знову 0). */
const SWAPS = [80, 160, 240]
const RING = '#a1a1aa'
const STEEL_LIGHT = '#dfe4ea'

/** Брови «суворо»: внутрішні кінці опущені. */
const angryBrows = () => group('brows', [line([[584, 356], [616, 360], [648, 378]]), line([[732, 378], [764, 360], [796, 356]]), stroke(INK, 11)])

/** Шипи від маківки назовні: `[кут, довжина назовні, ширина основи]`; основи — за головою. */
function spikes(list, color, shine) {
  const C = [690, 480]
  return list.map(([deg, len, w]) => {
    const a = (deg * Math.PI) / 180
    const d = [Math.cos(a), Math.sin(a)]
    const n = [-d[1], d[0]]
    const b = [C[0] + 215 * d[0] * 0.92, C[1] + 150 * d[1] * 0.92]
    const t = [b[0] + d[0] * len, b[1] + d[1] * len]
    const k = (q) => [b[0] + (t[0] - b[0]) * q + n[0] * w * 0.08, b[1] + (t[1] - b[1]) * q + n[1] * w * 0.08]
    return group(`spike ${deg}`, [
      ...(shine ? [group('shine', [line([k(0.2), k(0.7)]), stroke(shine, 6)])] : []),
      group('spike', [
        smooth([[b[0] - (n[0] * w) / 2, b[1] - (n[1] * w) / 2], t, [b[0] + (n[0] * w) / 2, b[1] + (n[1] * w) / 2]], { sharp: [0, 1, 2] }).shape(),
        stroke(INK, LINE),
        fill(color),
      ]),
    ])
  })
}

// Леопард: золотий у розетках, кільця на хвості, ікла, суворі брови.
const SPOT = '#3a1d0c'
const LEOPARD_FUR = { base: '#f6b630', light: '#fff0c4', dark: '#f6b630', deep: '#f6b630', ear: '#6b3410', bands: [SPOT, SPOT, SPOT] }
/** Розетка — уривчасте темне кільце довкола темнішого золота. */
const rosette = (x, y, r) => group(`rosette ${x}`, [el(x, y, r * 2, r * 1.7), dashed(stroke(SPOT, 8), r * 0.9, r * 0.5), fill('#e0951b')])
const spot = (x, y, r) => group(`spot ${x}`, [el(x, y, r * 2, r * 1.8), fill(SPOT)])
function leopardCostume() {
  return {
    front: [
      angryBrows(),
      group('fangs', [
        smooth([[628, 524], [654, 530], [643, 562]], { sharp: [0, 1, 2] }).shape(),
        smooth([[700, 535], [724, 533], [714, 563]], { sharp: [0, 1, 2] }).shape(),
        stroke(INK, 5),
        fill(WHITE),
      ]),
    ],
    paint: [
      // Лоб зайнятий бровами — розетки на скронях, між бровами — цятка.
      spot(690, 360, 8),
      rosette(526, 410, 14),
      rosette(856, 412, 14),
      rosette(518, 470, 18),
      rosette(862, 474, 17),
      spot(540, 548, 9),
      spot(562, 582, 7),
      spot(838, 548, 9),
      spot(818, 584, 7),
    ],
    coat: [
      rosette(532, 700, 22),
      rosette(848, 700, 22),
      rosette(522, 842, 22),
      rosette(858, 842, 22),
      spot(586, 772, 9),
      spot(796, 772, 9),
      spot(482, 884, 8),
      spot(898, 884, 8),
    ],
  }
}

// Рокер: червоний, без вух, бірюзовий ірокез-шипи, нашийник із шипами,
// блискавка через око, кільце в носі.
const ROCKER_FUR = { base: '#e8303f', light: '#ff8f93', dark: '#b3132b', deep: '#c41d34', ear: '#7a0f1f' }
function rockerCostume() {
  // Нижній край нашийника — для шипів.
  const collarY = (x) => 684 + 28 * (1 - ((x - 690) / 102) ** 2)
  return {
    noEars: true,
    back: spikes(
      [
        [-90, 150, 60],
        [-110, 124, 52],
        [-70, 124, 52],
        [-130, 92, 44],
        [-50, 92, 44],
      ],
      '#25e2e8',
      '#b2fcff',
    ),
    front: [
      angryBrows(),
      // Кільце в носі: сталь із контуром.
      group('septum', [el(697, 500, 22), stroke(STEEL_LIGHT, 5)]),
      group('septum outline', [el(697, 500, 22), stroke(INK, 11)]),
    ],
    paint: [
      group('bolt', [
        smooth([[586, 352], [632, 352], [612, 416], [642, 416], [588, 526], [602, 448], [572, 448]], { sharp: [0, 1, 2, 3, 4, 5, 6] }).shape(),
        stroke(INK, 6),
        fill('#ffd23f'),
      ]),
    ],
    neck: [
      group('studs', [
        ...[612, 651, 690, 729, 768].map((x) => {
          const y = collarY(x) - 4
          return smooth([[x - 12, y], [x + 12, y], [x, y + 28]], { sharp: [0, 1, 2] }).shape()
        }),
        stroke(INK, 5),
        fill(STEEL_LIGHT),
      ]),
      group('collar', [smooth([[588, 648], [690, 674], [792, 648], [794, 684], [690, 712], [586, 684]], { sharp: [0, 2, 3, 5] }).shape(), stroke(INK, 8), fill('#24202b')]),
    ],
  }
}

// Лев: пісочний, темно-фіолетова грива (зверху пласкіша — не ховає
// кружечки), китиця на хвості, шрам через око.
const LION_FUR = { base: '#e8a64a', light: '#ffe2ae', dark: '#c47a24', deep: '#d48d35', ear: '#6b3410' }
const MANE = '#3b1772'
const MANE_MID = '#6230c4'
function maneShape(rx, ry, ryTop, wave, n = 18) {
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    const out = i % 2 === 0 ? 1 : 1 - wave
    const ryA = Math.sin(a) < 0 ? ryTop : ry
    pts.push([690 + rx * out * Math.cos(a), 492 + ryA * out * Math.sin(a)])
  }
  return smooth(pts).shape()
}
function lionCostume() {
  const scar = [[800, 366], [778, 420], [758, 474], [742, 508]]
  return {
    back: [group('mane mid', [maneShape(262, 210, 170, 0.1), fill(MANE_MID)]), group('mane', [maneShape(300, 240, 200, 0.1), stroke(INK, LINE), fill(MANE)])],
    front: [angryBrows()],
    paint: [
      group('stitches', [line([[782, 378], [804, 390]]), line([[766, 408], [790, 420]]), line([[746, 490], [768, 500]]), stroke(INK, 5)]),
      group('scar', [line(scar), stroke('#ffd2cc', 9)]),
      group('scar outline', [line(scar), stroke(INK, 15)]),
    ],
    tail: [group('tuft', [smooth([[404, 706], [394, 674], [412, 640], [436, 618], [448, 648], [464, 672], [454, 704], [430, 716]]).shape(), stroke(INK, LINE), fill(MANE)])],
  }
}

/** Поза для «Вигляду»: дивиться вгору на кружечки, поки ті крутяться; на зміні — кліп. */
const DRESS = {
  pivot: [690, 640],
  tilt: sway(-2.5, 5, 80, DRESS_TOTAL),
  look: [
    [0, ...UP],
    [6, ...AHEAD],
    ...SWAPS.flatMap((s) => [
      [s - 18, ...AHEAD],
      [s - 14, ...UP],
    ]),
    ...SWAPS.slice(0, -1).flatMap((s) => [
      [s, ...UP],
      [s + 6, ...AHEAD],
    ]),
  ].sort((a, b) => a[0] - b[0]),
  // Очі заплющуються перед зміною й розплющуються вже в новому стилі.
  blinkKeys: [
    [0, [100, 8]],
    [4, [100, 100]],
    ...SWAPS.flatMap((s) => [
      [s - 7, [100, 100]],
      [s - 4, [100, 8]],
      ...(s < DRESS_TOTAL
        ? [
            [s, [100, 8]],
            [s + 4, [100, 100]],
          ]
        : [[s, [100, 8]]]),
    ]),
  ],
  twitch: { left: 50, right: 124 },
  total: DRESS_TOTAL,
  breathe: 80,
  tailWag: 80,
}

/**
 * «Вигляд» у налаштуваннях (власник, як качка в Telegram): за спиною кота
 * — ряд великих кольорових кружечків, трохи за головою; обраний — у
 * кільці по центру. Ряд прокручується на один, кіт заплющує очі — і вже
 * в новому стилі: леопард (ікла, розетки) → рокер (червоний, без вух,
 * ірокез, нашийник із шипами) → лев (фіолетова грива, шрам). Кольори
 * кружечків — просто яскраві, не акценти. Кожен стиль — окремий кіт у
 * своїй підкомпозиції, видимий лише свої 80 кадрів; на зміні кіт ледь
 * «вдихає» (96 %) і спалахують іскри.
 */
function dressScene() {
  const total = DRESS_TOTAL
  const styles = [
    { id: 'leopard', dot: '#ffc21a', fur: LEOPARD_FUR, costume: leopardCostume() },
    { id: 'rocker', dot: '#ff2e4d', fur: ROCKER_FUR, costume: rockerCostume() },
    { id: 'lion', dot: '#6a33e0', fur: LION_FUR, costume: lionCostume() },
  ]
  const full = [100, 100, 100]
  const small = [96, 96, 100]
  const pulse = A([
    [0, small, 'out'],
    [8, full],
    ...SWAPS.flatMap((s) => [[s - 8, full, 'in'], ...(s < total ? [[s, small, 'out'], [s + 8, full]] : [[s, small]])]),
  ])
  const assets = styles.map((st) => ({
    id: `cat_${st.id}`,
    nm: `cat ${st.id}`,
    fr: FR,
    layers: sittingCat({ ...DRESS, fur: st.fur, costume: st.costume }).top,
  }))
  const cats = styles.map((st, i) => ({
    ddd: 0,
    ind: 1200 + i,
    ty: 0,
    nm: `cat ${st.id}`,
    refId: `cat_${st.id}`,
    sr: 1,
    ks: { o: K(100), r: K(0), p: K([690, 944, 0]), a: K([690, 944, 0]), s: pulse },
    ao: 0,
    w: 1400,
    h: 1100,
    ip: i === 0 ? 0 : SWAPS[i - 1],
    op: SWAPS[i],
    st: 0,
    bm: 0,
  }))

  // Кружечки: нескінченна стрічка кольорів, по центру — кільце; низ ряду
  // заходить за голову й вуха. Видно три; той, що виїжджає з краю,
  // виростає, той, що їде за край, — меншає.
  const C = [690, 268]
  const GAP = 170
  const steps = [0, ...SWAPS.flatMap((s) => [s - 14, s - 2]), total]
  const shiftAt = steps.map((_, i) => Math.floor(i / 2))
  const dots = []
  for (let k = -1; k <= styles.length + 1; k++) {
    const color = styles[((k % styles.length) + styles.length) % styles.length].dot
    const rel = steps.map((t, i) => [t, k - shiftAt[i]])
    dots.push(
      group(`dot ${k}`, [el(0, 0, 84), stroke(INK, 7), fill(color)], {
        p: A(rel.map(([t, r]) => [t, [C[0] + r * GAP, C[1]]])),
        s: A(rel.map(([t, r]) => [t, Math.abs(r) <= 1 ? [100, 100] : [0, 0]])),
      }),
    )
  }
  const picker = shapeLayer('picker', [group('ring', [el(C[0], C[1], 128), stroke(RING, 8)]), ...dots], { op: total })

  const sparkle = (nm, x, y, r) =>
    group(nm, [star(0, 0, 4, r, r * 0.38, 0, 0, 25), stroke(INK, 6), fill(GOLD)], { p: [x, y], s: twinkle([0, ...SWAPS.slice(0, -1)], 22) })
  const sparks = shapeLayer('sparkles', [sparkle('s left', 430, 430, 24), sparkle('s right', 952, 420, 20), sparkle('s low', 948, 610, 15)], { op: total })
  const shadow = sittingCat({ ...DRESS }).shadow

  return scene('cat-dress', [sparks, ...cats, picker, shadow], { x: 330, y: 176, w: 680, h: 804 }, { assets, op: total })
}

const scenes = { hello: helloScene, think: thinkScene, show: showScene, champion: championScene, lock: lockScene, dress: dressScene }
const only = process.argv[2]
for (const [id, make] of Object.entries(scenes)) {
  if (only && only !== id) continue
  const file = join(process.argv[3] ?? outDir, `cat-${id}.json`)
  writeFileSync(file, compact(make()))
  console.log('→', file)
}
