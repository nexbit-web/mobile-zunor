import { useInfiniteQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import type { ReactElement } from 'react'
import { ActivityIndicator, RefreshControl, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { EmptyState } from '@/components/empty-state'
import { JobCard } from '@/components/jobs/job-card'
import { api, errorText } from '@/lib/api'
import { useLargeTitleScroll } from '@/lib/large-title'
import { useColors } from '@/lib/theme'
import type { JobsPage } from '@/shared/jobs'

/**
 * Список заявок. Майстрові — стрічка (головна вкладка), клієнтові — його
 * заявки (вкладка «Замовлення»). Обидва списки віддає той самий ендпоінт
 * сайту: GET /api/jobs/feed?view=feed|mine — правила стрічки (хвилі
 * розсилки, відстань) рахує сервер, а не застосунок.
 */
export function JobsList({
  view,
  header,
}: {
  view: 'feed' | 'mine'
  /** Над списком (перемикач у «Замовленнях») — усередині прокрутки, щоб
   *  великий заголовок iOS згортався. */
  header?: ReactElement
}) {
  const c = useColors()
  const master = view === 'feed'

  const q = useInfiniteQuery({
    queryKey: ['jobs', view],
    queryFn: ({ pageParam }) =>
      api<JobsPage>(
        `/api/jobs/feed?view=${view}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  })

  const jobs = q.data?.pages.flatMap((p) => p.jobs) ?? []
  // Під напівпрозорою шапкою з великим заголовком (lib/large-title).
  const { top, padTop, scrollProps } = useLargeTitleScroll({ refresh: true })

  return (
    <Animated.FlatList
      {...scrollProps}
      className="bg-background"
      contentContainerClassName="grow gap-3 px-4 pb-10"
      contentContainerStyle={{ paddingTop: padTop + 8 }}
      data={jobs}
      keyExtractor={(job) => job.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <JobCard
          job={item}
          viewer={master ? 'master' : 'client'}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => void q.refetch()}
          tintColor={c.mutedForeground}
          progressViewOffset={top}
        />
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage()
      }}
      ListFooterComponent={
        q.isFetchingNextPage ? (
          <ActivityIndicator className="py-4" color={c.mutedForeground} />
        ) : undefined
      }
      ListEmptyComponent={
        q.isPending ? (
          <View className="flex-1 items-center justify-center py-16">
            <ActivityIndicator color={c.mutedForeground} />
          </View>
        ) : q.isError ? (
          <EmptyState
            icon="warning"
            title="Не вдалося завантажити"
            text={errorText(q.error)}
            action={{ label: 'Спробувати ще', onPress: () => q.refetch() }}
          />
        ) : master ? (
          <EmptyState
            icon="findJobs"
            title="Нових заявок поки немає"
            text="Щойно зʼявиться заявка поруч із вами, ми надішлемо сповіщення."
          />
        ) : (
          <EmptyState
            icon="inbox"
            title="Заявок поки немає"
            text="Опишіть, що прибрати, — Zunor сам знайде майстрів."
            action={{
              label: 'Написати Zunor',
              onPress: () => router.navigate('/'),
            }}
          />
        )
      }
    />
  )
}
