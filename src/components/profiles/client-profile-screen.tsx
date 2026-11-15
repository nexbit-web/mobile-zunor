import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { RefreshControl, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EmptyState } from '@/components/empty-state'
import {
  PullIndicator,
  refreshLook,
  usePullRefresh,
} from '@/components/ui/pull-indicator'
import { api, errorText } from '@/lib/api'
import {
  HEADER_BAR,
  useHeaderScroll,
  useLargeTitleScroll,
} from '@/lib/large-title'
import { useColors } from '@/lib/theme'
import { pluralUk } from '@/shared/format'
import type { ClientProfile } from '@/shared/profiles'

import {
  placeLine,
  ProfileHero,
  ProfileSkeleton,
  ratingStat,
  ReviewList,
  StatsCard,
  TextBlock,
} from './profile-parts'

/**
 * Профіль клієнта — майстрові, із заявки чи замовлення (власник: «щоб
 * майстер, коли відгукується, міг подивитись відгуки про клієнта»). Те
 * саме, що сторінка сайту /dashboard/client/[id]:
 *
 *   фото, імʼя · місто, відколи на Zunor
 *   замовлень · завершено · рейтинг від майстрів
 *   ПРО СЕБЕ (якщо написав) · ВІДГУКИ ВІД МАЙСТРІВ
 *
 * Телефону немає навіть тут: він — лише в замовленні, після угоди
 * (захист контактів). Бачить лише майстер — сервер іншим відповідає 404.
 * Дані — GET /api/clients/[id] (web: $lib/server/client-profile).
 */
export function ClientProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const c = useColors()
  const { top, padTop, scrollProps } = useLargeTitleScroll({ refresh: true })
  const y = useHeaderScroll()

  const q = useQuery({
    queryKey: ['client', id],
    queryFn: async () =>
      (
        await api<{ profile: ClientProfile }>(
          `/api/clients/${encodeURIComponent(id)}`,
        )
      ).profile,
  })
  const { refreshing, onRefresh } = usePullRefresh(() => q.refetch())

  if (q.isPending) return <ProfileSkeleton top={top} />

  if (q.isError) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: top }}>
        <EmptyState
          icon="warning"
          title="Профіль не відкрито"
          text={errorText(q.error)}
          action={{ label: 'Спробувати ще', onPress: () => void q.refetch() }}
        />
      </View>
    )
  }

  const p = q.data

  return (
    <View className="flex-1 bg-background">
      <Animated.ScrollView
        {...scrollProps}
        className="flex-1"
        contentContainerClassName="gap-7 px-4"
        contentContainerStyle={{
          paddingTop: padTop + 8,
          paddingBottom: insets.bottom + 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            {...refreshLook(c, top)}
          />
        }
      >
        <ProfileHero
          avatar={p.avatar}
          name={p.name || 'Клієнт'}
          line={placeLine(p.city, p.createdAt)}
        />

        <StatsCard
          items={[
            {
              value: String(p.totalOrders),
              label: pluralUk(p.totalOrders, 'замовлення', 'замовлення', 'замовлень'),
            },
            { value: String(p.completedOrders), label: 'завершено' },
            ratingStat(p.avgRating, p.reviewsCount),
          ]}
        />

        {p.bio ? <TextBlock title="Про себе">{p.bio}</TextBlock> : null}

        <ReviewList
          title="Відгуки від майстрів"
          reviews={p.reviews}
          total={p.reviewsCount}
          empty="Майстри ще не залишали відгуків про цього клієнта."
        />
      </Animated.ScrollView>
      <PullIndicator
        y={y}
        top={insets.top + HEADER_BAR}
        refreshing={refreshing}
      />
    </View>
  )
}
