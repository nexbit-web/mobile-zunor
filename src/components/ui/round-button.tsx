import { Pressable, Text, View } from 'react-native'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { useColors } from '@/lib/theme'

/**
 * Кнопка-іконка шапки й чату (назад, меню, «⋯», сповіщення, закрити) —
 * одна на весь застосунок: лише іконка кольору тексту (біла в темній
 * темі, чорна у світлій), без підкладки й контуру — як кнопки в шапках
 * iOS. Зона дотику — 40×40, хоч іконка й менша.
 */
export function RoundButton({
  icon,
  label,
  onPress,
  dot = false,
  badge = 0,
}: {
  icon: GlyphName
  label: string
  onPress: () => void
  /** Червона крапка — є непрочитане. */
  dot?: boolean
  /** Червоний кружечок із числом (1, 2 … 99+), як значок на іконці iOS. */
  badge?: number
}) {
  const c = useColors()
  // Шеврон «назад» і крапки «⋯» тонші за решту — трохи більші й
  // жирніші, щоб важили на око стільки ж.
  const size =
    icon === 'menu' ? 26 : icon === 'back' || icon === 'more' ? 22 : 20
  const weight = icon === 'back' || icon === 'more' ? 'semibold' : 'medium'
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="size-10 items-center justify-center rounded-full active:opacity-50"
    >
      <Glyph name={icon} size={size} color={c.foreground} weight={weight} />
      {badge > 0 ? (
        // Обідок кольору фону «вирізає» значок з іконки, як у iOS.
        <View
          className="absolute -right-0.5 top-0 h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-destructive px-1"
        >
          <Text
            className="text-[11px] font-bold leading-[13px] text-white"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : dot ? (
        <View className="absolute right-1.5 top-1.5 size-2.5 rounded-full border-2 border-background bg-destructive" />
      ) : null}
    </Pressable>
  )
}
