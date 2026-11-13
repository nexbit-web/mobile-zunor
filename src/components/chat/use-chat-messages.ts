import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { api } from '@/lib/api'
import type { ChatMessage, MessagesPage } from '@/shared/chat'

const page = (chatId: string, cursor?: string) =>
  api<MessagesPage>(
    `/api/chats/${encodeURIComponent(chatId)}/messages${
      cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
    }`,
  )

/**
 * Повідомлення розмови: свіжа сторінка (50 останніх) перепитується, поки
 * розмова на екрані, а старіші довантажуються, коли людина гортає вгору.
 *
 * Усе, що прийшло, складається в одне сховище за id — а не в сторінки:
 * свіжа сторінка «їде» з кожним новим повідомленням, і повідомлення, що
 * випали з неї, не мусять зникати з екрана. Старіші беремо від
 * найстаршого відомого id (курсор сайту), тож дірки між свіжою й
 * старішими не буває.
 *
 * Нове приносить живий канал (події кладе chat-screen через upsert/patch);
 * `poll` — перепит, поки каналу немає (на тлі React Query його зупиняє).
 */
export function useChatMessages(chatId: string, poll: number | false) {
  const latest = useQuery({
    queryKey: ['chat', chatId, 'latest'],
    queryFn: () => page(chatId),
    refetchInterval: poll,
  })

  const [byId, setById] = useState<Record<string, ChatMessage>>({})
  const [hasOlder, setHasOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const known = useRef(false)
  const busy = useRef(false)

  useEffect(() => {
    const data = latest.data
    if (!data) return
    setById((prev) => {
      const next = { ...prev }
      for (const m of data.messages) next[m.id] = m
      return next
    })
    // Чи є старіші — знаємо з першої відповіді; далі каже догрузка.
    if (!known.current) {
      known.current = true
      setHasOlder(data.nextCursor !== null)
    }
  }, [latest.data])

  /** Новіші — першими (список перевернутий: низ — найсвіжіше). */
  const messages = useMemo(
    () =>
      Object.values(byId).sort((a, b) =>
        a.createdAt === b.createdAt
          ? b.id.localeCompare(a.id)
          : b.createdAt.localeCompare(a.createdAt),
      ),
    [byId],
  )

  const loadOlder = useCallback(async () => {
    const oldest = messages[messages.length - 1]
    if (!hasOlder || busy.current || !oldest) return
    busy.current = true
    setLoadingOlder(true)
    try {
      const res = await page(chatId, oldest.id)
      setById((prev) => {
        const next = { ...prev }
        for (const m of res.messages) next[m.id] = next[m.id] ?? m
        return next
      })
      setHasOlder(res.nextCursor !== null)
    } catch {
      // Мережа — спробуємо, коли людина догорне ще раз.
    } finally {
      busy.current = false
      setLoadingOlder(false)
    }
  }, [chatId, hasOlder, messages])

  /** Повідомлення з сервера (щойно надіслане) — одразу в розмову. */
  const upsert = useCallback((m: ChatMessage) => {
    setById((prev) => ({ ...prev, [m.id]: m }))
  }, [])

  /** Правка на місці (оптимістично чи з відповіді сервера). */
  const patch = useCallback(
    (id: string, fn: (m: ChatMessage) => ChatMessage) => {
      setById((prev) => (prev[id] ? { ...prev, [id]: fn(prev[id]) } : prev))
    },
    [],
  )

  return {
    messages,
    pending: latest.isPending,
    error: latest.isError ? latest.error : null,
    refetch: latest.refetch,
    hasOlder,
    loadingOlder,
    loadOlder,
    upsert,
    patch,
  }
}
