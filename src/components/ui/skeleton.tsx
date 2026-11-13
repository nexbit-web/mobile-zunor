import { useEffect, type ReactNode } from 'react'
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { SQUIRCLE } from '@/components/ui/tile'
import { useContentTop } from '@/lib/large-title'

/**
 * Скелетони — одна мова на весь застосунок: поки дані вперше вантажаться,
 * на місці змісту — сірі бруски тієї самої будови, що й справжній екран,
 * тож коли дані приходять, нічого не стрибає — бруски просто стають
 * текстом. Усе всередині одного <Skeleton> «дихає» разом (рівний timing,
 * без пружин); із «Зменшити рух» — без руху. Спінер лишається лише там,
 * де довантажується ще сторінка в кінці списку, і в кнопках.
 */
export function Skeleton({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: StyleProp<ViewStyle>
}) {
  const reduceMotion = useReducedMotion()
  const pulse = useSharedValue(1)

  useEffect(() => {
    if (reduceMotion) return
    pulse.set(
      withRepeat(
        withTiming(0.45, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    )
    return () => cancelAnimation(pulse)
  }, [reduceMotion, pulse])

  const breathe = useAnimatedStyle(() => ({ opacity: pulse.get() }))

  return (
    <Animated.View
      accessibilityLabel="Завантаження"
      accessibilityRole="progressbar"
      className={className}
      style={[style, breathe]}
    >
      {children}
    </Animated.View>
  )
}

/** Сірий брусок на місці тексту, іконки чи кнопки. */
export function Bone({
  width,
  height,
  radius = 6,
  color,
  style,
}: {
  width: DimensionValue
  height: number
  radius?: number
  /** Свій колір (бульбашки чату); за замовчуванням — `secondary`. */
  color?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      className={color ? undefined : 'bg-secondary'}
      style={[
        SQUIRCLE,
        { width, height, borderRadius: radius },
        color ? { backgroundColor: color } : null,
        style,
      ]}
    />
  )
}

/** Довжини, що чергуються: список не виглядає штампом. */
const LABELS: DimensionValue[] = ['38%', '52%', '44%', '30%', '48%']
const VALUES: DimensionValue[] = ['24%', '18%', '30%', '22%', '26%']

/**
 * Група налаштувань (settings/list → Section): підпис над карткою й
 * картка `shell` із рядками — плитка 30 pt, назва, значення праворуч,
 * лінії між рядками. `tiles: false` — рядки без плиток (поля вводу,
 * «назва — значення» в заявці).
 */
export function SectionSkeleton({
  rows = 3,
  title = true,
  tiles = true,
}: {
  rows?: number
  title?: boolean
  tiles?: boolean
}) {
  return (
    <View className="gap-2">
      {title ? (
        <View className="px-4 py-0.5">
          <Bone width={86} height={11} />
        </View>
      ) : null}
      <View className="overflow-hidden rounded-[24px] bg-shell" style={SQUIRCLE}>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i}>
            {i > 0 ? (
              <View
                className="bg-input"
                style={{
                  marginLeft: tiles ? 16 + 30 + 14 : 16,
                  height: StyleSheet.hairlineWidth,
                }}
              />
            ) : null}
            <View className="min-h-[50px] flex-row items-center gap-3.5 px-4">
              {tiles ? <Bone width={30} height={30} radius={8} /> : null}
              <View className="flex-1">
                <Bone width={LABELS[i % LABELS.length]} height={13} />
              </View>
              <Bone width={VALUES[i % VALUES.length]} height={13} />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

/** Блоки екрана налаштувань — по черзі згори вниз. */
export type SettingsBlock =
  | { rows: number; title?: boolean; tiles?: boolean }
  /** Фото, імʼя й пошта по центру — профіль. */
  | 'profile'
  /** Головна кнопка-капсула на всю ширину (GlowButton). */
  | 'button'

/**
 * Скелетон екрана налаштувань — із тими самими відступами, що в
 * SettingsScroll (під шапкою, `gap-7`, `px-4`): коли прийдуть дані,
 * групи стануть на ті самі місця.
 */
export function SettingsSkeleton({
  blocks = [{ rows: 3 }, { rows: 2 }],
}: {
  blocks?: SettingsBlock[]
}) {
  const top = useContentTop()
  return (
    <View className="flex-1 bg-background">
      <Skeleton className="gap-7 px-4" style={{ paddingTop: top + 12 }}>
        {blocks.map((b, i) =>
          b === 'profile' ? (
            <View key={i} className="items-center gap-3 pt-1">
              <Bone width={108} height={108} radius={54} />
              <View className="items-center gap-2.5">
                <Bone width={170} height={24} radius={8} />
                <Bone width={130} height={13} />
              </View>
            </View>
          ) : b === 'button' ? (
            <Bone key={i} width="100%" height={56} radius={28} />
          ) : (
            <SectionSkeleton
              key={i}
              rows={b.rows}
              title={b.title}
              tiles={b.tiles}
            />
          ),
        )}
      </Skeleton>
    </View>
  )
}
