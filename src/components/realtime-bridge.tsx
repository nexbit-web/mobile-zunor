import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState } from 'react-native'

import {
  applyChatRead,
  applyChatUpdate,
  isChatOpen,
  type ChatRead,
  type ChatUpdate,
} from '@/components/chat/use-chats'
import { showMessageBanner } from '@/components/message-banner'
import { authClient } from '@/lib/auth'
import {
  setUserChannel,
  startRealtime,
  stopRealtime,
  useChannel,
} from '@/lib/realtime'
import type { ChatPreview } from '@/shared/chat'

/**
 * Живий канал людини — поки вона в застосунку (каркас після входу). Як
 * стори сайту (notifications/store, chat-store): подія одразу міняє те,
 * що на екрані, — без запиту до сервера, кеш той самий, що в екранів.
 *
 *   notification:new → +1 у дзвіночку, стрічка перепитується (якщо відкрита)
 *   chat:update      → рядок чату нагору, +1 на вкладці «Чати»
 *   chat:read        → ✓✓ співрозмовника в списку; своє прочитане на
 *                      іншому пристрої гасить лічильник
 *
 * Підписались (і після кожного повторного зʼєднання — тло, мережа) —
 * докачуємо лічильники: за час без каналу події пропали.
 *
 * Вихід з акаунта прибирає каркас — разом із ним і зʼєднання.
 */
export function RealtimeBridge() {
  const qc = useQueryClient()
  const { data } = authClient.useSession()
  const me = data?.user?.id ?? null

  const channel = me ? `private-user-${me}` : null

  useEffect(() => {
    if (!me) return
    void startRealtime()
    return () => stopRealtime()
  }, [me])

  // Від підписки на цей канал бейджі й списки знають, що перепит не треба.
  useEffect(() => {
    setUserChannel(channel)
  }, [channel])

  useChannel(channel, {
    'notification:new': () => {
      qc.setQueryData<{ notifications: number }>(['badges'], (b) =>
        b ? { ...b, notifications: b.notifications + 1 } : b,
      )
      // Стрічка — лише якщо вона на екрані; число вже правильне, сервер
      // перепитаємо, коли знадобиться.
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      void qc.invalidateQueries({ queryKey: ['badges'], refetchType: 'none' })
    },
    'chat:update': (d: ChatUpdate) => {
      applyChatUpdate(qc, d, me)
      // Написав співрозмовник, а розмова не на екрані — картка згори.
      // Застосунок у фоні — це справа push (lib/push).
      if (
        d.lastSenderId &&
        d.lastSenderId !== me &&
        !isChatOpen(d.chatId) &&
        AppState.currentState === 'active'
      ) {
        const peer = qc
          .getQueryData<ChatPreview[]>(['chats'])
          ?.find((chat) => chat.id === d.chatId)?.peer
        showMessageBanner({
          chatId: d.chatId,
          name: d.senderName || peer?.name || 'Нове повідомлення',
          avatar: d.senderAvatar ?? peer?.avatar ?? null,
          text: d.lastMessageText ?? '',
        })
      }
    },
    'chat:read': (d: ChatRead) => applyChatRead(qc, d, me),
    'pusher:subscription_succeeded': () => {
      // Запит, що вже йде, не перезапускаємо (cancelRefetch: false).
      for (const key of ['badges', 'chats', 'notifications']) {
        void qc.invalidateQueries({ queryKey: [key] }, { cancelRefetch: false })
      }
    },
  })

  return null
}
