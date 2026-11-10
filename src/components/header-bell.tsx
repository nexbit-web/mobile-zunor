import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { View } from 'react-native'

import { RoundButton } from '@/components/ui/round-button'
import { api } from '@/lib/api'

/**
 * Скільки непрочитаних сповіщень — GET /api/me/badges, як на сайті. Один
 * кеш на дзвіночки й бічну панель. Поки push і живого каналу немає —
 * перепитуємо раз на хвилину (лише коли застосунок відкритий: запити
 * на тлі React Query ставить на паузу) і при поверненні в застосунок.
 */
export function useUnreadCount(): number {
  const { data } = useQuery({
    queryKey: ['badges'],
    queryFn: () => api<{ notifications: number }>('/api/me/badges'),
    refetchInterval: 60_000,
  })
  return data?.notifications ?? 0
}

/**
 * Дзвіночок сповіщень праворуч у шапці головних екранів (замовлення, чати,
 * профіль, налаштування, розмова з Zunor). Непрочитані — червоний
 * кружечок із числом; натиск — екран сповіщень. На екранах «вглиб»
 * (заявка, розділи налаштувань) його немає: там шапка — про цей екран.
 *
 * `edge` — у шапці ScreenHeader: зону дотику зсуваємо до краю, щоб сама
 * іконка стояла ~16 pt від нього, дзеркально до кнопки зліва.
 */
export function HeaderBell({ edge = false }: { edge?: boolean }) {
  const unread = useUnreadCount()
  return (
    <View className={edge ? '-mr-2.5' : undefined}>
      <RoundButton
        icon="bell"
        label={unread ? `Сповіщення, непрочитаних: ${unread}` : 'Сповіщення'}
        badge={unread}
        onPress={() => router.push('/notifications')}
      />
    </View>
  )
}
