import { Redirect, router, useLocalSearchParams } from 'expo-router'

import { CodeScreen } from '@/components/auth/code-screen'
import { authClient } from '@/lib/auth'
import { validEmail } from '@/lib/auth-rules'

/**
 * Відновлення пароля, крок 2 — код із листа (спільний CodeScreen, як
 * підтвердження пошти). Код лише ПЕРЕВІРЯЄМО (`check-verification-otp`:
 * невірні спроби рахуються, вірний не згорає) — і йдемо по новий пароль;
 * витрачає код сам скид на `new-password`. Так помилку в коді видно
 * одразу, а не після того, як людина вже придумала пароль.
 */
export default function ResetCodeScreen() {
  const params = useLocalSearchParams<{ email?: string }>()
  const email = typeof params.email === 'string' ? params.email : ''

  if (!validEmail(email)) return <Redirect href="/forgot-password" />

  return (
    <CodeScreen
      title="Перевірте пошту"
      email={email}
      ifExists
      check={(otp) =>
        authClient.emailOtp.checkVerificationOtp({
          email,
          otp,
          type: 'forget-password',
        })
      }
      onVerified={(otp) =>
        router.push({ pathname: '/new-password', params: { email, otp } })
      }
      resend={() => authClient.emailOtp.requestPasswordReset({ email })}
      back="/forgot-password"
    />
  )
}
