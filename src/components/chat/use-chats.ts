import { useQuery, type QueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useRealtimeConnected } from '@/lib/realtime'
import type { ChatDetails, ChatMessage, ChatPreview } from '@/shared/chat'

/**
 * Список чатів — GET /api/chats, той самий, що в боковій панелі сайту.
 * Один кеш `['chats']` на список, вкладку «Чати» й бічну панель: число на
 * вкладці й рядки списку не розходяться.
 *
 * Нове повідомлення кладе в нього подія `chat:update` живого каналу
 * (RealtimeBridge → `applyChatUpdate`) — одразу, без запиту. Поки каналу
 * немає — перепит: часто, поки список на екрані, й раз на 30 с для
 * лічильника на вкладці.
 */
export function useChats(refetchInterval: number | false = 30_000) {
  const live = useRealtimeConnected()
  return useQuery({
    queryKey: ['chats'],
    queryFn: async () =>
      (await api<{ chats: ChatPreview[] }>('/api/chats')).chats,
    refetchInterval: live ? false : refetchInterval,
  })
}

/** Скільки непрочитаних повідомлень у всіх чатах — число на вкладці. */
export function useUnreadChats(): number {
  const { data } = useChats()
  return (data ?? []).reduce((n, chat) => n + chat.unreadCount, 0)
}

/** Чат прочитано — гасимо його лічильник одразу, не чекаючи запиту. */
export function markChatReadInList(qc: QueryClient, chatId: string): void {
  qc.setQueryData<ChatPreview[]>(['chats'], (list) =>
    list?.map((chat) =>
      chat.id === chatId && chat.unreadCount
        ? { ...chat, unreadCount: 0 }
        : chat,
    ),
  )
}

// ─── Живі оновлення списку ───

/** Розмова, що зараз на екрані: нове в ній непрочитаним не рахується. */
let openChat: string | null = null

/** Розмова відкрита (і в фокусі) — поки так, її лічильник не росте. */
export function setOpenChat(chatId: string): () => void {
  openChat = chatId
  return () => {
    if (openChat === chatId) openChat = null
  }
}

/** Ця розмова зараз на екрані — банер «вам написали» про неї зайвий. */
export function isChatOpen(chatId: string): boolean {
  return openChat === chatId
}

/** Подія `chat:update` сервера (api/chats/[id]/messages). */
export interface ChatUpdate {
  chatId: string
  lastMessageText: string | null
  lastMessageAt: string
  lastSenderId: string | null
  /** Хто написав — для банера (message-banner). Старий сервер їх не шле. */
  messageId?: string
  senderName?: string
  senderAvatar?: string | null
}

/**
 * Нове повідомлення — одразу в список і в число на вкладці, без запиту до
 * сервера, як стор сайту (`chat-store`, handleChatUpdate): рядок
 * піднімається нагору з новим текстом, лічильник +1, якщо писав
 * співрозмовник і розмова не відкрита. Раніше подія лише казала «перепитай
 * список», і число на вкладці чекало ще один запит до сайту — на Vercel
 * це секунди. Невідомий чат (щойно створений) — список перепитуємо.
 */
export function applyChatUpdate(
  qc: QueryClient,
  update: ChatUpdate,
  me: string | null,
): void {
  const list = qc.getQueryData<ChatPreview[]>(['chats'])
  const chat = list?.find((c) => c.id === update.chatId)
  if (!list || !chat) {
    void qc.invalidateQueries({ queryKey: ['chats'] })
    return
  }
  const fromPeer = Boolean(update.lastSenderId) && update.lastSenderId !== me
  const next: ChatPreview = {
    ...chat,
    lastMessageText: update.lastMessageText,
    lastMessageAt: update.lastMessageAt,
    lastSenderId: update.lastSenderId,
    unreadCount:
      fromPeer && openChat !== update.chatId
        ? chat.unreadCount + 1
        : chat.unreadCount,
  }
  qc.setQueryData<ChatPreview[]>(
    ['chats'],
    [next, ...list.filter((c) => c.id !== update.chatId)],
  )
}

/** Подія `chat:read` сервера (api/chats/[id]/read) — особистим каналом. */
export interface ChatRead {
  chatId: string
  readerId: string
  lastReadAt: string
}

/**
 * Хтось прочитав чат — одразу в список (як `chat-store` сайту):
 * - співрозмовник — ✓✓ біля мого останнього (і в шапці розмови з кешу,
 *   щоб відкрита згодом одразу показала ✓✓). Раніше це приходило лише
 *   каналом відкритої розмови, і список чекав перезавантаження;
 * - я сам на іншому пристрої (сайт) — лічильник гасне. Якщо після
 *   прочитаного вже прийшло нове, лишаємо: воно ще не прочитане.
 * Межа прочитаного назад не їде: події можуть прийти не по черзі.
 */
export function applyChatRead(
  qc: QueryClient,
  read: ChatRead,
  me: string | null,
): void {
  const mine = read.readerId === me
  qc.setQueryData<ChatPreview[]>(['chats'], (list) =>
    list?.map((chat) => {
      if (chat.id !== read.chatId) return chat
      if (mine) {
        if (!chat.unreadCount) return chat
        if (chat.lastMessageAt && chat.lastMessageAt > read.lastReadAt)
          return chat
        return { ...chat, unreadCount: 0 }
      }
      if (chat.peerLastReadAt && chat.peerLastReadAt >= read.lastReadAt)
        return chat
      return { ...chat, peerLastReadAt: read.lastReadAt }
    }),
  )
  if (mine) return
  qc.setQueryData<{ chat: ChatDetails; currentUserId: string }>(
    ['chat', read.chatId],
    (old) =>
      old &&
      (!old.chat.peerLastReadAt || old.chat.peerLastReadAt < read.lastReadAt)
        ? { ...old, chat: { ...old.chat, peerLastReadAt: read.lastReadAt } }
        : old,
  )
}

/** Для пошуку: без регістру, апострофи й «ё» — одним записом. */
const fold = (s: string) =>
  s.toLowerCase().replace(/[ʼ’`]/g, "'").replace(/ё/g, 'е')

/**
 * Пошук у списку чатів (екран «Чати», лупа в шапці): спершу збіги в імені
 * чи @імені співрозмовника, далі — в останньому повідомленні. Порожній
 * запит — усі чати. Шукаємо на місці: список і так увесь у кеші.
 */
export function searchChats(
  chats: ChatPreview[],
  query: string,
): ChatPreview[] {
  const q = fold(query.trim().replace(/^@/, ''))
  if (!q) return chats
  const byName: ChatPreview[] = []
  const byText: ChatPreview[] = []
  for (const chat of chats) {
    if (fold(`${chat.peer.name} ${chat.peer.username ?? ''}`).includes(q)) {
      byName.push(chat)
    } else if (chat.lastMessageText && fold(chat.lastMessageText).includes(q)) {
      byText.push(chat)
    }
  }
  return [...byName, ...byText]
}

/** Підпис рядка в списку — як його пише сервер (api/chats/[id]/messages). */
export function previewText(m: ChatMessage): string {
  if (m.type === 'TEXT') return m.text.slice(0, 200)
  return m.type === 'PHOTO' ? '📷 Фото' : '📎 Файл'
}
