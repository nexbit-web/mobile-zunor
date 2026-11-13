import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { useColors } from '@/lib/theme'

/**
 * Чорно-біла головна кнопка — як у ChatGPT і ClickUp: у темній темі
 * біла з чорним написом, у світлій — чорна з білим (колір тексту й фону
 * навпаки). На привітанні й у вході: акцентна «світна» там власникові
 * була не в тему. 56 pt, скруглення 16 — як у ClickUp і в полів входу
 * (так попросив власник) і «Продовжити з Google»; натиснута — ледь стискається.
 */
export function MonoButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}) {
  const c = useColors()
  const off = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => ({
        opacity: disabled ? 0.55 : 1,
        transform: [{ scale: pressed ? 0.975 : 1 }],
      })}
    >
      <View
        className="h-14 flex-row items-center justify-center gap-2.5 rounded-2xl bg-foreground px-6"
        style={{ borderCurve: 'continuous' }}
      >
        {loading ? <ActivityIndicator color={c.background} /> : null}
        <Text
          numberOfLines={1}
          className="text-[17px] font-semibold text-background"
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}
