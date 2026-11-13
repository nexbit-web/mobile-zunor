import { ActivityIndicator, Pressable, Text } from 'react-native'

import { CHIP, useChipShadow } from '@/components/ui/chip'
import { GlowSurface } from '@/components/ui/glow-button'
import { useColors } from '@/lib/theme'

/**
 * Кнопка-напис у шапці — та сама підкладка, що в круглих кнопок
 * (RoundButton: `chip` + грань, ui/chip.ts), лише пігулкою й тієї ж
 * висоти (44):
 * - «Змінити» (`tone="secondary"`) — напис кольору тексту,
 *   білий у темній темі, чорний у світлій;
 * - «Зберегти» — «світна» акцентна пігулка (GlowSurface: ободок і
 *   відблиск, як «Подати пропозицію»), поки є що зберігати; без змін —
 *   така сама сіра пігулка з приглушеним написом.
 * Одне місце, одна форма — «Змінити» перетворюється на «Зберегти», а не
 * стрибає.
 * - `tone="destructive"` — та сама сіра пігулка з червоним написом
 *   («Видалити» в смузі дій режиму вибору, dock/dock-actions).
 */
export function HeaderPill({
  label,
  onPress,
  disabled = false,
  loading = false,
  tone = 'primary',
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  tone?: 'primary' | 'secondary' | 'destructive'
}) {
  const c = useColors()
  const shadow = useChipShadow()
  const off = disabled || loading
  const filled = tone === 'primary' && !off
  const content = loading ? (
    <ActivityIndicator size="small" color={c.mutedForeground} />
  ) : (
    // Одним рядком: перенесена остання літера («Зберегт/и») — це бите.
    <Text
      numberOfLines={1}
      className={`text-[16px] font-semibold ${
        filled
          ? 'text-primary-foreground'
          : off
            ? 'text-muted-foreground'
            : tone === 'destructive'
              ? 'text-destructive'
              : 'text-foreground'
      }`}
    >
      {label}
    </Text>
  )
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      className={`h-11 shrink-0 rounded-full active:opacity-70 ${
        filled ? '' : `items-center justify-center px-4 ${CHIP}`
      }`}
      style={{ boxShadow: shadow }}
    >
      {filled ? (
        <GlowSurface
          radius={22}
          strength="sm"
          className="h-11 items-center justify-center px-4"
        >
          {content}
        </GlowSurface>
      ) : (
        content
      )}
    </Pressable>
  )
}

/** Кнопка шапки «Зберегти»: «світна» акцентна пігулка, сіра — поки нічого. */
export function HeaderSave(props: {
  onPress: () => void
  disabled: boolean
  loading: boolean
}) {
  return <HeaderPill label="Зберегти" {...props} />
}
