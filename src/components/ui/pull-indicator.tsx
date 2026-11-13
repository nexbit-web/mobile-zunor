import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Platform, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { ZunorMark } from '@/components/zunor-mark'
import { useColors, withAlpha } from '@/lib/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const SIZE = 34
const STROKE = 2.5
const R = (SIZE - STROKE) / 2
const LENGTH = 2 * Math.PI * R
/** Скільки тягнути до майже повного кола — близько того iOS і оновлює. */
const FULL = 90

/**
 * Оновлення, яке людина запустила, потягнувши список: `refreshing` —
 * лише воно, а не фонові перезапити (повернення в застосунок, після
 * дії), які не мають смикати сторінку вниз. Індикатор крутиться щонайменше
 * мить: швидка відповідь інакше лише блимне. Коли оновлення пішло —
 * легкий «тук» вібрацією: рука відчуває, що потягнула досить.
 */
export function usePullRefresh(run: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = async () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    setRefreshing(true)
    try {
      await Promise.all([
        run(),
        new Promise((done) => setTimeout(done, 700)),
      ])
    } finally {
      setRefreshing(false)
    }
  }
  return { refreshing, onRefresh: () => void onRefresh() }
}

/**
 * Пропси системного RefreshControl під PullIndicator: на iOS «колесо»
 * прозоре (малює індикатор), на Android — матеріальне коло в кольорах
 * застосунку на висоті `top`.
 */
export function refreshLook(
  c: { primary: string; card: string },
  top: number,
) {
  const ios = Platform.OS === 'ios'
  return {
    tintColor: ios ? 'transparent' : c.primary,
    colors: [c.primary],
    progressBackgroundColor: c.card,
    progressViewOffset: ios ? 0 : top,
  }
}

/**
 * «Потягни, щоб оновити» — свій індикатор замість системного «колеса»
 * (iOS): кільце акценту зі знаком Zunor усередині. Тягнеш — кільце
 * зʼявляється й замикається за пальцем; відпустив і пішло оновлення —
 * крутиться, доки дані не прийшли.
 *
 * Сам жест і утримання списку робить системний RefreshControl (він лише
 * невидимий — `tintColor` прозорий), тож поведінка рідна. Індикатор лише
 * малює: стоїть у щілині між шапкою й сторінкою, що з'їхала вниз.
 *
 * `y` — прокрутка сторінки (від'ємна, коли тягнуть), `offset` — скільки
 * порожнього вже є між шапкою й змістом сторінки у спокої.
 */
export function PullIndicator({
  y,
  top,
  offset = 0,
  refreshing,
}: {
  y: SharedValue<number>
  top: number
  offset?: number
  refreshing: boolean
}) {
  const c = useColors()
  const spin = useSharedValue(0)
  const active = useSharedValue(0)

  useEffect(() => {
    active.set(withTiming(refreshing ? 1 : 0, { duration: 220 }))
    if (refreshing) {
      const from = spin.get()
      spin.set(
        withRepeat(
          withTiming(from + 360, { duration: 850, easing: Easing.linear }),
          -1,
          false,
        ),
      )
    } else {
      cancelAnimation(spin)
    }
  }, [refreshing, spin, active])

  const box = useAnimatedStyle(() => {
    const pull = Math.max(-y.get(), 0)
    return {
      opacity: interpolate(pull, [12, 46], [0, 1], Extrapolation.CLAMP),
      transform: [
        // По центру щілини, що відкрилась над сторінкою.
        { translateY: (pull + offset) / 2 - SIZE / 2 },
        { scale: interpolate(pull, [12, 64], [0.45, 1], Extrapolation.CLAMP) },
      ],
    }
  })

  const ring = useAnimatedStyle(() => {
    const p = Math.min(Math.max(-y.get(), 0) / FULL, 1)
    return {
      transform: [{ rotate: `${-90 + p * 270 + spin.get()}deg` }],
    }
  })

  const arc = useAnimatedProps(() => {
    const p = Math.min(Math.max(-y.get(), 0) / FULL, 1)
    // Тягнуть — дуга росте за пальцем; оновлюється — сталих три чверті.
    const pulled = p * 0.82
    const len = pulled + (0.75 - pulled) * active.get()
    return { strokeDashoffset: LENGTH * (1 - len) }
  })

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top, left: 0, right: 0, alignItems: 'center' }}
    >
      <Animated.View
        style={[{ width: SIZE, height: SIZE }, box]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={[{ position: 'absolute', width: SIZE, height: SIZE }, ring]}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={withAlpha(c.mutedForeground, 0.18)}
              strokeWidth={STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={c.primary}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${LENGTH} ${LENGTH}`}
              fill="none"
              animatedProps={arc}
            />
          </Svg>
        </Animated.View>
        <View className="flex-1 items-center justify-center">
          <ZunorMark size={14} color={c.foreground} />
        </View>
      </Animated.View>
    </View>
  )
}
