import { Pressable, Text, View } from 'react-native'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { CHIP, useChipShadow } from '@/components/ui/chip'
import { useColors } from '@/lib/theme'

/**
 * Кнопка-іконка шапки й чату (назад, меню, «⋯», дзвіночок, пошук, фільтр,
 * закрити, «✕» замість «Скасувати») — одна на весь застосунок: кругла
 * підкладка `chip` із чіткою гранню (ui/chip.ts; у світлій темі — біла з
 * легкою тінню), іконка — кольору тексту: біла в темній темі, чорна у
 * світлій (так попросив власник). Підкладка непрозора: під шапкою йде
 * зміст, і крізь кнопку він не просвічує. Коло — 44×44, як кнопки шапки
 * в iOS.
 */
export function RoundButton({
  icon,
  label,
  onPress,
  dot = false,
  badge = 0,
  tint,
  disabled = false,
}: {
  icon: GlyphName
  label: string
  onPress: () => void
  /** Поки йде дія (збереження) — бліда й не натискається. */
  disabled?: boolean
  /** Свій колір іконки (напр. акцент — увімкнений фільтр). */
  tint?: string
  /** Червона крапка — є непрочитане. */
  dot?: boolean
  /** Червоний кружечок із числом (1, 2 … 99+), як значок на іконці iOS. */
  badge?: number
}) {
  const c = useColors()
  const shadow = useChipShadow()
  // Іконки різної «ваги» на око: тонкі (шеврон, «⋯», три риски) — трохи
  // більші, щоб у колі всі виглядали однаково. Шеврон «Назад» — тонкий і
  // високий, як у Telegram (скриншот власника). Розміри — великі (менші
  // власник двічі просив збільшити).
  const size =
    icon === 'menu'
      ? 24
      : icon === 'back' ||
          icon === 'bell' ||
          icon === 'filter' ||
          icon === 'filterOn' ||
          icon === 'more'
        ? 23
        : icon === 'close'
          ? 20
          : 22
  const weight = icon === 'more' ? 'semibold' : 'medium'
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`size-11 items-center justify-center rounded-full active:opacity-60 ${CHIP} ${
        disabled ? 'opacity-40' : ''
      }`}
      style={{ boxShadow: shadow }}
    >
      <Glyph
        name={icon}
        size={size}
        color={tint ?? c.foreground}
        weight={weight}
      />
      {badge > 0 ? (
        // Обідок кольору фону «вирізає» значок з кола, як у iOS.
        <View
          className="absolute -right-1.5 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-destructive px-1"
        >
          <Text
            className="text-[11px] font-bold leading-[13px] text-white"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : dot ? (
        <View className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-destructive" />
      ) : null}
    </Pressable>
  )
}
