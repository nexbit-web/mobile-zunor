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
 * панель відкрита) — дає DrawerScene. Поки сторінка їде, розмиття тла
 * шапки гасне (FadingBlur): iOS-розмиття біля лівого краю бере й те, що
 * поза сторінкою, і розмазувало її чіткий край і заокруглений кут угорі
 * (власник). Без панелі — `null`, розмиття як завжди.
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
 * Тло шапки — як у Telegram (скриншоти власника): зміст видно під шапкою
 * до САМОГО верху, він плавно розмивається й ледь темнішає до
 * статус-бару; біля низу шапки — уже чіткий, межі немає.
 *
 * Власник відкинув: щільну заливку з коротким згасанням («жорстко»),
 * простий градієнт без розмиття і перше розмиття з двох шарів і майже
 * щільним затемненням угорі (зміст угорі зникав, переходи було видно).
 *
 * Розмиття — чотирма шарами (радіус у BlurView один на шар): кожен
 * наступний сильніший і починається вище, тож розмиття росте до верху
 * рівно, без сходинок. Затемнення — легке (HEADER_DIM), щоб зміст угорі
 * вгадувався, а статус-бар і кнопки читались.
 */
const HEADER_BLUR: { intensity: number; curve: Curve }[] = [
  {
    intensity: 10,
    curve: [
      [0, 1],
      [0.7, 1],
      [1, 0],
    ],
  },
  {
    intensity: 18,
    curve: [
      [0, 1],
      [0.5, 1],
      [0.85, 0],
    ],
  },
  {
    intensity: 30,
    curve: [
      [0, 1],
      [0.3, 1],
      [0.65, 0],
    ],
  },
  {
    intensity: 46,
    curve: [
      [0, 1],
      [0.12, 1],
      [0.45, 0],
    ],
  },
]

const HEADER_DIM: Curve = [
  [0, 0.62],
  [0.25, 0.52],
  [0.5, 0.34],
  [0.7, 0.18],
  [0.85, 0.07],
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
    <Svg style={FILL} preserveAspectRatio="none">
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
 * Тло шапки, як у Telegram (HEADER_BLUR, HEADER_DIM): зміст заходить під
 * шапку й до самого верху плавно розмивається й ледь темнішає (у
 * світлій темі — світлішає). Біля низу шапки — ще чіткий, тож межі-лінії
 * немає. Кнопки на непрозорих підкладках, назва — поверх, тож вони
 * лишаються чіткими. На Android — лише затемнення (expo-blur там без
 * BlurTargetView не розмиває).
 *
 * `height` — від верху екрана до низу смуги з ефектом (низ шапки, у
 * SwipeTabs — трохи нижче перемикача). Дотиків не бере.
 */
export function HeaderFade({
  height,
  color,
}: {
  height: number
  /** Тло сторінки, якщо воно не звичайне (заявка — колір картки). */
  color?: string
}) {
  const c = useColors()
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
    >
      {Platform.OS === 'ios'
        ? HEADER_BLUR.map((layer) => (
            <FadingBlur
              key={layer.intensity}
              curve={layer.curve}
              intensity={layer.intensity}
            />
          ))
        : null}
      <Ramp curve={HEADER_DIM} color={color ?? c.background} />
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
