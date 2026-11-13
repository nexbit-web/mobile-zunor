import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { EmailField } from '@/components/auth/auth-fields'
import { AuthScreen } from '@/components/auth/auth-screen'
import { MonoButton } from '@/components/ui/mono-button'
import { authClient } from '@/lib/auth'
import { validEmail } from '@/lib/auth-rules'

/**
 * «Забули пароль?» — перший крок відновлення (з входу; пошта, яку там уже
 * ввели, — одразу в полі). Сайт шле посилання, а застосунок — код
 * (плагін emailOTP, тип `forget-password`; лист «Код для скидання пароля»
 * сервер уже вміє): посилання з Пошти відкрилось би в Safari, а не тут.
 * Далі `reset-code` (код) → `new-password` (новий пароль і одразу вхід).
 *
 * Сервер не каже, чи є акаунт із такою поштою, — відповідь та сама, тож
 * на код людина йде завжди (як на сайті).
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(
    typeof params.email === 'string' ? params.email : '',
  )
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const emailError =
    checked && !validEmail(email) ? 'Невірний формат пошти' : error

  async function submit() {
    if (busy) return
    setChecked(true)
    if (!validEmail(email)) return
    setBusy(true)
    setError(null)
    const address = email.trim().toLowerCase()
    try {
      const { error: failed } = await authClient.emailOtp.requestPasswordReset({
        email: address,
      })
      if (failed) {
        setError(
          failed.status === 429
            ? 'Забагато спроб. Спробуйте за хвилину'
            : 'Не вдалося надіслати код. Спробуйте ще раз',
        )
        return
      }
      router.push({ pathname: '/reset-code', params: { email: address } })
    } catch {
      setError('Немає зʼєднання з сервером. Перевірте інтернет.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScreen
      title="Забули пароль?"
      subtitle={
        <Text className="text-center text-[16px] leading-[22px] text-muted-foreground">
          Надішлемо код на пошту — з ним задасте новий пароль.
        </Text>
      }
      action={
        <MonoButton
          label="Надіслати код"
          onPress={submit}
          loading={busy}
          disabled={!email.trim()}
        />
      }
      footer={
        <View className="flex-row items-center justify-center gap-1.5 py-1.5">
          <Text className="text-[15px] text-muted-foreground">
            Згадали пароль?
          </Text>
          <Pressable
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/sign-in')
            }
            className="active:opacity-60"
          >
            <Text className="text-[15px] font-semibold text-foreground">
              Увійти
            </Text>
          </Pressable>
        </View>
      }
    >
      <EmailField
        focusOnMount
        value={email}
        error={emailError}
        onChangeText={(text) => {
          setEmail(text)
          setError(null)
        }}
        // Домен дописано — пошта повна, далі хіба «Надіслати код».
        onPicked={() => {}}
        returnKeyType="send"
        onSubmitEditing={submit}
      />
    </AuthScreen>
  )
}
