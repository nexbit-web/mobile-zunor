import MaskedViewClass from '@react-native-masked-view/masked-view'
import { BlurView } from 'expo-blur'
import {
  createContext,
  useContext,
  useId,
  type ComponentType,
  type ReactElement,
} from 'react'
import { Platform, useColorScheme, View, type ViewProps } from 'react-native'
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { useColors } from '@/lib/theme'

// Типи пакета написані під старі @types/react: клас не проходить як
// JSX-компонент, хоч сам він робочий (ним користується й expo-router).
const MaskedView = MaskedViewClass as unknown as ComponentType<
  ViewProps & { maskElement: ReactElement }
>

// expo-blur сам підтримує анімацію `intensity` через Reanimated.
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

/**
 * Наскільки сторінка відʼїхала від бічної панелі (0 — на місці, 1 —
 * панель відкрита) — дає DrawerScene. Поки сторінка їде, розмиття
 * (FadingBlur; тепер лише під полем розмови з Zunor — шапка без
 * розмиття) гасне: iOS-розмиття біля лівого краю бере й те, що поза
 * сторінкою, і розмазувало її чіткий край і заокруглений кут (власник).
 * Без панелі — `null`, розмиття як завжди.
 */
export const PageShift = createContext<SharedValue<number> | null>(null)

const FILL = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const

/** Точки кривої: [місце від верху смуги 0…1, щільність 0…1]. */
type Curve = [number, number][]

/**
 * Тло шапки — те саме, що під нижньою панеллю (DockFade), дзеркально
 * (власник): зміст, що заходить під шапку, плавно темнішає (у світлій
 * темі — світлішає) до самого верху екрана. Лише затемнення кольором
 * фону, без розмиття. Угорі — щільно (1), до середини шапки майже
 * щільно, далі рівно тане; 0.78 і 0.9 власникові було слабко («ще
 * жорсткіше»). Біля низу шапки зміст ще чіткий, межі немає.
 *
 * Історія: спершу було розмиття чотирма шарами BlurView під масками
 * (як у Telegram) з легким затемненням; потім удвічі слабше розмиття
 * («менш жорстко», назва тепер ліворуч); тепер — як унизу, без
 * розмиття. Раніше власник відкидав і щільну заливку з коротким
 * згасанням («жорстко»), і майже щільне затемнення угорі (зміст угорі
 * зникав) — тож угорі не до кінця й згасання довге.
 */
/**
 * На скільки згасання шапки сягає нижче її краю: зміст починає тонути
 * раніше, ще до назви (власник: «щоб починався чуть раньше»).
 */
const HEADER_LEAD = 24

const HEADER_DIM: Curve = [
  [0, 1],
  [0.25, 0.96],
  [0.5, 0.84],
  [0.72, 0.58],
  [0.88, 0.24],
  [1, 0],
]

/**
 * Затемнення в колір фону під полем розмови (FooterBlur, разом із
 * розмиттям): біля краю — майже щільно, далі — зміст ще видно, у нуль.
 */
const DIM: Curve = [
  [0, 0.94],
  [0.35, 0.82],
  [0.6, 0.58],
  [0.8, 0.3],
  [0.93, 0.08],
  [1, 0],
]

/**
 * Розмиття — двома шарами, бо радіус у BlurView один: легке береться вже
 * під назвою, сильне — ближче до статус-бару. Разом розмиття росте до
 * верху, а не просто проявляється одне й те саме.
 */
const SOFT: Curve = [
  [0, 1],
  [0.55, 1],
  [1, 0],
]
const HARD: Curve = [
  [0, 1],
  [0.25, 1],
  [0.7, 0],
]

/** Крива догори дриґом — для смуги знизу екрана. */
const flip = (curve: Curve): Curve =>
  curve
    .map(([offset, alpha]): [number, number] => [1 - offset, alpha])
    .reverse()

/** Градієнт кривої `curve` кольору `color` на всю висоту view. */
function Ramp({ curve, color }: { curve: Curve; color: string }) {
  // Кілька градієнтів живуть одночасно (стек) — id не мають збігатися
  // (у браузері вони спільні на весь документ).
  const id = `ramp${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    // Розмір — і явно: без width/height полотно SVG могло лишитись
    // нульовим, і тло під полем розмови пропадало (власник).
    <Svg
      style={FILL}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {curve.map(([offset, alpha]) => (
            <Stop
              key={offset}
              offset={String(offset)}
              stopColor={color}
              stopOpacity={alpha}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  )
}

/**
 * Розмиття, яке тане за кривою `curve` (маска — той самий градієнт).
 * Сторінка відʼїжджає (PageShift) — гасне вже за першу чверть руху, за
 * пальцем; повертається — так само зʼявляється.
 */
function FadingBlur({ curve, intensity }: { curve: Curve; intensity: number }) {
  const dark = useColorScheme() === 'dark'
  const shift = useContext(PageShift)
  const animated = useAnimatedProps(() => ({
    intensity: shift ? intensity * Math.max(0, 1 - shift.get() * 4) : intensity,
  }))
  return (
    <MaskedView
      pointerEvents="none"
      style={FILL}
      maskElement={
        <View style={FILL}>
          <Ramp curve={curve} color="#000000" />
        </View>
      }
    >
      <AnimatedBlurView
        tint={dark ? 'dark' : 'light'}
        intensity={intensity}
        animatedProps={animated}
        style={FILL}
      />
    </MaskedView>
  )
}

/**
 * Тло шапки (HEADER_DIM): зміст заходить під шапку й до самого верху
 * плавно темнішає (у світлій темі — світлішає), як під нижньою панеллю.
 * Біля низу шапки — ще чіткий, тож межі-лінії немає. Кнопки на
 * непрозорих підкладках, назва — поверх, тож вони лишаються чіткими.
 *
 * `height` — від верху екрана до низу шапки (у SwipeTabs — трохи нижче
 * перемикача); згасання сягає ще на `lead` pt нижче (HEADER_LEAD), щоб
 * зміст починав тонути раніше, ще до назви в шапці (власник). Дотиків
 * не бере.
 */
export function HeaderFade({
  height,
  color,
  lead = HEADER_LEAD,
}: {
  height: number
  /** Тло сторінки, якщо воно не звичайне (заявка — колір картки). */
  color?: string
  /** На скільки згасання сягає нижче `height`. */
  lead?: number
}) {
  const c = useColors()
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: height + lead,
      }}
    >
      <Ramp curve={HEADER_DIM} color={color ?? c.background} />
    </View>
  )
}

/**
 * Під нижньою панеллю розділів (BottomDock, власник): зміст, що заходить
 * під панель, — картка чи текст, — плавно темнішає (у світлій темі —
 * світлішає) до самого низу екрана. Лише затемнення кольором фону, без
 * розмиття. Смуга — від `lead` pt над панеллю до низу екрана (`height`
 * усього); над смугою зміст чіткий. Лягає знизу батька (absolute);
 * дотиків не бере.
 */
export function DockFade({
  height,
  lead,
}: {
  /** Від початку згасання до низу екрана. */
  height: number
  /** Скільки з них — над верхом панелі. */
  lead: number
}) {
  const c = useColors()
  const at = (pt: number) => Math.min(1, Math.max(0, pt / height))
  const under = height - lead
  const curve: Curve = [
    [0, 0],
    [at(lead * 0.5), 0.1],
    [at(lead), 0.32],
    [at(lead + under * 0.4), 0.58],
    [at(lead + under * 0.75), 0.78],
    [1, 0.88],
  ]
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}
    >
      <Ramp curve={curve} color={c.background} />
    </View>
  )
}

/**
 * Те саме тло, дзеркально, — під нижньою панеллю (поле розмови з Zunor,
 * власник): над панеллю зміст чіткий і ніде не тьмяніє, а ПІД нею
 * розмивається й тоне в колір фону, сильніше до низу екрана. Лягає на
 * всього батька (absolute); дотиків не бере.
 */
export function FooterBlur({ color }: { color?: string }) {
  const c = useColors()
  return (
    <View pointerEvents="none" style={FILL}>
      {Platform.OS === 'ios' ? (
        <>
          <FadingBlur curve={flip(SOFT)} intensity={18} />
          <FadingBlur curve={flip(HARD)} intensity={42} />
        </>
      ) : null}
      <Ramp curve={flip(DIM)} color={color ?? c.background} />
    </View>
  )
}
