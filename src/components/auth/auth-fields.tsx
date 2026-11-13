import { useState, type Ref } from 'react'
import { Pressable, type TextInputProps } from 'react-native'

import { EmailDomains } from '@/components/auth/email-domains'
import { Glyph } from '@/components/icons/glyph'
import { TextField, type TextFieldHandle } from '@/components/ui/text-field'
import { useColors } from '@/lib/theme'

/**
 * Поле пошти входу й реєстрації: клавіатура пошти, автозаповнення і
 * плашки доменів під ним (EmailDomains), поки людина в полі. Обрала
 * плашку — пошта дописана, `onPicked` переводить далі (на пароль).
 * Фрагмент — щоб відступи між полем і плашками давав батько.
 */
export function EmailField({
  ref,
  value,
  onChangeText,
  onPicked,
  onSubmitEditing,
  returnKeyType = 'next',
  error,
  focusOnMount,
}: {
  ref?: Ref<TextFieldHandle>
  value: string
  onChangeText: (text: string) => void
  /** Обрали домен — пошта вже повна. */
  onPicked: () => void
  onSubmitEditing?: () => void
  /** «Далі» (до пароля) — або «Надіслати», коли поле одне. */
  returnKeyType?: TextInputProps['returnKeyType']
  error?: string | null
  focusOnMount?: boolean
}) {
  const [inside, setInside] = useState(focusOnMount ?? false)
  return (
    <>
      <TextField
        ref={ref}
        focusOnMount={focusOnMount}
        label="Ваша електронна пошта"
        value={value}
        onChangeText={onChangeText}
        error={error}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        submitBehavior="submit"
        onFocus={() => setInside(true)}
        onBlur={() => setInside(false)}
      />
      <EmailDomains
        value={value}
        visible={inside}
        onPick={(full) => {
          onChangeText(full)
          onPicked()
        }}
      />
    </>
  )
}

/**
 * Поле пароля з «оком» праворуч — показати / сховати. `fresh` —
 * реєстрація й новий пароль: iOS запропонує надійний і збереже його.
 */
export function PasswordField({
  ref,
  label = 'Пароль',
  value,
  onChangeText,
  error,
  fresh = false,
  focusOnMount,
  returnKeyType,
  onSubmitEditing,
}: {
  ref?: Ref<TextFieldHandle>
  label?: string
  value: string
  onChangeText: (text: string) => void
  error?: string | null
  fresh?: boolean
  focusOnMount?: boolean
  returnKeyType?: TextInputProps['returnKeyType']
  onSubmitEditing?: () => void
}) {
  const c = useColors()
  const [shown, setShown] = useState(false)
  return (
    <TextField
      ref={ref}
      focusOnMount={focusOnMount}
      label={label}
      value={value}
      onChangeText={onChangeText}
      error={error}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={fresh ? 'new-password' : 'current-password'}
      textContentType={fresh ? 'newPassword' : 'password'}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      trailing={
        <Pressable
          onPress={() => setShown((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Сховати пароль' : 'Показати пароль'}
          accessibilityState={{ selected: shown }}
          hitSlop={4}
          className="size-11 items-center justify-center rounded-full active:opacity-50"
        >
          <Glyph
            name={shown ? 'eyeOff' : 'eye'}
            size={21}
            color={c.mutedForeground}
          />
        </Pressable>
      }
    />
  )
}
