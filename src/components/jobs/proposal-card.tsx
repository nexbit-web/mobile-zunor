import { Text, useColorScheme, View } from 'react-native'

import { Glyph } from '@/components/icons/glyph'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { StatusPill, type PillTone } from '@/components/ui/status-pill'
import { SQUIRCLE } from '@/components/ui/tile'
import { useColors } from '@/lib/theme'
import { formatRelative } from '@/shared/format'
import {
  formatDays,
  proposalStatusLabel,
  type JobProposal,
} from '@/shared/jobs'
import { formatPrice } from '@/shared/orders'

/**
 * Стан пропозиції показуємо, лише коли він не «Очікує»: поки заявка
 * відкрита, очікують усі, і однакова плашка на кожній картці — шум.
 */
const TONE: Record<string, PillTone> = {
  ACCEPTED: 'done',
  REJECTED: 'off',
  WITHDRAWN: 'off',
}

/**
 * Пропозиція майстра — як на сайті (job-client-view): хто, рейтинг і коли
 * — ліворуч, ціна й строк — праворуч, на тому самому місці в кожній
 * картці (клієнт порівнює саме за ними), нижче — повідомлення майстра й
 * «Обрати майстра».
 *
 * `mine` — майстрові його власна: замість імені — «Ваша пропозиція», а
 * стан видно завжди (і «Очікує» теж — це його головна новина).
 */
export function ProposalCard({
  proposal: p,
  currency,
  mine = false,
  onAccept,
  accepting = false,
  disabled = false,
}: {
  proposal: JobProposal
  currency: string
  mine?: boolean
  /** Є — показуємо «Обрати майстра». */
  onAccept?: () => void
  accepting?: boolean
  disabled?: boolean
}) {
  const c = useColors()
  const dark = useColorScheme() === 'dark'
  const name = p.master.name || p.master.username || 'Майстер'
  const price = formatPrice(p.priceCents, currency)
  const tone = mine ? (TONE[p.status] ?? 'live') : TONE[p.status]

  return (
    <View className="gap-3.5 rounded-[24px] bg-card p-4" style={SQUIRCLE}>
      <View className="flex-row items-start gap-3">
        <Avatar uri={p.master.avatar} name={name} size={44} />
        <View className="flex-1 gap-1">
          <Text
            numberOfLines={1}
            className="text-[16px] font-semibold text-foreground"
          >
            {mine ? 'Ваша пропозиція' : name}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
            {p.master.reviewsCount > 0 ? (
              <>
                <Glyph name="star" size={12} color="#f5b400" />
                <Text className="text-[13px] font-medium text-foreground">
                  {p.master.avgRating.toFixed(1)}
                </Text>
                <Text className="text-[13px] text-muted-foreground">
                  ({p.master.reviewsCount}) ·
                </Text>
              </>
            ) : null}
            <Text className="text-[13px] text-muted-foreground">
              {formatRelative(p.createdAt)}
            </Text>
          </View>
        </View>
        <View className="items-end gap-0.5">
          {price ? (
            <Text
              className="text-[18px] font-bold text-foreground"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {price}
            </Text>
          ) : null}
          <Text className="text-[13px] text-muted-foreground">
            за {formatDays(p.estimatedDays)}
          </Text>
        </View>
      </View>

      {/* Позначки — окремим рядком, щоб не тиснути ім’я. */}
      {p.recommended || p.isNew || tone ? (
        <View className="flex-row flex-wrap gap-1.5">
          {p.recommended ? (
            <View
              className="h-7 flex-row items-center gap-1 rounded-full px-2.5"
              style={{ backgroundColor: `${c.primary}24` }}
            >
              <Glyph name="star" size={11} color={c.primary} />
              <Text
                className="text-[12.5px] font-semibold"
                style={{ color: c.primary }}
              >
                Рекомендуємо
              </Text>
            </View>
          ) : null}
          {p.isNew ? (
            <View
              className="h-7 justify-center rounded-full px-2.5"
              style={{ backgroundColor: dark ? '#3a3a3c' : '#e5e5ea' }}
            >
              <Text className="text-[12.5px] font-medium text-foreground">
                Новачок
              </Text>
            </View>
          ) : null}
          {tone ? (
            <StatusPill label={proposalStatusLabel(p.status)} tone={tone} />
          ) : null}
        </View>
      ) : null}

      <Text className="text-[15px] leading-[22px] text-foreground">
        {p.message}
      </Text>

      {onAccept ? (
        <Button onPress={onAccept} loading={accepting} disabled={disabled}>
          Обрати майстра
        </Button>
      ) : null}
    </View>
  )
}
