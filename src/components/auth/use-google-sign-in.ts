import { useRef, useState } from 'react'

import { authClient } from '@/lib/auth'

import { signInError } from './sign-in-error'

/**
 * Вхід через Google — `signIn.social` плагіна expo: системне вікно
 * браузера (ASWebAuthenticationSession / Custom Tabs) на сайт → Google →
 * колбек сайту → назад у застосунок за нашою схемою (`zunor://`, в Expo
 * Go — `exp://`). Сесію в адресу повернення дописує плагін `expo()` на
 * сервері (`?cookie=`), клієнт кладе її в SecureStore — і корінь сам
 * відкриває застосунок. Новий акаунт приходить без анкети — застосунок
 * запропонує її заповнити.
 *
 * Закрив вікно — нічого не кажемо: людина передумала сама. Помилка
 * сервера — `error`, рядок під кнопкою.
 */
export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const running = useRef(false)

  async function start() {
    if (running.current) return
    running.current = true
    setLoading(true)
    setError(null)
    try {
      // Відносні адреси плагін перетворює на адресу застосунку
      // (Linking.createURL). Помилка Google теж повертає в застосунок, а
      // не лишає людину на сторінці помилки сайту в браузері.
      const { error: failed } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
        errorCallbackURL: '/welcome',
      })
      if (failed) setError(signInError(failed))
    } catch {
      setError('Немає зʼєднання з сервером. Перевірте інтернет.')
    } finally {
      running.current = false
      setLoading(false)
    }
  }

  return { start, loading, error }
}
