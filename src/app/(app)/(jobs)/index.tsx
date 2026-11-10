import { AlertCircleIcon, Task01Icon } from '@hugeicons/core-free-icons'
import { useInfiniteQuery } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native'

import { EmptyState } from '@/components/empty-state'
import { JobCard } from '@/components/jobs/job-card'
import { api, errorText } from '@/lib/api'
import { authClient, roleOf } from '@/lib/auth'
import { SITE_URL } from '@/lib/config'
import { useColors } from '@/lib/theme'
import type { JobsPage } from '@/shared/jobs'

/**
 * Перша вкладка. Клієнтові — його заявки, майстрові — стрічка. Обидва
 * списки віддає той самий ендпоінт сайту, що й веб-сторінки:
 * GET /api/jobs/feed?view=mine|feed — правила стрічки (хвилі розсилки,
 * відстань, «Топ для тебе») рахує сервер, а не застосунок.
 */
export default function JobsScreen() {
  const c = useColors()
  const { data: session } = authClient.useSession()
  const master = roleOf(session?.user) === 'MASTER'
  const view = master ? 'feed' : 'mine'

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

  if (q.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={c.mutedForeground} />
      </View>
    )
  }

  return (
    <FlatList
      className="bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="grow gap-3 p-4"
      data={jobs}
      keyExtractor={(job) => job.id}
      renderItem={({ item }) => (
        <JobCard job={item} viewer={master ? 'master' : 'client'} />
      )}
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => void q.refetch()}
          tintColor={c.mutedForeground}
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
        q.isError ? (
          <EmptyState
            icon={AlertCircleIcon}
            title="Не вдалося завантажити"
            text={errorText(q.error)}
            action={{ label: 'Спробувати ще', onPress: () => q.refetch() }}
          />
        ) : master ? (
          <EmptyState
            icon={Task01Icon}
            title="Нових заявок поки немає"
            text="Щойно зʼявиться заявка поруч із вами, ми надішлемо сповіщення."
          />
        ) : (
          <EmptyState
            icon={Task01Icon}
            title="Заявок поки немає"
            text="Опишіть, що прибрати, — Zunor сам знайде майстрів. У застосунку це зʼявиться незабаром, поки що — на сайті."
            action={{
              label: 'Створити на сайті',
              onPress: () =>
                WebBrowser.openBrowserAsync(`${SITE_URL}/dashboard/jobs/new`),
            }}
          />
        )
      }
    />
  )
}
