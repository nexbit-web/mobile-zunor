import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Glyph } from '@/components/icons/glyph'
import { MonoButton } from '@/components/ui/mono-button'
import { errorText } from '@/lib/api'
import { HEADER_BAR } from '@/lib/large-title'
import { useColors } from '@/lib/theme'

/**
 * Поки анкета вантажить дані (міста, райони, що вже заповнено) — спінер;
 * не вдалося — чому й «Спробувати ще». «Назад» — до «Хто ви?».
 */
export function LoadState({
  error,
  onRetry,
  onBack,
}: {
  error: unknown
  onRetry: () => void
  onBack: () => void
}) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-2" style={{ height: HEADER_BAR }}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          hitSlop={8}
          className="size-11 items-center justify-center active:opacity-50"
          style={{ marginTop: (HEADER_BAR - 44) / 2 }}
        >
          <Glyph name="back" size={24} color={c.foreground} weight="medium" />
        </Pressable>
      </View>
      <View className="flex-1 items-center justify-center gap-4 px-8">
        {error ? (
          <>
            <Text className="text-center text-[17px] leading-[23px] text-muted-foreground">
              {errorText(error)}
            </Text>
            <View className="self-stretch">
              <MonoButton label="Спробувати ще" onPress={onRetry} />
            </View>
          </>
        ) : (
          <ActivityIndicator color={c.mutedForeground} />
        )}
      </View>
    </View>
  )
}
