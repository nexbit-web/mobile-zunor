import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, type ReactElement } from 'react'
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EmptyState, EmptyStateInset } from '@/components/empty-state'
import { CardSkeletonList } from '@/components/jobs/card-skeleton'
import { JobCard } from '@/components/jobs/job-card'
import {
  PullIndicator,
  refreshLook,
  usePullRefresh,
} from '@/components/ui/pull-indicator'
import { api, errorText } from '@/lib/api'
import { openChat } from '@/lib/dock'
import {
  HEADER_BAR,
  useHeaderScroll,
  useLargeTitleScroll,
} from '@/lib/large-title'
import { useColors } from '@/lib/theme'
import type { JobsPage } from '@/shared/jobs'

/**
 * Список заявок. Майстрові — стрічка (головна вкладка), клієнтові — його
 * заявки. Обидва списки віддає той самий ендпоінт сайту:
 * GET /api/jobs/feed?view=feed|mine — правила стрічки (хвилі розсилки,
 * відстань) рахує сервер, а не застосунок.
 *
 * Кінець списку стоїть над панеллю вкладок (`padBottom`), а коли сторінок
 * більше немає — «Це всі заявки», як на сайті: видно, що далі нічого.
 *
 * `service` — фільтр стрічки майстра (кнопка в шапці, jobs/feed-filter):
 * як на сайті, відбирає вже завантажені заявки за `metadata.service`.
 */
export function JobsList({
  view,
  header,
  service = null,
  onClearService,
}: {
  view: 'feed' | 'mine'
  /** Над списком — усередині прокрутки, гортається разом зі списком. */
  header?: ReactElement
  /** Лише заявки цієї послуги; null — усі. */
  service?: string | null
  /** «Показати всі» в порожньому стані під фільтром. */
  onClearService?: () => void
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
  const { refreshing, onRefresh } = usePullRefresh(() => q.refetch())

  const all = q.data?.pages.flatMap((p) => p.jobs) ?? []
  const jobs = service
    ? all.filter((j) => j.metadata?.service === service)
    : all

  // Під фільтром нічого — дозавантажуємо наступну сторінку: може, там є.
  // Лише поки порожньо, щоб не тягнути всю стрічку заради рідкої послуги.
  const starved = Boolean(service) && jobs.length === 0
  useEffect(() => {
    if (starved && q.hasNextPage && !q.isFetchingNextPage) {
      void q.fetchNextPage()
    }
  }, [starved, q])
  // Під напівпрозорою шапкою (lib/large-title).
  const { top, shift, padTop, padBottom, scrollProps } = useLargeTitleScroll({
    refresh: true,
  })
  const y = useHeaderScroll()
  const headerBottom = useSafeAreaInsets().top + HEADER_BAR

  return (
    <View className="flex-1 bg-background">
      <EmptyStateInset value={shift}>
        <Animated.FlatList
          {...scrollProps}
          contentContainerClassName="grow gap-3 px-4"
          contentContainerStyle={{
            paddingTop: padTop + 8,
            paddingBottom: padBottom,
            // Порожній список — рівно у видимій частині (lib/large-title).
            marginBottom: shift,
          }}
          data={jobs}
          keyExtractor={(job) => job.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <JobCard job={item} viewer={master ? 'master' : 'client'} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              {...refreshLook(c, top)}
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage()
          }}
          ListFooterComponent={
            q.isFetchingNextPage ? (
              <ActivityIndicator className="py-4" color={c.mutedForeground} />
            ) : jobs.length > 0 && !q.hasNextPage ? (
              <Text className="pb-2 pt-5 text-center text-[13px] text-muted-foreground">
                Це всі заявки
              </Text>
            ) : undefined
          }
          ListEmptyComponent={
            q.isPending || (starved && q.hasNextPage) ? (
              // Перше завантаження — скелетон карток.
              <CardSkeletonList variant="job" />
            ) : q.isError ? (
              <EmptyState
                icon="warning"
                title="Не вдалося завантажити"
                text={errorText(q.error)}
                action={{ label: 'Спробувати ще', onPress: () => q.refetch() }}
              />
            ) : service ? (
              <EmptyState
                icon="findJobs"
                title="Немає заявок цього типу"
                text="Спробуйте інший фільтр."
                action={
                  onClearService
                    ? { label: 'Показати всі', onPress: onClearService }
                    : undefined
                }
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
                  onPress: () => openChat(false),
                }}
              />
            )
          }
        />
      </EmptyStateInset>
      <PullIndicator y={y} top={headerBottom} refreshing={refreshing} />
    </View>
  )
}
