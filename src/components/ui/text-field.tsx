import type { ComponentRef, Ref } from 'react'
import { Text, TextInput, View, type TextInputProps } from 'react-native'

/** Те, що отримує `ref` поля: для фокуса з коду (`.focus()`). */
export type TextFieldHandle = ComponentRef<typeof TextInput>

import { useColors } from '@/lib/theme'

/**
 * Поле вводу — як на сайті: фон `field`, рамка `input`, жирний підпис над
 * полем, помилка під ним (не в тості — там на неї дивляться).
 */
export function TextField({
  ref,
  label,
  error,
  className = '',
  ...props
}: TextInputProps & {
  ref?: Ref<TextFieldHandle>
  label: string
  error?: string | null
}) {
  const c = useColors()
  return (
    <View className="gap-2">
      <Text className="text-[14px] font-semibold text-foreground">{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={c.mutedForeground}
        className={`h-[50px] rounded-[14px] bg-field px-4 text-[16px] text-foreground ${className}`}
        {...props}
      />
      {error ? (
        <Text className="text-[13px] text-destructive">{error}</Text>
      ) : null}
    </View>
  )
}
