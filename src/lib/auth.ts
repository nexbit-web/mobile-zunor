// Вхід — той самий better-auth, що й на сайті (web/src/lib/server/auth.ts).
// Сесія лежить у SecureStore і йде на сервер заголовком Cookie (api.ts).
// У браузері (dev) плагін expo нічого не робить: там сесія — звичайна
// cookie сайту через dev-проксі, а SecureStore порожній і не читається.
//
// На сервері для цього — плагін `expo()` і `zunor://` (у dev ще `exp://`)
// у trustedOrigins (web/AGENTS.md, 7.9). Версія better-auth тут і на
// сайті однакова (~1.6.34) — оновлювати разом.

import { expoClient } from '@better-auth/expo/client'
import {
  emailOTPClient,
  inferAdditionalFields,
} from 'better-auth/client/plugins'
import type { BetterAuthClientPlugin } from 'better-auth/client'
import { createAuthClient } from 'better-auth/react'
import * as SecureStore from 'expo-secure-store'

import { API_URL } from './config'

/** Тіло помилки better-auth: код (`INVALID_OTP`…) і текст. */
type AuthErrorBody = { code?: string; message?: string }

/**
 * Реєстрація з кодом ДО створення користувача — плагін сервера
 * `registration` (web/src/lib/server/registration.ts): start (імʼя, пошта,
 * пароль → лист із кодом, користувача ще немає), resend, verify (вірний
 * код → користувач і сесія). Типів сервера тут немає (інший репозиторій),
 * тож дії — руками; verify будить сесію, як вхід. Стандартний
 * `signUp.email` сервер закрив.
 */
const registrationClient = () =>
  ({
    id: 'registration',
    getActions: ($fetch, $store) => ({
      registration: {
        start: (body: { name: string; email: string; password: string }) =>
          $fetch<{ success: boolean }, AuthErrorBody>('/registration/start', {
            method: 'POST',
            body,
          }),
        resend: (body: { email: string }) =>
          $fetch<{ success: boolean }, AuthErrorBody>('/registration/resend', {
            method: 'POST',
            body,
          }),
        verify: async (body: { email: string; otp: string }) => {
          const res = await $fetch<{ token: string }, AuthErrorBody>(
            '/registration/verify',
            {
              method: 'POST',
              body,
            },
          )
          if (!res.error) $store.notify('$sessionSignal')
          return res
        },
      },
    }),
  }) satisfies BetterAuthClientPlugin

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: 'zunor',
      storagePrefix: 'zunor',
      // На сервері `advanced.cookiePrefix: 'zunor'`. Без цього клієнт шукав
      // би cookie `better-auth.*`, не впізнавав би свою сесію й
      // перепитував її без кінця.
      cookiePrefix: 'zunor',
      storage: SecureStore,
    }),
    // Код підтвердження пошти після реєстрації (emailOTP на сервері,
    // як `emailOtp` у web/src/lib/auth-client.ts).
    emailOTPClient(),
    registrationClient(),
    // Поля користувача понад стандартні — ті самі, що в `user.additionalFields`
    // на сервері. Лише для типів: пише їх тільки сервер.
    inferAdditionalFields({
      user: {
        role: { type: 'string', required: false, input: false },
        city: { type: 'string', required: false, input: false },
        onboarded: { type: 'boolean', required: false, input: false },
        banned: { type: 'boolean', required: false, input: false },
      },
    }),
  ],
})

export type Role = 'CLIENT' | 'MASTER' | 'ADMIN' | 'MANAGER' | 'MODERATOR'

/** Роль із сесії; невідома чи порожня — клієнт, як і на сайті. */
export function roleOf(user: { role?: string | null } | undefined): Role {
  const r = user?.role
  return r === 'MASTER' || r === 'ADMIN' || r === 'MANAGER' || r === 'MODERATOR'
    ? r
    : 'CLIENT'
}

/** Співробітник (адмінка): анкети клієнта чи майстра в нього може не бути. */
export function isStaff(role: Role): boolean {
  return role === 'ADMIN' || role === 'MANAGER' || role === 'MODERATOR'
}
