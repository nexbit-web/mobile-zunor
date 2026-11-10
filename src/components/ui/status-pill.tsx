import { useEffect } from 'react'
import { Text, useColorScheme, View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { useColors } from '@/lib/theme'

/**
 * Тон стану — як плашки job-state.svelte й order-card.svelte на сайті:
 * - action — суцільний акцент: тут людині треба щось зробити;
 * - live — акцент блідо, з «пульсом»: іде просто зараз;
 * - progress — бурштин: майстра обрано, робота ще попереду;
 * - done — зелений: закрито; off — сірий: скасовано чи минуло.
 */
export type PillTone = 'action' | 'live' | 'progress' | 'done' | 'off'

export function StatusPill({
  label,
  tone,
  pulse = false,
}: {
  label: string
  tone: PillTone
  /** Пульс — рівно один стан на картку, що рухається просто зараз. */
  pulse?: boolean
}) {
  const c = useColors()
  const dark = useColorScheme() === 'dark'
  // Кольори — у JS: прозорість від токена акценту (#rrggbb + альфа)
  // надійніша, ніж `bg-primary/15` поверх змінної теми.
  const look: Record<PillTone, { bg: string; fg: string }> = {
    action: { bg: c.primary, fg: c.primaryForeground },
    live: { bg: `${c.primary}26`, fg: c.primary },
    progress: {
      bg: 'rgba(245, 158, 11, 0.16)',
      fg: dark ? '#fbbf24' : '#b45309',
    },
    done: {
      bg: 'rgba(16, 185, 129, 0.16)',
      fg: dark ? '#34d399' : '#047857',
    },
    off: { bg: dark ? '#2c2c2e' : '#e5e5ea', fg: c.mutedForeground },
  }
  const { bg, fg } = look[tone]

  return (
    <View
      className="h-[26px] flex-row items-center gap-1.5 rounded-full px-2.5"
      style={{ backgroundColor: bg }}
    >
      {pulse ? <LiveDot color={fg} /> : null}
      <Text
        numberOfLines={1}
        className="text-[12.5px] font-semibold"
        style={{ color: fg }}
      >
        {label}
      </Text>
    </View>
  )
}

/** Крапка, що «дихає»; із «Зменшити рух» — просто крапка. */
export function LiveDot({ color, size = 6 }: { color: string; size?: number }) {
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (reduceMotion) return
    opacity.set(withRepeat(withTiming(0.3, { duration: 1000 }), -1, true))
    return () => cancelAnimation(opacity)
  }, [reduceMotion, opacity])

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  )
}
