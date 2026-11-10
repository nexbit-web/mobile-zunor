import { ActivityIndicator, Pressable, Text } from 'react-native'

const VARIANTS = {
  primary: {
    box: 'bg-primary active:opacity-85',
    text: 'text-primary-foreground',
  },
  secondary: {
    box: 'bg-secondary active:opacity-75',
    text: 'text-foreground',
  },
  ghost: { box: 'active:bg-secondary', text: 'text-foreground' },
} as const

/**
 * Кнопка в мові сайту (ui/button у web): пласка заливка без тіні,
 * скруглення, акцентна — колір `primary`. Висота 50 — під палець.
 */
export function Button({
  children,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
}: {
  children: string
  onPress?: () => void
  variant?: keyof typeof VARIANTS
  loading?: boolean
  disabled?: boolean
  className?: string
}) {
  const v = VARIANTS[variant]
  const off = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      className={`h-[50px] flex-row items-center justify-center gap-2 rounded-[14px] px-5 disabled:opacity-55 ${v.box} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#ffffff' : undefined} />
      ) : null}
      <Text className={`text-[16px] font-semibold ${v.text}`}>
        {loading ? 'Зачекайте…' : children}
      </Text>
    </Pressable>
  )
}
