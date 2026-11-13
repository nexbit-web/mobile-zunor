import { Redirect, useLocalSearchParams } from 'expo-router'

import { CodeScreen } from '@/components/auth/code-screen'
import { authClient } from '@/lib/auth'
import { validEmail } from '@/lib/auth-rules'

/**
 * Код із листа — двома дорогами, екран один (CodeScreen):
 *
 * - `?flow=signup` — одразу після реєстрації. Користувача ще НЕМАЄ:
 *   вірний код створює його (registration.verify на сервері,
 *   web/…/server/registration.ts) разом із сесією, і корінь сам веде на
 *   «Хто ви?». «Надіслати ще раз» — registration.resend.
 * - без нього — вхід уже наявним, але непідтвердженим акаунтом (старі
 *   акаунти, створені ще до цього): emailOTP, як раніше
 *   (`autoSignInAfterVerification` — теж одразу всередині).
 *
 * Пошта — з адреси екрана; немає чи не пошта — назад на реєстрацію.
 */
export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; flow?: string }>()
  const email = typeof params.email === 'string' ? params.email : ''
  const signup = params.flow === 'signup'

  if (!validEmail(email)) return <Redirect href="/sign-up" />

  return (
    <CodeScreen
      title="Підтвердіть пошту"
      email={email}
      check={(otp) =>
        signup
          ? authClient.registration.verify({ email, otp })
          : authClient.emailOtp.verifyEmail({ email, otp })
      }
      resend={() =>
        signup
          ? authClient.registration.resend({ email })
          : authClient.emailOtp.sendVerificationOtp({
              email,
              type: 'email-verification',
            })
      }
      back="/sign-up"
    />
  )
}
