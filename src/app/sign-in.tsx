import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { EmailField, PasswordField } from '@/components/auth/auth-fields'
import { AuthScreen, FIELD_SHIFT } from '@/components/auth/auth-screen'
import { signInError } from '@/components/auth/sign-in-error'
import { MonoButton } from '@/components/ui/mono-button'
import type { TextFieldHandle } from '@/components/ui/text-field'
import { authClient } from '@/lib/auth'

/**
 * Вхід поштою й паролем — окремий екран (з привітання «Увійти»), як у
 * ClickUp (скриншот власника); каркас — AuthScreen:
 * коротка смуга, шеврон «Назад», заголовок без опису й логотипа, поля
 * сайту, «Увійти» — чорно-біла кнопка внизу, що їде над клавіатурою, під
 * нею «Забули пароль?» (`forgot-password` — код на пошту й новий пароль)
 * і «Зареєструватися» (`sign-up`). Поки пошти чи пароля немає, «Увійти»
 * бліда.
 *
 * Пошту не підтверджено (зареєструвався, а коду не ввів) — шлемо новий
 * код і ведемо на `verify-email`, як після реєстрації: колись тут було
 * «увійдіть на сайті».
 */
export default function SignInScreen() {
  const passwordRef = useRef<TextFieldHandle>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ready = email.trim().length > 0 && password.length > 0

  async function submit() {
    if (busy) return
    const address = email.trim().toLowerCase()
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
      if (!failed) return
      if (failed.code === 'EMAIL_NOT_VERIFIED') {
        const sent = await authClient.emailOtp.sendVerificationOtp({
          email: address,
          type: 'email-verification',
        })
        if (!sent.error) {
          router.push({ pathname: '/verify-email', params: { email: address } })
          return
        }
      }
      setError(signInError(failed))
    } catch {
      setError('Немає зʼєднання з сервером. Перевірте інтернет.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScreen
      title="Введіть пошту й пароль"
      action={
        <MonoButton
          label="Увійти"
          onPress={submit}
          loading={busy}
          disabled={!ready}
        />
      }
      footer={
        <>
          {/* Пошта, яку вже ввели, — одразу в полі відновлення. */}
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/forgot-password',
                params: { email: email.trim() },
              })
            }
            className="items-center py-1.5 active:opacity-60"
          >
            <Text className="text-[16px] font-semibold text-muted-foreground">
              Забули пароль?
            </Text>
          </Pressable>
          <View className="flex-row items-center justify-center gap-1.5 py-1.5">
            <Text className="text-[15px] text-muted-foreground">
              Немає акаунта?
            </Text>
            <Pressable
              onPress={() => router.replace('/sign-up')}
              className="active:opacity-60"
            >
              <Text className="text-[15px] font-semibold text-foreground">
                Зареєструватися
              </Text>
            </Pressable>
          </View>
        </>
      }
    >
      {/* Уже у фокусі, щойно екран зʼявився: рамка акценту з першого
          кадру, курсор і клавіатура — одразу (focusOnMount). */}
      <EmailField
        focusOnMount
        value={email}
        onChangeText={(text) => {
          setEmail(text)
          setError(null)
        }}
        onPicked={() => passwordRef.current?.focus()}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Animated.View layout={FIELD_SHIFT}>
        <PasswordField
          ref={passwordRef}
          value={password}
          onChangeText={(text) => {
            setPassword(text)
            setError(null)
          }}
          error={error}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </Animated.View>
    </AuthScreen>
  )
}
