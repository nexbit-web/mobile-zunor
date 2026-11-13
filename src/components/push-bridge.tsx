import { useQueryClient } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import { api } from '@/lib/api'
import { authClient } from '@/lib/auth'
import { openNotification } from '@/lib/open-notification'
import { syncPush } from '@/lib/push'

/** Відкриті вже push (id запиту) — щоб повторний рендер не відкрив удруге. */
const handled = new Set<string>()

/**
 * Push, поки людина в застосунку (lib/push):
 * - раз за запуск оновлює запис пристрою на сайті (токен міг змінитись);
 * - дотик до push — туди ж, куди веде рядок у стрічці сповіщень
 *   (заявка, розмова, сайт; вести нікуди — сама стрічка), і сповіщення
 *   стає прочитаним. Працює й тоді, коли застосунок запустився з дотику:
 *   останню відповідь Expo тримає до нашого монтування.
 *
 * Монтується в каркасі (app) — тобто лише з сесією й анкетою.
 */
export function PushBridge() {
  const { data: session } = authClient.useSession()
  const userId = session?.user.id
  const qc = useQueryClient()

  useEffect(() => {
    if (userId) void syncPush(userId)
  }, [userId])

  const response = Notifications.useLastNotificationResponse()

  useEffect(() => {
    if (Platform.OS === 'web' || !response) return
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return
    }
    const request = response.notification.request
    if (handled.has(request.identifier)) return
    handled.add(request.identifier)

    const data = (request.content.data ?? {}) as {
      notificationId?: unknown
      type?: unknown
      jobId?: unknown
      orderId?: unknown
      chatId?: unknown
    }
    const text = (v: unknown) => (typeof v === 'string' && v ? v : null)

    const id = text(data.notificationId)
    if (id) {
      void api('/api/notifications', {
        method: 'POST',
        json: { action: 'mark-read', ids: [id] },
      })
        .then(() =>
          Promise.all([
            qc.invalidateQueries({ queryKey: ['notifications'] }),
            qc.invalidateQueries({ queryKey: ['badges'] }),
          ]),
        )
        .catch(() => {})
    }

    const opened = openNotification({
      type: text(data.type) ?? '',
      jobId: text(data.jobId),
      orderId: text(data.orderId),
      chatId: text(data.chatId),
    })
    if (!opened) router.push('/notifications')
    void Notifications.clearLastNotificationResponseAsync()
  }, [response, qc])

  return null
}
