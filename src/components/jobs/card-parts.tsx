import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { ServiceBadge } from '@/components/icons/service-icon'
import { SQUIRCLE } from '@/components/ui/tile'
import { useColors } from '@/lib/theme'
import { serviceLabel } from '@/shared/cleaning'

// Спільні шматки карток заявки й замовлення: одна мова, щоб заявка, яка
// стала замовленням, впізнавалась з першого погляду.

/** Обгортка картки: шар «картка» на фоні, кути суперелипсом, без обводки. */
export const CARD = 'rounded-[24px] bg-card active:opacity-85'
export { SQUIRCLE }

/**
 * Шапка картки: іконка послуги (та сама, що на сайті, з деталлю кольором
 * акценту), назва послуги й день, праворуч — стан (клієнтові) чи бюджет
 * (майстрові).
 */
export function ServiceHeader({
  service,
  day,
  right,
}: {
  service: unknown
  day: string
  right?: ReactNode
}) {
  const name =
    typeof service === 'string' ? serviceLabel(service) : 'Прибирання'
  return (
    <View className="flex-row items-center gap-3">
      <ServiceBadge service={service} size={42} />
      <View className="flex-1 gap-0.5">
        <Text
          numberOfLines={1}
          className="text-[16px] font-semibold tracking-[-0.2px] text-foreground"
        >
          {name}
        </Text>
        {day ? (
          <Text numberOfLines={1} className="text-[13.5px] text-muted-foreground">
            {day}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  )
}

/**
 * Характеристики — сірі пігулки: «Квартира», «2 кімнати», «≈ 54 м²».
 * Не більше чотирьох, решта — «+N»: картка — не анкета.
 */
export function TagRow({ tags }: { tags: string[] }) {
  if (!tags.length) return null
  const shown = tags.slice(0, 4)
  const rest = tags.length - shown.length
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {shown.map((t) => (
        <View key={t} className="rounded-full bg-secondary px-2.5 py-[5px]">
          <Text className="text-[13px] text-foreground">{t}</Text>
        </View>
      ))}
      {rest > 0 ? (
        <View className="rounded-full bg-secondary px-2.5 py-[5px]">
          <Text className="text-[13px] text-muted-foreground">+{rest}</Text>
        </View>
      ) : null}
    </View>
  )
}

/** Тонка лінія між змістом картки й її «підвалом». */
export function CardDivider() {
  return (
    <View
      className="bg-border"
      style={{ height: StyleSheet.hairlineWidth * 2 }}
    />
  )
}

/** Факт рядком: сіра системна іконка й текст поруч. */
export function Fact({
  icon,
  children,
  strong = false,
}: {
  icon: GlyphName
  children: ReactNode
  strong?: boolean
}) {
  const c = useColors()
  return (
    <View className="min-w-0 flex-row items-center gap-2">
      <View className="w-[18px] items-center">
        <Glyph name={icon} size={15} color={c.mutedForeground} weight="medium" />
      </View>
      <Text
        numberOfLines={1}
        className={`shrink text-[14.5px] ${
          strong ? 'font-semibold text-foreground' : 'text-foreground'
        }`}
        style={strong ? { fontVariant: ['tabular-nums'] } : undefined}
      >
        {children}
      </Text>
    </View>
  )
}
