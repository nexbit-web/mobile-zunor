import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'

import { SITE_URL } from '@/lib/config'
import {
  notificationTarget,
  type AppNotification,
} from '@/shared/notifications'

/**
 * Відкрити те, про що сповіщення: заявку чи розмову — тут, решту — на
 * сайті (shared/notifications, `notificationTarget`). Один шлях для рядка
 * в стрічці й для дотику до push. Вести нікуди — false.
 */
export function openNotification(
  n: Pick<AppNotification, 'type' | 'orderId' | 'jobId' | 'chatId'>,
): boolean {
  const to = notificationTarget(n)
  if (!to) return false
  if ('app' in to) {
    router.push({ pathname: '/job/[id]', params: { id: to.app } })
  } else if ('order' in to) {
    router.push({ pathname: '/order/[id]', params: { id: to.order } })
  } else if ('chat' in to) {
    router.push({ pathname: '/chat/[id]', params: { id: to.chat } })
  } else {
    void WebBrowser.openBrowserAsync(`${SITE_URL}${to.site}`)
  }
  return true
}
