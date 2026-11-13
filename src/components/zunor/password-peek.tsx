import LottieView from 'lottie-react-native'
import { useEffect, useMemo } from 'react'
import { Platform } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { ZunorMark } from '@/components/zunor-mark'
import { useColors } from '@/lib/theme'

import peek from '@/assets/animations/zunor-password-peek.json'

import { recolorMono } from './lottie-mono'

const AnimatedLottie = Animated.createAnimatedComponent(LottieView)

/** Кадрів у секунду й довжина анімації — progress 0…1 іде по ній. */
const FPS = peek.fr
const LENGTH = peek.op - peek.ip
/** Пози — маркери анімації: idle 0, hidden 36, visible 72. */
const POSE: Record<string, number> = Object.fromEntries(
  peek.markers.map((m) => [m.cm, m.tm]),
)

/**
 * Знак Zunor, що стежить за полем пароля, — як на сайті
 * (web/…/icons/zunor-password-peek.svelte):
 *
 *   поле порожнє             → дивиться            маркер idle
 *   є пароль                 → закрив очі руками   маркер hidden
 *   пароль показано          → підглядає           маркер visible
 *
 * Анімація — КОПІЯ web/static/animations/zunor-password-peek.json
 * (полотно 780×870: під головою руки). Змінилась на сайті — скопіюй.
 *
 * Кадр веде сам код (progress через Reanimated), а не play(): ціль може
 * змінитись посеред переходу (ввів → «показати» → стер), і лише рух від
 * ПОТОЧНОГО кадру до нової цілі ніколи не стрибає. Швидкість — рідна
 * (60 кадрів/с), рівно, без пружин. «Зменшити рух» — одразу потрібна
 * поза. У браузері (dev) progress Lottie не вміє — статичний знак.
 */
export function ZunorPasswordPeek({
  filled,
  visible,
  height = 92,
  background,
}: {
  /** У полі пароля вже щось введено. */
  filled: boolean
  /** Пароль показано текстом. */
  visible: boolean
  height?: number
  /** Колір під знаком — ним очі. За замовчуванням — фон. */
  background?: string
}) {
  const c = useColors()
  const reduceMotion = useReducedMotion()
  const back = background ?? c.background
  const source = useMemo(
    () => recolorMono(peek, c.foreground, back),
    [c.foreground, back],
  )

  const target = POSE[!filled ? 'idle' : visible ? 'visible' : 'hidden'] ?? 0
  const frame = useSharedValue(target)

  useEffect(() => {
    if (reduceMotion) {
      frame.set(target)
      return
    }
    const distance = Math.abs(target - frame.get())
    frame.set(
      withTiming(target, {
        duration: (distance / FPS) * 1000,
        easing: Easing.linear,
      }),
    )
  }, [target, reduceMotion, frame])

  const animatedProps = useAnimatedProps(() => ({
    progress: frame.get() / LENGTH,
  }))

  const width = (height * peek.w) / peek.h

  if (Platform.OS === 'web') {
    return <ZunorMark size={height * 0.62} color={c.foreground} />
  }
  return (
    <AnimatedLottie
      source={source}
      animatedProps={animatedProps}
      style={{ width, height }}
    />
  )
}
