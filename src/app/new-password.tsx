import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text } from 'react-native'

import { PasswordField } from '@/components/auth/auth-fields'
import { AuthScreen } from '@/components/auth/auth-screen'
import { MonoButton } from '@/components/ui/mono-button'
import { authClient } from '@/lib/auth'
import { validEmail, validPassword } from '@/lib/auth-rules'

/**
 * Відновлення пароля, крок 3 — новий пароль (код уже перевірено на
 * `reset-code`). Одне поле з «оком», як у реєстрації (без «повторіть»;
 * iOS запропонує надійний). «Зберегти пароль» — скид кодом
 * (`emailOtp.resetPassword`) і одразу вхід із новим паролем: людина щойно
 * довела, що пошта її, вдруге вводити не треба. Сервер заодно підтверджує
 * пошту, а тому, хто входив лише через Google, створює вхід паролем.
 *
 * Код сплив чи вже не дійсний (поки придумував пароль, запросив новий) —
 * просимо повернутись і запросити новий. Вхід після скиду не вдався
 * (рідко, напр. ліміт) — на екран входу: пароль уже новий.
 */
export default function NewPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; otp?: string }>()
  const email = typeof params.email === 'string' ? params.email : ''
  const otp = typeof params.otp === 'string' ? params.otp : ''

  const [password, setPassword] = useState('')
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fieldError =
    checked && !validPassword(password) ? 'Мінімум 8 символів' : error

  async function submit() {
    if (busy) return
    setChecked(true)
    if (!validPassword(password)) return
    setBusy(true)
    setError(null)
    try {
      const { error: failed } = await authClient.emailOtp.resetPassword({
        email,
        otp,
        password,
      })
      if (failed) {
        if (
          failed.code === 'OTP_EXPIRED' ||
          failed.code === 'INVALID_OTP' ||
          failed.code === 'TOO_MANY_ATTEMPTS'
        )
          setError('Код уже не дійсний. Поверніться й запросіть новий')
        else if (failed.status === 429)
          setError('Забагато спроб. Спробуйте за хвилину')
        else setError('Не вдалося змінити пароль. Спробуйте ще раз')
        return
      }
      // Пароль новий — входимо ним; успіх — корінь сам відкриє застосунок.
      const { error: signInFailed } = await authClient.signIn.email({
        email,
        password,
      })
      if (signInFailed) router.dismissTo('/sign-in')
    } catch {
      setError('Немає зʼєднання з сервером. Перевірте інтернет.')
    } finally {
      setBusy(false)
    }
  }

  if (!validEmail(email) || !/^\d{6}$/.test(otp))
    return <Redirect href="/forgot-password" />

  return (
    <AuthScreen
      title="Новий пароль"
      subtitle={
        <Text className="text-center text-[16px] leading-[22px] text-muted-foreground">
          Для <Text className="font-semibold text-foreground">{email}</Text>
        </Text>
      }
      action={
        <MonoButton
          label="Зберегти пароль"
          onPress={submit}
          loading={busy}
          disabled={!password}
        />
      }
    >
      <PasswordField
        focusOnMount
        fresh
        label="Новий пароль"
        value={password}
        onChangeText={(text) => {
          setPassword(text)
          setError(null)
        }}
        error={fieldError}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
    </AuthScreen>
  )
}
