import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { Glyph } from '@/components/icons/glyph'
import { SQUIRCLE } from '@/components/ui/tile'
import { useColors, withAlpha } from '@/lib/theme'

/** Плитка — як у решти порожніх станів (EmptyState). */
const TILE = 72
const RADIUS = 22
/** До якого розміру розходиться хвиля (від плитки). */
const WAVE = 1.45

/**
 * Порожня стрічка сповіщень: та сама сіра плитка, що в усіх порожніх
 * станах (не акцент — так попросив власник), із дзвіночком. При появі
 * дзвіночок раз тихо гойднеться, а від плитки повільно розходиться ледь
 * помітна сіра хвиля її ж форми — «чекаємо». Хвиля проявляється й гасне
 * плавно, без різкого старту. Із «Зменшити рух» — нерухомо, без хвилі.
 */
export function QuietBell() {
  const c = useColors()
  const reduceMotion = useReducedMotion()
  const swing = useSharedValue(0)
  const wave = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return
    const step = (deg: number, ms: number) =>
      withTiming(deg, { duration: ms, easing: Easing.inOut(Easing.quad) })
    swing.set(
      withDelay(
        450,
        withSequence(
          step(-12, 150),
          step(9, 190),
          step(-5, 170),
          step(2, 150),
          step(0, 140),
        ),
      ),
    )
    wave.set(
      withDelay(
        600,
        withRepeat(
          withTiming(1, { duration: 3200, easing: Easing.out(Easing.quad) }),
          -1,
          false,
        ),
      ),
    )
    return () => {
      cancelAnimation(swing)
      cancelAnimation(wave)
    }
  }, [reduceMotion, swing, wave])

  const bell = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swing.get()}deg` }],
  }))
  const ripple = useAnimatedStyle(() => ({
    opacity: interpolate(wave.get(), [0, 0.12, 1], [0, 1, 0]),
    transform: [{ scale: 1 + wave.get() * (WAVE - 1) }],
  }))

  return (
    <View
      style={{ width: TILE, height: TILE }}
      className="items-center justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: TILE,
            height: TILE,
            borderRadius: RADIUS,
            borderWidth: 1,
            borderColor: withAlpha(c.mutedForeground, 0.35),
          },
          SQUIRCLE,
          ripple,
        ]}
      />
      <View
        className="items-center justify-center bg-shell"
        style={[{ width: TILE, height: TILE, borderRadius: RADIUS }, SQUIRCLE]}
      >
        {/* Гойдається від верхівки, як справжній дзвоник. */}
        <Animated.View style={[{ transformOrigin: '50% 12%' }, bell]}>
          <Glyph name="bellFill" size={32} color={c.mutedForeground} />
        </Animated.View>
      </View>
    </View>
  )
}
