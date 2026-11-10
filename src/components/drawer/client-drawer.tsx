import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import type { DrawerContentComponentProps } from 'expo-router/drawer'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useUnreadCount } from '@/components/header-bell'
import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { Avatar } from '@/components/ui/avatar'
import { ZunorMark } from '@/components/zunor-mark'
import { api } from '@/lib/api'
import { authClient } from '@/lib/auth'
import { useColors } from '@/lib/theme'
import { jobState, type JobListItem, type JobsPage } from '@/shared/jobs'

/** Скільки останніх заявок видно без «Усі». */
const RECENT = 5

/**
 * Бічна панель клієнта — як у застосунках ІІ: угорі знак, далі розділи,
 * під ними «Ваші заявки» (як історія розмов), унизу людина й велика
 * кнопка «нова розмова». Головний екран — сама розмова з Zunor.
 *
 * Заявок спершу лише кілька останніх (`limit`), і запит за ними малий.
 * Решта — лише після «Усі», звичайними сторінками й у тому самому кеші,
 * що й список «Замовлення → Заявки».
 */
export function ClientDrawer({ state, navigation }: DrawerContentComponentProps) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { data: session } = authClient.useSession()
  const user = session?.user
  const current = state.routes[state.index]?.name
  const [expanded, setExpanded] = useState(false)

  const unread = useUnreadCount()
  const recent = useQuery({
    queryKey: ['jobs', 'mine', 'recent'],
    queryFn: () =>
      api<JobsPage>(`/api/jobs/feed?view=mine&limit=${RECENT}`),
  })
  // Ключ і запит — як у JobsList (view="mine"): сторінки спільні.
  const all = useInfiniteQuery({
    queryKey: ['jobs', 'mine'],
    queryFn: ({ pageParam }) =>
      api<JobsPage>(
        `/api/jobs/feed?view=mine${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: expanded,
  })

  const first = (recent.data?.jobs ?? []).slice(0, RECENT)
  // Сервер без `limit` (стара версія) віддає повну сторінку — тоді «є ще»
  // видно з довжини, а не з курсора.
  const hasMore =
    Boolean(recent.data?.nextCursor) ||
    (recent.data?.jobs.length ?? 0) > RECENT
  const jobs: JobListItem[] =
    expanded && all.data ? all.data.pages.flatMap((p) => p.jobs) : first

  const go = (route: string) => {
    navigation.navigate(route)
    navigation.closeDrawer()
  }
  const push = (open: () => void) => {
    navigation.closeDrawer()
    open()
  }
  // Нова розмова: головний екран бачить новий `fresh` і скидає діалог.
  const newChat = () =>
    push(() =>
      router.navigate({ pathname: '/', params: { fresh: String(Date.now()) } }),
    )

  const name = user?.name || user?.email || ''

  return (
    <View
      // Панель — шар «картка» (#1c1c1e у темній, білий у світлій): у
      // темній вона так відділяється від чорного екрана, що відʼїхав.
      className="flex-1 bg-card"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 8 }}
    >
      <View className="flex-row items-center gap-2.5 px-6 pb-2 pt-3">
        <ZunorMark size={26} color={c.foreground} />
        <Text className="text-[24px] font-bold tracking-tight text-foreground">
          Zunor
        </Text>
      </View>

      <View className="gap-0.5 px-3 pt-2">
        <NavRow
          icon="orders"
          label="Замовлення"
          active={current === 'orders'}
          onPress={() => go('orders')}
        />
        <NavRow
          icon="chats"
          label="Чати"
          active={current === 'messages'}
          onPress={() => go('messages')}
        />
        <NavRow
          icon="bell"
          label="Сповіщення"
          badge={unread}
          onPress={() => push(() => router.push('/notifications'))}
        />
        {/* «Налаштування» окремим пунктом немає: туди веде людина внизу. */}
      </View>

      <View className="mx-6 my-3 h-px bg-border" />

      <View className="h-8 flex-row items-center justify-between px-6">
        <Text className="text-[13px] font-medium uppercase tracking-[0.4px] text-muted-foreground">
          Ваші заявки
        </Text>
        {hasMore || expanded ? (
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            className="active:opacity-60"
          >
            <Text className="text-[15px] font-medium" style={{ color: c.primary }}>
              {expanded ? 'Згорнути' : 'Усі'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-3 pb-3 pt-1">
        {jobs.map((job) => (
          <Pressable
            key={job.id}
            onPress={() =>
              push(() =>
                router.push({ pathname: '/job/[id]', params: { id: job.id } }),
              )
            }
            className="gap-0.5 rounded-[14px] px-3 py-2.5 active:bg-secondary"
          >
            <Text
              numberOfLines={1}
              className="text-[16px] font-semibold text-foreground"
            >
              {job.title}
            </Text>
            <Text className="text-[13px] text-muted-foreground">
              {jobState(job, 'client').label}
            </Text>
          </Pressable>
        ))}

        {recent.isSuccess && first.length === 0 ? (
          <Text className="px-3 py-2 text-[14px] leading-[19px] text-muted-foreground">
            Тут зʼявляться ваші заявки — опишіть Zunor, що прибрати.
          </Text>
        ) : null}

        {/* Розгорнуто: перша сторінка ще йде — спінер; є ще — «Показати ще». */}
        {expanded && (all.isLoading || all.isFetchingNextPage) ? (
          <View className="items-center py-3">
            <ActivityIndicator color={c.mutedForeground} />
          </View>
        ) : expanded && all.hasNextPage ? (
          <Pressable
            onPress={() => void all.fetchNextPage()}
            accessibilityRole="button"
            className="items-center rounded-[14px] py-3 active:bg-secondary"
          >
            <Text className="text-[15px] font-medium" style={{ color: c.primary }}>
              Показати ще
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View className="mx-6 h-px bg-border" />

      <View className="flex-row items-center gap-3 px-4 pt-3">
        <Pressable
          onPress={() => push(() => router.push('/settings'))}
          accessibilityRole="button"
          accessibilityLabel="Профіль і налаштування"
          className="flex-1 flex-row items-center gap-3 rounded-full py-1 pr-2 active:opacity-70"
        >
          <Avatar uri={user?.image} name={name} size={46} />
          <View className="flex-1">
            <Text
              numberOfLines={1}
              className="text-[16px] font-semibold text-foreground"
            >
              {name}
            </Text>
            <Text numberOfLines={1} className="text-[13px] text-muted-foreground">
              Профіль і налаштування
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={newChat}
          accessibilityRole="button"
          accessibilityLabel="Нова розмова"
          className="size-[58px] items-center justify-center rounded-full bg-foreground active:opacity-85"
        >
          <Glyph name="plus" size={24} color={c.background} weight="medium" />
        </Pressable>
      </View>
    </View>
  )
}

function NavRow({
  icon,
  label,
  onPress,
  active = false,
  badge = 0,
}: {
  icon: GlyphName
  label: string
  onPress: () => void
  active?: boolean
  badge?: number
}) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`h-[54px] flex-row items-center gap-2.5 rounded-[16px] px-3 active:bg-secondary ${
        active ? 'bg-secondary' : ''
      }`}
    >
      <View className="w-7 items-center">
        <Glyph name={icon} size={24} color={c.foreground} weight="medium" />
      </View>
      <Text className="flex-1 text-[18px] font-medium tracking-[-0.2px] text-foreground">
        {label}
      </Text>
      {badge > 0 ? (
        <View
          className="h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5"
          style={{ backgroundColor: c.primary }}
        >
          <Text className="text-[12px] font-semibold text-primary-foreground">
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}
