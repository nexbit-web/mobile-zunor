import { createContext, useContext, type ReactNode } from 'react'
import { Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'

import { useKeyboardHeight } from '@/components/auth/use-keyboard-height'
import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { GlowButton } from '@/components/ui/glow-button'
import { SQUIRCLE } from '@/components/ui/tile'
import { useColors } from '@/lib/theme'

/**
 * Наскільки зміст прокрутки, у якій лежить порожній стан, у спокої стоїть
 * нижче свого місця в розкладці: на iOS списки з «потягни, щоб оновити»
 * відступають від шапки через contentInset (lib/large-title, `shift`).
 * Ставить той, хто такий список малює (SwipeTabs, JobsList, сповіщення).
 * null — не центрувати по екрану, лише у своєму блоці (перевернутий
 * список розмови: там середина — область повідомлень).
 */
export const EmptyStateInset = createContext<number | null>(0)

/** Ближче за стільки до краю свого блоку зміст не підходить. */
const EDGE = 16

/**
 * Обгортка порожнього стану: зміст — посередині ЕКРАНА (а коли відкрита
 * клавіатура — посередині того, що над нею), однаково на всіх екранах.
 * Раніше він центрувався у своєму блоці — між шапкою (з перемикачем чи
 * без) і низом, а на iOS блок ще й з'їжджав униз на висоту шапки
 * (contentInset), тож стояв нижче середини й на кожному екрані
 * по-різному (власник). Тепер блок міряє, де стоїть, і зсуває зміст на
 * UI-потоці; поки не поміряно — зміст невидимий (один кадр), щоб не
 * стрибав. Зі свого блоку зміст не виходить.
 *
 * `className` — блоку (відступи), `contentClassName` — змісту (проміжки).
 */
export function ScreenCenter({
  className,
  contentClassName,
  children,
}: {
  className?: string
  contentClassName?: string
  children: ReactNode
}) {
  const inset = useContext(EmptyStateInset)
  const { height: screen } = useWindowDimensions()
  const keyboard = useKeyboardHeight()
  // Блок: верх відносно батька (зміст прокрутки) і висота; висота змісту.
  const box = useSharedValue<[number, number]>([0, 0])
  const content = useSharedValue(0)

  const place = useAnimatedStyle(() => {
    if (inset === null) return { opacity: 1, transform: [{ translateY: 0 }] }
    const [y, h] = box.get()
    const ch = content.get()
    if (!h || !ch) return { opacity: 0, transform: [{ translateY: 0 }] }
    const target = (screen - keyboard.get()) / 2
    const room = Math.max((h - ch) / 2 - EDGE, 0)
    const shift = target - (inset + y + h / 2)
    return {
      opacity: 1,
      transform: [{ translateY: Math.min(Math.max(shift, -room), room) }],
    }
  })

  return (
    <View
      className={`flex-1 justify-center ${className ?? ''}`}
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout
        box.set([y, height])
      }}
    >
      <Animated.View
        className={`items-center ${contentClassName ?? ''}`}
        style={place}
        onLayout={(e) => content.set(e.nativeEvent.layout.height)}
      >
        {children}
      </Animated.View>
    </View>
  )
}

/**
 * Порожній стан і стан помилки: велика плитка з системною іконкою,
 * заголовок, пояснення й одна дія — капсула з ободком і відблиском
 * (`GlowButton md`), як «Подати пропозицію» в заявці. Стоїть посередині
 * екрана (ScreenCenter).
 *
 * `art` — своя плитка замість іконки (живий дзвіночок сповіщень), того ж
 * розміру 72 pt, щоб заголовок стояв там само, де в усіх.
 */
export function EmptyState({
  title,
  text,
  action,
  ...tile
}: ({ icon: GlyphName } | { art: ReactNode }) & {
  title: string
  text?: string
  action?: { label: string; onPress: () => void }
}) {
  const c = useColors()
  return (
    <ScreenCenter className="px-8 py-16" contentClassName="gap-3">
      {'art' in tile ? (
        <View className="mb-2">{tile.art}</View>
      ) : (
        <View
          className="mb-2 size-[72px] items-center justify-center rounded-[22px] bg-shell"
          style={SQUIRCLE}
        >
          <Glyph name={tile.icon} size={32} color={c.mutedForeground} />
        </View>
      )}
      <Text className="text-center text-[20px] font-bold tracking-tight text-foreground">
        {title}
      </Text>
      {text ? (
        <Text className="text-center text-[15px] leading-[21px] text-muted-foreground">
          {text}
        </Text>
      ) : null}
      {action ? (
        <View className="mt-4">
          <GlowButton size="md" label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </ScreenCenter>
  )
}
