import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { EmailField, PasswordField } from '@/components/auth/auth-fields'
import { AuthScreen, FIELD_SHIFT } from '@/components/auth/auth-screen'
import { MonoButton } from '@/components/ui/mono-button'
import { TextField, type TextFieldHandle } from '@/components/ui/text-field'
import { authClient } from '@/lib/auth'
import { validEmail, validName, validPassword } from '@/lib/auth-rules'
import { SITE_URL } from '@/lib/config'

/**
 * Реєстрація — як на сайті (signup-form): імʼя, пошта, пароль, без
 * «повторіть пароль» (є «око»). Каркас — AuthScreen, як вхід: коротка
 * смуга, шеврон, заголовок, «Зареєструватися» внизу над клавіатурою, під
 * нею «Вже є акаунт? Увійти» і юридичний рядок (умови й політика —
 * сторінки сайту).
 *
 * Помилки полів — після першого натиску «Зареєструватися» (і далі
 * живо), як на сайті: людина дізнається, що не так, із конкретного поля.
 * Акаунта після «Зареєструватися» ще НЕМАЄ: сервер лише кладе заявку й
 * шле код (registration.start, web/…/server/registration.ts), а
 * користувач зʼявляється в базі з вірним кодом на `verify-email` — і
 * людина одразу всередині, далі «Хто ви?» й анкета. Відповідь однакова,
 * є акаунт із цією поштою чи ні (форма не каже, чия пошта
 * зареєстрована).
 */
export default function SignUpScreen() {
  const emailRef = useRef<TextFieldHandle>(null)
  const passwordRef = useRef<TextFieldHandle>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [checked, setChecked] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const nameError =
    checked && !validName(name) ? 'Вкажіть імʼя (2–50 символів)' : null
  const emailError =
    checked && !validEmail(email) ? 'Невірний формат пошти' : null
  const passwordError =
    checked && !validPassword(password) ? 'Мінімум 8 символів' : null
  const filled = name.trim() !== '' && email.trim() !== '' && password !== ''

  async function submit() {
    if (busy) return
    setChecked(true)
    if (!validName(name) || !validEmail(email) || !validPassword(password))
      return
    setBusy(true)
    setServerError(null)
    const address = email.trim().toLowerCase()
    try {
      const { error } = await authClient.registration.start({
        name: name.trim(),
        email: address,
        password,
      })
      if (error) {
        setServerError(
          error.status === 429
            ? 'Забагато спроб. Спробуйте пізніше'
            : 'Не вдалося створити акаунт',
        )
        return
      }
      router.push({
        pathname: '/verify-email',
        params: { email: address, flow: 'signup' },
      })
    } catch {
      setServerError('Немає зʼєднання з сервером. Перевірте інтернет.')
    } finally {
      setBusy(false)
    }
  }

  const openSite = (path: string) => () =>
    WebBrowser.openBrowserAsync(`${SITE_URL}${path}`)

  return (
    <AuthScreen
      title="Створіть акаунт"
      action={
        <MonoButton
          label="Зареєструватися"
          onPress={submit}
          loading={busy}
          disabled={!filled}
        />
      }
      footer={
        <>
          <View className="flex-row items-center justify-center gap-1.5 py-1.5">
            <Text className="text-[15px] text-muted-foreground">
              Вже є акаунт?
            </Text>
            <Pressable
              onPress={() => router.replace('/sign-in')}
              className="active:opacity-60"
            >
              <Text className="text-[15px] font-semibold text-foreground">
                Увійти
              </Text>
            </Pressable>
          </View>
          <Text className="px-2 pt-1 text-center text-[12px] leading-[17px] text-muted-foreground">
            Реєструючись, ви погоджуєтеся з{' '}
            <Text
              accessibilityRole="link"
              onPress={openSite('/terms')}
              className="font-semibold text-foreground"
            >
              Умовами
            </Text>{' '}
            і{' '}
            <Text
              accessibilityRole="link"
              onPress={openSite('/privacy')}
              className="font-semibold text-foreground"
            >
              Політикою конфіденційності
            </Text>
            .
          </Text>
        </>
      }
    >
      <TextField
        focusOnMount
        label="Повне імʼя"
        value={name}
        onChangeText={(text) => {
          setName(text)
          setServerError(null)
        }}
        error={nameError}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={50}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />
      <EmailField
        ref={emailRef}
        value={email}
        error={emailError}
        onChangeText={(text) => {
          setEmail(text)
          setServerError(null)
        }}
        onPicked={() => passwordRef.current?.focus()}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Animated.View layout={FIELD_SHIFT}>
        <PasswordField
          ref={passwordRef}
          fresh
          value={password}
          onChangeText={(text) => {
            setPassword(text)
            setServerError(null)
          }}
          error={passwordError ?? serverError}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </Animated.View>
    </AuthScreen>
  )
}
