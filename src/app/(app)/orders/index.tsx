import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ActivityIndicator, RefreshControl, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { EmptyState } from '@/components/empty-state'
import type { GlyphName } from '@/components/icons/glyph'
import { JobCard } from '@/components/jobs/job-card'
import { OrderCard } from '@/components/orders/order-card'
import {
  SwipeTabs,
  type PageScroll,
  type SwipeTab,
} from '@/components/swipe-tabs'
import { api, errorText } from '@/lib/api'
import { authClient, roleOf } from '@/lib/auth'
import { useColors } from '@/lib/theme'
import type { JobListItem, JobsPage } from '@/shared/jobs'
import type { OrderListItem, OrdersList, OrderStatus } from '@/shared/orders'

type Tab = 'requests' | 'active' | 'history' | 'done' | 'cancelled'

type Item =
  | { kind: 'job'; job: JobListItem }
  | { kind: 'order'; order: OrderListItem }

/** Які стани замовлення лежать у якому розділі. */
const ORDER_TABS: Record<Exclude<Tab, 'requests'>, OrderStatus[]> = {
  active: ['CREATED', 'IN_PROGRESS'],
  history: ['COMPLETED', 'CANCELLED'],
  done: ['COMPLETED'],
  cancelled: ['CANCELLED'],
}

/**
 * «Замовлення» — увесь шлях справи, три розділи перемикачем (і свайпом
 * будь-де на екрані, як папки в Telegram):
 *   клієнт — Заявки (шукаємо майстра, пропозиції) · Активні (майстра
 *            обрано, в роботі) · Історія (завершені й скасовані);
 *   майстер — Активні · Завершені · Скасовані (заявок він не створює).
 *
 * Замовлення — одним запитом (GET /api/orders?status=all, до 100 останніх,
 * як на сайті) і розкладаються по розділах тут: перемикання миттєве.
 * Заявки — сторінками, у тому самому кеші, що й «Ваші заявки» в бічній
 * панелі.
 */
export default function OrdersScreen() {
  const { data: session } = authClient.useSession()
  const master = roleOf(session?.user) === 'MASTER'
  const role = master ? 'master' : 'client'

  const orders = useQuery({
    queryKey: ['orders', role, 'all'],
    queryFn: () => api<OrdersList>(`/api/orders?role=${role}&status=all`),
  })
  const jobs = useInfiniteQuery({
    queryKey: ['jobs', 'mine'],
    queryFn: ({ pageParam }) =>
      api<JobsPage>(
        `/api/jobs/feed?view=mine${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !master,
  })

  // Живі заявки — вгорі, минулі (термін минув, скасовані) — вниз; усередині
  // групи — як прийшли з сервера, найновіші першими (sort стабільний).
  const jobList = (jobs.data?.pages.flatMap((p) => p.jobs) ?? []).sort(
    (a, b) => jobRank(a) - jobRank(b),
  )
  const live = jobList.filter((j) => j.status === 'OPEN')
  // Є пропозиції, з яких треба обрати майстра, — крапка на «Заявках».
  const waiting = live.some((j) => (j.proposalsCount ?? 0) > 0)
  const activeOrders = orders.data?.orders.filter((o) =>
    ORDER_TABS.active.includes(o.status),
  ).length

  const tabs: SwipeTab<Tab>[] = master
    ? [
        { key: 'active', label: 'Активні', count: activeOrders },
        { key: 'done', label: 'Завершені' },
        { key: 'cancelled', label: 'Скасовані' },
      ]
    : [
        // Число — лише живі заявки (шукаємо майстра, є пропозиції): минулі
        // вже не «ваші заявки зараз».
        { key: 'requests', label: 'Заявки', count: live.length, dot: waiting },
        { key: 'active', label: 'Активні', count: activeOrders },
        { key: 'history', label: 'Історія' },
      ]

  const itemsOf = (tab: Tab): Item[] =>
    tab === 'requests'
      ? jobList.map((job) => ({ kind: 'job', job }))
      : (orders.data?.orders ?? [])
          .filter((o) => ORDER_TABS[tab].includes(o.status))
          .map((order) => ({ kind: 'order', order }))

  return (
    <View className="flex-1 bg-background">
      <SwipeTabs
        // Роль змінилась (вихід і вхід іншим акаунтом) — розділи інші.
        key={role}
        tabs={tabs}
        renderPage={(tab, _active, scroll) => {
          const isJobs = tab === 'requests'
          return (
            <Page
              tab={tab}
              scroll={scroll}
              master={master}
              role={role}
              items={itemsOf(tab)}
              query={isJobs ? jobs : orders}
              onRefresh={() => {
                void orders.refetch()
                if (!master) void jobs.refetch()
              }}
              more={
                isJobs
                  ? {
                      loading: jobs.isFetchingNextPage,
                      load: () => {
                        if (jobs.hasNextPage && !jobs.isFetchingNextPage) {
                          void jobs.fetchNextPage()
                        }
                      },
                    }
                  : undefined
              }
            />
          )
        }}
      />
    </View>
  )
}

/**
 * Порядок заявок клієнта: живі (шукаємо майстра) → майстра обрано →
 * завершені → термін минув і скасовані.
 */
function jobRank(job: JobListItem): number {
  switch (job.status) {
    case 'OPEN':
      return 0
    case 'IN_PROGRESS':
      return 1
    case 'COMPLETED':
      return 2
    default:
      return 3
  }
}

/** Одна сторінка-розділ: свій список, своє «потягни, щоб оновити». */
function Page({
  tab,
  scroll,
  master,
  role,
  items,
  query,
  onRefresh,
  more,
}: {
  tab: Tab
  /** Як лягти під шапку й перемикач, що лежать поверх списку. */
  scroll: PageScroll
  master: boolean
  role: 'client' | 'master'
  items: Item[]
  query: {
    isPending: boolean
    isError: boolean
    isRefetching: boolean
    error: unknown
    refetch: () => unknown
  }
  onRefresh: () => void
  more?: { loading: boolean; load: () => void }
}) {
  const c = useColors()
  return (
    <Animated.FlatList
      {...scroll.props}
      data={items}
      keyExtractor={(it) => (it.kind === 'job' ? it.job.id : it.order.id)}
      contentContainerClassName="grow gap-3 px-4 pb-10"
      // Зміст стартує під перемикачем, а при прокрутці заходить під нього.
      contentContainerStyle={{ paddingTop: scroll.padTop }}
      renderItem={({ item }) =>
        item.kind === 'job' ? (
          <JobCard job={item.job} viewer="client" />
        ) : (
          <OrderCard order={item.order} viewer={role} />
        )
      }
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching && !more?.loading}
          onRefresh={onRefresh}
          tintColor={c.mutedForeground}
          progressViewOffset={scroll.top}
        />
      }
      onEndReachedThreshold={0.5}
      onEndReached={more?.load}
      ListFooterComponent={
        more?.loading ? (
          <ActivityIndicator className="py-4" color={c.mutedForeground} />
        ) : undefined
      }
      ListEmptyComponent={
        query.isPending ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator color={c.mutedForeground} />
          </View>
        ) : query.isError ? (
          <EmptyState
            icon="warning"
            title="Не вдалося завантажити"
            text={errorText(query.error)}
            action={{ label: 'Спробувати ще', onPress: () => query.refetch() }}
          />
        ) : (
          <Empty tab={tab} master={master} />
        )
      }
    />
  )
}

const EMPTY: Record<Tab, { icon: GlyphName; title: string; text: string }> = {
  requests: {
    icon: 'inbox',
    title: 'Заявок поки немає',
    text: 'Опишіть Zunor, що прибрати, — він сам знайде майстрів поруч.',
  },
  active: {
    icon: 'clock',
    title: 'Активних замовлень немає',
    text: 'Коли оберете майстра з пропозицій, замовлення зʼявиться тут.',
  },
  history: {
    icon: 'done',
    title: 'Історія поки порожня',
    text: 'Тут будуть завершені й скасовані замовлення — з оцінкою майстрові.',
  },
  done: {
    icon: 'done',
    title: 'Завершених поки немає',
    text: 'Тут будуть виконані замовлення й відгуки клієнтів.',
  },
  cancelled: {
    icon: 'cancelled',
    title: 'Скасованих немає',
    text: 'Скасовані замовлення збережуться тут — для історії.',
  },
}

function Empty({ tab, master }: { tab: Tab; master: boolean }) {
  const e = EMPTY[tab]
  const text =
    master && tab === 'active'
      ? 'Коли клієнт обере вашу пропозицію, замовлення зʼявиться тут.'
      : e.text
  return (
    <EmptyState
      icon={e.icon}
      title={e.title}
      text={text}
      action={
        tab === 'requests'
          ? { label: 'Написати Zunor', onPress: () => router.navigate('/') }
          : undefined
      }
    />
  )
}
