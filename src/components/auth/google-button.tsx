import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { GoogleMark } from '@/components/icons/brand-tiles'
import { CHIP, useChipShadow } from '@/components/ui/chip'
import { useColors } from '@/lib/theme'

/**
 * «Продовжити з Google» — як на сайті (web/…/auth/google-button.svelte):
 * знак притиснутий до лівого краю, напис по центру — так кнопка
 * читається як спосіб входу, а не ще одна дія форми. Вигляд — чітка
 * грань `chip` (як кнопки шапки), висота й скруглення 16 — як у
 * «Створити акаунт» / «Увійти» й полів входу.
 */
export function GoogleButton({
  onPress,
  loading = false,
  disabled = false,
}: {
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}) {
  const c = useColors()
  const shadow = useChipShadow()
  const off = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel="Продовжити з Google"
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => ({
        opacity: disabled ? 0.55 : 1,
        transform: [{ scale: pressed ? 0.975 : 1 }],
      })}
    >
      <View
        className={`h-14 flex-row items-center justify-center rounded-2xl px-6 ${CHIP}`}
        style={{ borderCurve: 'continuous', boxShadow: shadow }}
      >
        {loading ? (
          <View className="flex-row items-center gap-2.5">
            <ActivityIndicator color={c.mutedForeground} />
            <Text className="text-[17px] font-semibold text-foreground">
              Переходимо до Google…
            </Text>
          </View>
        ) : (
          <>
            <View className="absolute left-5">
              <GoogleMark size={22} />
            </View>
            <Text className="text-[17px] font-semibold text-foreground">
              Продовжити з Google
            </Text>
          </>
        )}
      </View>
    </Pressable>
  )
}
