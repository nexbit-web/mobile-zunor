import type { ReactNode } from 'react'
import { Text, useColorScheme, View } from 'react-native'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { useColors } from '@/lib/theme'

// Шматки сторінки заявки (job-screen) — у згрупованій подачі iOS, за
// макетом власника: розділи з підписами великими літерами, картки-групи,
// у «Коли і де» — кольорові плитки з підписом над значенням, «Об’єкт» —
// таблиця «назва — значення».

/** Підпис розділу великими літерами, як у Section налаштувань. */
export function GroupLabel({ children }: { children: string }) {
  return (
    <Text className="px-4 text-[13px] font-medium uppercase tracking-[0.4px] text-muted-foreground">
      {children}
    </Text>
  )
}

/**
 * Рядок «Коли і де»: кольорова плитка, сірий підпис над значенням, значення
 * — жирним. `leading` — своя плитка (аватар замовника).
 */
export function InfoRow({
  leading,
  caption,
  value,
  right,
}: {
  leading: ReactNode
  caption: string
  value: ReactNode
  right?: ReactNode
}) {
  return (
    <View className="min-h-[62px] flex-row items-center gap-3.5 px-4 py-3">
      {leading}
      <View className="flex-1 gap-0.5">
        <Text className="text-[13px] text-muted-foreground">{caption}</Text>
        {typeof value === 'string' ? (
          <Text className="text-[17px] font-semibold tracking-[-0.2px] text-foreground">
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
      {right}
    </View>
  )
}

/** Плашка біля стану: «🔥 Терміново». */
export function Chip({
  icon,
  label,
  tone = 'gray',
}: {
  icon?: GlyphName
  label: string
  tone?: 'gray' | 'green' | 'orange'
}) {
  const c = useColors()
  const dark = useColorScheme() === 'dark'
  const look = {
    gray: { bg: dark ? '#2e2e2e' : '#eaeaed', fg: c.foreground, icon: c.mutedForeground },
    green: {
      bg: 'rgba(52, 199, 89, 0.15)',
      fg: dark ? '#30d158' : '#1f7a35',
      icon: dark ? '#30d158' : '#1f7a35',
    },
    orange: {
      bg: 'rgba(249, 115, 22, 0.15)',
      fg: dark ? '#fb923c' : '#c2410c',
      icon: dark ? '#fb923c' : '#c2410c',
    },
  }[tone]
  return (
    <View
      className="h-[26px] flex-row items-center gap-1 rounded-full px-2.5"
      style={{ backgroundColor: look.bg }}
    >
      {icon ? <Glyph name={icon} size={11} color={look.icon} weight="semibold" /> : null}
      <Text
        numberOfLines={1}
        className="text-[12.5px] font-semibold"
        style={{ color: look.fg }}
      >
        {label}
      </Text>
    </View>
  )
}

/** Підвал сторінки по центру: «🕒 Опубліковано 2 дн тому · 👁 1 перегляд». */
export function MetaLine({ items }: { items: { icon: GlyphName; text: string }[] }) {
  const c = useColors()
  return (
    <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-2 px-4">
      {items.map((it) => (
        <View key={it.text} className="flex-row items-center gap-1.5">
          <Glyph name={it.icon} size={12} color={c.mutedForeground} weight="medium" />
          <Text className="text-[13px] text-muted-foreground">{it.text}</Text>
        </View>
      ))}
    </View>
  )
}
