import * as WebBrowser from 'expo-web-browser'
import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/button'
import { TextField, type TextFieldHandle } from '@/components/ui/text-field'
import { ZunorMark } from '@/components/zunor-mark'
import { authClient } from '@/lib/auth'
import { SITE_URL } from '@/lib/config'
import { useColors } from '@/lib/theme'

/**
 * Вхід — поштою й паролем, як на сайті. Реєстрація й відновлення пароля
 * поки на сайті: там підтвердження пошти кодом і онбординг.
 */
export default function SignInScreen() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const passwordRef = useRef<TextFieldHandle>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) return
    const address = email.trim()
    if (!address || !password) {
      setError('Вкажіть пошту й пароль')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error: failed } = await authClient.signIn.email({
        email: address,
        password,
      })
      // Успіх — сесія оновиться, і корінь сам відкриє застосунок.
      if (failed) setError(signInError(failed))
    } catch {
      setError("Немає зʼєднання з сервером. Перевірте інтернет.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow justify-center px-6"
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View className="mb-10 items-center gap-4">
          <ZunorMark size={56} color={c.foreground} />
          <View className="items-center gap-1.5">
            <Text className="text-[28px] font-bold text-foreground">
              Вхід у Zunor
            </Text>
            <Text className="text-center text-[15px] text-muted-foreground">
              Прибирання без пошуку виконавця
            </Text>
          </View>
        </View>

        <View className="gap-4">
          <TextField
            label="Пошта"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
          />
          <TextField
            ref={passwordRef}
            label="Пароль"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            error={error}
          />
          <Button onPress={submit} loading={busy} className="mt-2">
            Увійти
          </Button>
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/user/forgot`)}
            className="items-center py-2 active:opacity-60"
          >
            <Text className="text-[15px] font-medium text-primary">
              Забули пароль?
            </Text>
          </Pressable>
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-1.5">
          <Text className="text-[15px] text-muted-foreground">
            Немає акаунта?
          </Text>
          <Pressable
            onPress={() =>
              WebBrowser.openBrowserAsync(`${SITE_URL}/user/register`)
            }
            className="active:opacity-60"
          >
            <Text className="text-[15px] font-semibold text-foreground">
              Зареєструватися
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// За кодом better-auth, а не за статусом: 403 — це і «пошту не
// підтверджено», і «чужа адреса застосунку» (INVALID_ORIGIN), а людині
// треба різне.
function signInError(err: {
  status: number
  code?: string
  message?: string
}): string {
  if (err.code === 'INVALID_EMAIL_OR_PASSWORD' || err.status === 401)
    return 'Невірна пошта або пароль'
  if (err.code === 'EMAIL_NOT_VERIFIED')
    return 'Пошту ще не підтверджено. Увійдіть на сайті — там надішлемо код'
  if (err.code === 'INVALID_ORIGIN')
    return __DEV__
      ? 'Сервер не пускає вхід з Expo Go: на ньому потрібен ZUNOR_EXPO_GO=1 (web/docs/deploy-vercel.md)'
      : 'Ця версія застосунку застаріла. Оновіть її'
  if (err.status === 429) return 'Забагато спроб. Спробуйте за хвилину'
  return err.message || 'Не вдалося увійти. Спробуйте ще раз'
}
