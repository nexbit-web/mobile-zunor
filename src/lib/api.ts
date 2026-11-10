// Запити до API сайту з сесією користувача.
//
// На телефоні better-auth зберігає cookie сам (SecureStore), тож його
// треба покласти в заголовок вручну, а `credentials: 'omit'` — щоб
// нативний fetch не змішував його зі своїми cookie (так радить better-auth).
// У браузері сесія — звичайна httpOnly cookie сайту на нашій же адресі
// (dev-проксі, config.ts): її шле сам браузер, а JS її й не бачить.

import { Platform } from 'react-native'

import { authClient } from './auth'
import { API_URL } from './config'

const web = Platform.OS === 'web'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message)
  }
}

type ApiInit = Omit<RequestInit, 'body'> & {
  /** Тіло як JSON — серіалізується тут, з потрібним заголовком. */
  json?: unknown
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, headers: extra, ...rest } = init
  const headers = new Headers(extra)
  if (!web) {
    const cookie = await authClient.getCookie()
    if (cookie) headers.set('Cookie', cookie)
  }
  if (json !== undefined) headers.set('Content-Type', 'application/json')

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
    credentials: web ? 'same-origin' : 'omit',
  })

  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    // Сайт віддає помилку як { message } (error() SvelteKit), а кілька
    // старих ендпоінтів — як { error }.
    const body = (data ?? {}) as { message?: string; error?: string }
    throw new ApiError(
      res.status,
      body.message ?? body.error ?? `HTTP ${res.status}`,
      data,
    )
  }
  return data as T
}

/** Текст для людини замість технічної помилки. */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Сесія закінчилась. Увійдіть ще раз.'
    if (err.status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.'
    if (err.status >= 500) return 'Сервер не відповідає. Спробуйте ще раз.'
    return err.message
  }
  return "Немає зʼєднання. Перевірте інтернет."
}
