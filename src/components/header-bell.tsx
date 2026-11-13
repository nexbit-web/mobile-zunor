import { useQuery } from '@tanstack/react-query'
import { router, useNavigationContainerRef } from 'expo-router'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { RoundButton } from '@/components/ui/round-button'
import { api } from '@/lib/api'
import { useRealtimeConnected } from '@/lib/realtime'

/**
 * Скільки непрочитаних сповіщень — GET /api/me/badges, як на сайті. Один
 * кеш на дзвіночки й бічну панель. Нове сповіщення додає +1 одразу,
 * подією живого каналу (RealtimeBridge); поки каналу немає — перепит раз
 * на 30 с (лише коли застосунок відкритий) і при поверненні в застосунок.
 */
export function useUnreadCount(): number {
  const live = useRealtimeConnected()
  const { data } = useQuery({
    queryKey: ['badges'],
    queryFn: () => api<{ notifications: number }>('/api/me/badges'),
    refetchInterval: live ? false : 30_000,
  })
  return data?.notifications ?? 0
}

/**
 * Дзвіночок сповіщень праворуч у шапці — на кожному екрані, крім самих
 * сповіщень (так попросив власник): головні, заявка, налаштування й їхні
 * розділи, розмова з Zunor. Непрочитані — червоний кружечок із числом;
 * натиск — екран сповіщень.
 *
 * Якщо сповіщення вже відкриті нижче в стеку (звідти прийшли в заявку) —
 * повертаємось до них, а не громадимо «сповіщення → заявка → сповіщення».
 */
export function HeaderBell() {
  const unread = useUnreadCount()
  const nav = useNavigationContainerRef()

  const open = () => {
    const routes = nav.getRootState()?.routes ?? []
    const below = routes
      .slice(0, -1)
      .some((r) => r.name === 'notifications')
    if (below) router.dismissTo('/notifications')
    else router.push('/notifications')
  }

  return (
    <RoundButton
      icon="bell"
      label={unread ? `Сповіщення, непрочитаних: ${unread}` : 'Сповіщення'}
      badge={unread}
      onPress={open}
    />
  )
}

/**
 * Праворуч у шапці — дії екрана («⋯», фільтр, «Змінити»/«Зберегти»), а
 * дзвіночок завжди останній, біля краю: скрізь на тому самому місці, і
 * «Змінити» → «Зберегти» не стрибає.
 */
export function WithBell({ children }: { children?: ReactNode }) {
  return (
    <View className="flex-row items-center gap-2">
      {children}
      <HeaderBell />
    </View>
  )
}
