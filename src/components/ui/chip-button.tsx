import { Pressable, Text, View } from 'react-native'

import { CHIP, useChipShadow } from '@/components/ui/chip'

/**
 * Друга кнопка поруч із чорно-білою (`MonoButton`) — та сама висота й
 * скруглення, але з гранню `chip`, як «Продовжити з Google»: на
 * привітанні «Створити акаунт» — головна, «Увійти» — ця. Дві однаково
 * залиті кнопки сперечались би, котра головна.
 */
export function ChipButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  const shadow = useChipShadow()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        opacity: disabled ? 0.55 : 1,
        transform: [{ scale: pressed ? 0.975 : 1 }],
      })}
    >
      <View
        className={`h-14 flex-row items-center justify-center rounded-2xl px-6 ${CHIP}`}
        style={{ borderCurve: 'continuous', boxShadow: shadow }}
      >
        <Text
          numberOfLines={1}
          className="text-[17px] font-semibold text-foreground"
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}
