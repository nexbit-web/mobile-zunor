import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import {
  useDrawerProgress,
  type DrawerContentComponentProps,
} from 'expo-router/drawer'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useUnreadChats } from '@/components/chat/use-chats'
import { useUnreadCount } from '@/components/header-bell'
import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { Avatar } from '@/components/ui/avatar'
import { CHIP, useChipShadow } from '@/components/ui/chip'
import { GlowSurface } from '@/components/ui/glow-button'
import { Bone, Skeleton } from '@/components/ui/skeleton'
import { ZunorMark } from '@/components/zunor-mark'
import { api } from '@/lib/api'
import { authClient } from '@/lib/auth'
import { CLIENT_DOCK } from '@/lib/dock'
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
export function ClientDrawer({
  state,
  navigation,
}: DrawerContentComponentProps) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const chipShadow = useChipShadow()
  const { data: session } = authClient.useSession()
  const user = session?.user
  const current = state.routes[state.index]?.name
  const [expanded, setExpanded] = useState(false)

  const unread = useUnreadCount()
  const unreadChats = useUnreadChats()
  const recent = useQuery({
    queryKey: ['jobs', 'mine', 'recent'],
    queryFn: () => api<JobsPage>(`/api/jobs/feed?view=mine&limit=${RECENT}`),
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
    Boolean(recent.data?.nextCursor) || (recent.data?.jobs.length ?? 0) > RECENT
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

  // Панель лежить ПІД сторінкою (drawerType 'back') і, поки та
  // відʼїжджає, підіймається з глибини: трохи виростає, проявляється й
  // доїжджає зліва — як нижній аркуш, що відкривається з-під верхнього.
  const progress = useDrawerProgress()
  const rise = useAnimatedStyle(() => {
    const p = progress.get()
    return {
      opacity: 0.35 + 0.65 * p,
      transform: [{ translateX: -28 * (1 - p) }, { scale: 0.94 + 0.06 * p }],
    }
  })

  return (
    <View
      // Панель — на весь екран, без відступів, кольору `drawer` (#191919 у
      // темній — як на скриншоті ClickUp); сторінка над нею — DrawerScene.
      className="flex-1 bg-drawer"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 8 }}
    >
      <Animated.View style={[{ flex: 1 }, rise]}>
        <View className="flex-row items-center gap-2.5 px-6 pb-2 pt-3">
          <ZunorMark size={26} color={c.foreground} />
          <Text className="text-[24px] font-bold tracking-tight text-foreground">
            Zunor
          </Text>
        </View>

        {/* Нижня панель (прототип, lib/dock) сама перемикає розділи — тут
            лише історія: «Ваші заявки». */}
        {CLIENT_DOCK ? null : (
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
              badge={unreadChats}
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
        )}

        <View className={CLIENT_DOCK ? 'h-3' : 'mx-6 my-3 h-px bg-border'} />

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
              <Text
                className="text-[15px] font-medium"
                style={{ color: c.primary }}
              >
                {expanded ? 'Згорнути' : 'Усі'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          contentContainerClassName="px-3 pb-3 pt-1"
        >
          {jobs.map((job) => (
            <Pressable
              key={job.id}
              onPress={() =>
                push(() =>
                  router.push({
                    pathname: '/job/[id]',
                    params: { id: job.id },
                  }),
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

          {/* Поки заявки вперше вантажаться — рядки брусками. */}
          {recent.isPending ? <JobRowsSkeleton count={4} /> : null}

          {recent.isSuccess && first.length === 0 ? (
            <Text className="px-3 py-2 text-[14px] leading-[19px] text-muted-foreground">
              Тут зʼявляться ваші заявки — опишіть Zunor, що прибрати.
            </Text>
          ) : null}

          {/* Розгорнуто: перша сторінка ще йде — спінер; є ще — «Показати ще». */}
          {expanded && all.isLoading ? (
            <JobRowsSkeleton count={3} />
          ) : expanded && all.isFetchingNextPage ? (
            <View className="items-center py-3">
              <ActivityIndicator color={c.mutedForeground} />
            </View>
          ) : expanded && all.hasNextPage ? (
            <Pressable
              onPress={() => void all.fetchNextPage()}
              accessibilityRole="button"
              className="items-center rounded-[14px] py-3 active:bg-secondary"
            >
              <Text
                className="text-[15px] font-medium"
                style={{ color: c.primary }}
              >
                Показати ще
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View className="mx-6 h-px bg-border" />

        <View className="flex-row items-center gap-3 px-4 pt-3">
          {CLIENT_DOCK ? (
            // Нижня панель (прототип, lib/dock): профіль — її вкладкою, а
            // тут на його місці «✎» — анкета AI асистента (що Zunor знає
            // про людину й її обʼєкти). Іконка — аркуш з олівцем
            // (square.and.pencil) за прикладом власника: голий олівець
            // виглядав негарно.
            <View className="flex-1 flex-row">
              <Pressable
                onPress={() => push(() => router.push('/settings/assistant'))}
                accessibilityRole="button"
                accessibilityLabel="Налаштування асистента"
                className={`size-[58px] items-center justify-center rounded-full active:opacity-70 ${CHIP}`}
                style={{ boxShadow: chipShadow }}
              >
                <Glyph
                  name="compose"
                  size={24}
                  color={c.foreground}
                  weight="medium"
                />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => push(() => router.push('/settings'))}
              accessibilityRole="button"
              accessibilityLabel="Профіль і параметри"
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
                <Text
                  numberOfLines={1}
                  className="text-[13px] text-muted-foreground"
                >
                  Профіль і параметри
                </Text>
              </View>
            </Pressable>
          )}
          <Pressable
            onPress={newChat}
            accessibilityRole="button"
            accessibilityLabel="Нова розмова"
            style={({ pressed }) => ({
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            {/* Головна дія панелі — «світне» коло акценту з ободком і
                відблиском, як «Подати пропозицію» (так попросив власник). */}
            <GlowSurface
              radius={29}
              strength="sm"
              className="size-[58px] items-center justify-center"
            >
              <Glyph
                name="plus"
                size={24}
                color={c.primaryForeground}
                weight="semibold"
              />
            </GlowSurface>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  )
}

/** Заглушки рядків «Ваші заявки»: назва й стан брусками (ui/skeleton). */
const ROW_WIDTHS: `${number}%`[] = ['74%', '58%', '66%', '50%']

function JobRowsSkeleton({ count }: { count: number }) {
  return (
    <Skeleton>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="gap-2 px-3 py-3">
          <Bone width={ROW_WIDTHS[i % ROW_WIDTHS.length]} height={14} />
          <Bone width="34%" height={10} />
        </View>
      ))}
    </Skeleton>
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
