// Хід розмови з Zunor: POST /api/zunor/chat, відповідь — потік NDJSON
// (web/src/routes/api/zunor/chat/+server.ts):
//   {"t":"text","d":"шматок"}   — текст, що друкується
//   {"t":"final","r":{...}}      — підсумок ходу (ZunorResponse)
//
// Звичайний fetch у React Native тіло потоком не читає — тут `expo/fetch`.
// «Стоп» обриває запит, і сервер обриває запит до моделі (гроші).

import { fetch } from 'expo/fetch'
import { Platform } from 'react-native'

import { ApiError } from './api'
import { authClient } from './auth'
import { API_URL } from './config'
import type { ZunorClientMessage, ZunorResponse } from '@/shared/zunor'

const web = Platform.OS === 'web'

export async function askZunor(
  messages: ZunorClientMessage[],
  onText: (delta: string) => void,
  signal: AbortSignal,
): Promise<ZunorResponse | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (!web) {
    const cookie = await authClient.getCookie()
    if (cookie) headers.Cookie = cookie
  }

  const res = await fetch(`${API_URL}/api/zunor/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
    credentials: web ? 'same-origin' : 'omit',
    signal,
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      message?: string
    } | null
    throw new ApiError(res.status, data?.message ?? `HTTP ${res.status}`, data)
  }
  if (!res.body) return null

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let final: ZunorResponse | null = null

  const handle = (line: string) => {
    const s = line.trim()
    if (!s) return
    let evt: { t?: string; d?: string; r?: ZunorResponse }
    try {
      evt = JSON.parse(s)
    } catch {
      return
    }
    if (evt.t === 'text' && evt.d) onText(evt.d)
    else if (evt.t === 'final' && evt.r) final = evt.r
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // неповний рядок — на наступний шматок
      lines.forEach(handle)
    }
    handle(buffer)
  } finally {
    reader.releaseLock()
  }
  return final
}
