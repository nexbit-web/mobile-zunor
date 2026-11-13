import { router, Stack, useIsFocused } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Keyboard, RefreshControl, View } from 'react-native'
import Animated, { Easing, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { EmptyState } from '@/components/empty-state'
import { WithBell } from '@/components/header-bell'
import {
  SwipeTabs,
  type PageScroll,
  type SwipeTab,
} from '@/components/swipe-tabs'
import { usePullRefresh } from '@/components/ui/pull-indicator'
import { RoundButton } from '@/components/ui/round-button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorText } from '@/lib/api'
import { authClient, roleOf } from '@/lib/auth'
import { CLIENT_DOCK } from '@/lib/dock'
import { useHeaderAway } from '@/lib/large-title'
import type { ChatPreview } from '@/shared/chat'

import { ChatRow, ChatRowSkeleton, ChatSeparator } from './chat-row'
import { ChatSearch } from './chat-search'
import { useChats } from './use-chats'

type Tab = 'all' | 'unread'

/**
 * Поява й зникнення пошуку — повільно й рівно, без пружин (власник двічі
 * просив плавніше: 150, потім 260 мс здавались різкими).
 */
const SEARCH_TIMING = {
  duration: 360,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
}

/**
 * Розмови — як список чатів Telegram: свіжі згори, рядок — аватар, імʼя,
 * останнє повідомлення, час і лічильник непрочитаних. Натиск — розмова
 * (`/chat/[id]`) поверх вкладок, без нижньої панелі.
 *
 * Два розділи перемикачем (і свайпом будь-де на екрані), як папки
 * Telegram і фільтр списку на сайті: «Усі» і «Непрочитані». Список один
 * (`['chats']`), розділи — фільтр на місці, тож перемикання миттєве, а
 * прочитаний чат сам іде з «Непрочитаних».
 *
 * Пошук — лупа в шапці поруч із дзвіночком (`ChatSearch`): шапка плавно
 * гасне, на її місці виїжджає поле на всю ширину з круглою «✕».
 *
 * Чат зʼявляється, коли хтось із двох натиснув «Написати» в замовленні
 * (POST /api/orders/[id]/chat на сайті) — до угоди листування немає.
 */
export function ChatList() {
  const { data: session } = authClient.useSession()
  const me = session?.user?.id
  const master = roleOf(session?.user) === 'MASTER'
  const dock = CLIENT_DOCK && !master
  // Нове приносить живий канал одразу; без нього (немає мережі до Pusher)
  // — перепит, поки список на екрані, частіше: рядок має піднятись.
  const focused = useIsFocused()
  const q = useChats(focused ? 8_000 : 30_000)
  const { refreshing, onRefresh } = usePullRefresh(() => q.refetch())
  // Пошук: `searching` — він на екрані (і поки виїжджає/заїжджає),
  // `headerGone` — шапку вже прибрано (після того, як вона згасла:
  // невидима, вона все ще перехоплювала б дотики до поля). `away` — 0 → 1,
  // за ним гасне шапка й виїжджає пошук.
  const [searching, setSearching] = useState(false)
  const [headerGone, setHeaderGone] = useState(false)
  const away = useHeaderAway()
  const openSearch = () => {
    setSearching(true)
    away.set(
      withTiming(1, SEARCH_TIMING, (done) => {
        if (done) scheduleOnRN(setHeaderGone, true)
      }),
    )
  }
  // Екран пішов (вихід з акаунта) посеред пошуку — шапка не лишиться згаслою.
  useEffect(() => () => away.set(0), [away])
  const closeSearch = useCallback(() => {
    Keyboard.dismiss()
    // Шапка повертається одразу, але згаслою — і проявляється разом із тим,
    // як пошук заїжджає.
    setHeaderGone(false)
    away.set(
      withTiming(0, SEARCH_TIMING, (done) => {
        if (done) scheduleOnRN(setSearching, false)
      }),
    )
  }, [away])

  const chats = q.data ?? []
  const unread = chats.filter((chat) => chat.unreadCount > 0)
  // Число — як на вкладці «Чати» внизу: скільки непрочитаних повідомлень.
  const unreadMessages = unread.reduce((n, chat) => n + chat.unreadCount, 0)

  const tabs: SwipeTab<Tab>[] = [
    { key: 'all', label: 'Усі' },
    {
      key: 'unread',
      label: 'Непрочитані',
      count: unreadMessages,
      accent: true,
    },
  ]

  const search = (
    <RoundButton icon="search" label="Пошук у чатах" onPress={openSearch} />
  )

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          // Шапка поверх екрана (headerTransparent), тож без неї нічого
          // не зсувається — на її місці стає поле пошуку.
          headerShown: !headerGone,
          // З нижньою панеллю (прототип, lib/dock) сповіщення — її
          // розділом: у шапці лише пошук.
          headerRight: () => (dock ? search : <WithBell>{search}</WithBell>),
        }}
      />
      <SwipeTabs
        tabs={tabs}
        refreshing={refreshing}
        renderPage={(tab, _active, scroll) => (
          <Page
            tab={tab}
            scroll={scroll}
            items={tab === 'unread' ? unread : chats}
            me={me}
            master={master}
            query={q}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      />
      {searching ? (
        <ChatSearch chats={chats} me={me} shown={away} onClose={closeSearch} />
      ) : null}
    </View>
  )
}

/** Один розділ: свій список, своє «потягни, щоб оновити». */
function Page({
  tab,
  scroll,
  items,
  me,
  master,
  query,
  refreshing,
  onRefresh,
}: {
  tab: Tab
  scroll: PageScroll
  items: ChatPreview[]
  me: string | undefined
  master: boolean
  query: {
    isPending: boolean
    isError: boolean
    error: unknown
    refetch: () => unknown
  }
  refreshing: boolean
  onRefresh: () => void
}) {
  return (
    <Animated.FlatList
      {...scroll.props}
      data={items}
      keyExtractor={(chat) => chat.id}
      contentContainerClassName="grow"
      contentContainerStyle={{
        paddingTop: scroll.padTop,
        paddingBottom: scroll.padBottom,
        // Порожній розділ — рівно у видимій частині (lib/large-title).
        marginBottom: scroll.shift,
      }}
      renderItem={({ item }) => (
        <ChatRow
          chat={item}
          me={me}
          onPress={() =>
            router.push({ pathname: '/chat/[id]', params: { id: item.id } })
          }
        />
      )}
      ItemSeparatorComponent={ChatSeparator}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          {...scroll.refresh}
        />
      }
      ListEmptyComponent={
        query.isPending ? (
          <Skeleton>
            {Array.from({ length: 7 }, (_, i) => (
              <ChatRowSkeleton key={i} index={i} />
            ))}
          </Skeleton>
        ) : query.isError ? (
          <EmptyState
            icon="warning"
            title="Не вдалося завантажити"
            text={errorText(query.error)}
            action={{ label: 'Спробувати ще', onPress: () => query.refetch() }}
          />
        ) : tab === 'unread' ? (
          <EmptyState
            icon="chats"
            title="Усе прочитано"
            text="Розмови з новими повідомленнями зʼявляться тут."
          />
        ) : (
          <EmptyState
            icon="chats"
            title="Поки немає розмов"
            text={
              master
                ? 'Чат із клієнтом зʼявиться, щойно він обере вас і хтось із вас напише.'
                : 'Чат із майстром зʼявиться, щойно ви оберете його й хтось із вас напише.'
            }
          />
        )
      }
    />
  )
}
