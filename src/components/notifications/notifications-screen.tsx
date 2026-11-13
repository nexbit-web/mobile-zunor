import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { Stack, useFocusEffect } from 'expo-router'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native'
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DockActions } from '@/components/dock/dock-actions'
import { EmptyState, EmptyStateInset } from '@/components/empty-state'
import {
  NotificationRow,
  NotificationSkeleton,
} from '@/components/notifications/notification-row'
import { QuietBell } from '@/components/notifications/quiet-bell'
import { HeaderPill } from '@/components/ui/header-pill'
import {
  PullIndicator,
  refreshLook,
  usePullRefresh,
} from '@/components/ui/pull-indicator'
import {
  closeSwipeRows,
  SwipeRow,
  swipeAreaTouch,
} from '@/components/ui/swipe-row'
import { api, errorText } from '@/lib/api'
import { authClient, roleOf } from '@/lib/auth'
import { dockBottom, DOCK_HEIGHT, DockSpace, setDockHidden } from '@/lib/dock'
import {
  HEADER_BAR,
  useHeaderScroll,
  useLargeTitleScroll,
} from '@/lib/large-title'
import { openNotification } from '@/lib/open-notification'
import { useRealtimeConnected } from '@/lib/realtime'
import { useColors } from '@/lib/theme'
import { offerUndo } from '@/lib/undo'
import { pluralUk } from '@/shared/format'
import {
  isChatNotification,
  notificationDay,
  type AppNotification,
  type NotificationsPage,
} from '@/shared/notifications'

const KEY = ['notifications'] as const
type Feed = InfiniteData<NotificationsPage, string | null>

/** Вхід і вихід режиму вибору — без пружини, як скрізь. */
const MODE = { duration: 300, easing: Easing.out(Easing.cubic) }

/**
 * Видалені, але ще не остаточно (5 с на «Скасувати», lib/undo): у стрічці
 * їх не видно, а на сервері вони ще є — тож перезапит їх не поверне. Поза
 * екраном: відлік живе й тоді, коли з екрана вже пішли.
 */
let hiddenIds: ReadonlySet<string> = new Set()
const hiddenListeners = new Set<() => void>()

function setHiddenIds(next: ReadonlySet<string>) {
  hiddenIds = next
  hiddenListeners.forEach((listener) => listener())
}

function hideIds(ids: ReadonlySet<string>) {
  setHiddenIds(new Set([...hiddenIds, ...ids]))
}

function unhideIds(ids: ReadonlySet<string>) {
  setHiddenIds(new Set([...hiddenIds].filter((id) => !ids.has(id))))
}

function subscribeHidden(listener: () => void) {
  hiddenListeners.add(listener)
  return () => {
    hiddenListeners.delete(listener)
  }
}

function useHiddenIds() {
  return useSyncExternalStore(subscribeHidden, () => hiddenIds)
}

/** Видалені остаточно — геть зі стрічки в кеші, з лічильником. */
function dropFromFeed(qc: QueryClient, ids: ReadonlySet<string>) {
  qc.setQueryData<Feed>(KEY, (d) => {
    if (!d) return d
    const goneUnread = new Set(
      d.pages
        .flatMap((p) => p.items)
        .filter((n) => ids.has(n.id) && !n.isRead)
        .map((n) => n.id),
    ).size
    return {
      ...d,
      pages: d.pages.map((p, i) => ({
        ...p,
        items: p.items.filter((n) => !ids.has(n.id)),
        unreadCount:
          i === 0 ? Math.max(p.unreadCount - goneUnread, 0) : p.unreadCount,
      })),
    }
  })
}

/** Сервер бере до 200 id за раз (api/notifications) — більше шлемо частинами. */
function inChunks(ids: string[], send: (part: string[]) => Promise<unknown>) {
  const parts: Promise<unknown>[] = []
  for (let i = 0; i < ids.length; i += 200) {
    parts.push(send(ids.slice(i, i + 200)))
  }
  return Promise.all(parts)
}

type Entry =
  | { kind: 'head'; key: string; label: string; first: boolean }
  | {
      kind: 'row'
      key: string
      n: AppNotification
      first: boolean
      last: boolean
    }

/**
 * Сповіщення — стрічка GET /api/notifications, та сама, що на сайті:
 * групи за днями («Сьогодні», «Учора», «Понеділок», «5 листопада») у
 * згрупованих картках iOS, у рядку — плитка події, ярлик і час, заголовок
 * і подробиці. Непрочитане — крапкою акценту.
 *
 * Прочитаним позначає дотик (і перехід туди, куди веде сповіщення) або
 * «Прочитати всі» над стрічкою. Лічильник у дзвіночку — те саме число:
 * правимо кеш `['badges']` разом зі стрічкою, а не чекаємо його
 * хвилинного перезапиту. Живого каналу (Pusher, push) ще немає — поки
 * екран відкритий, стрічка перепитує сервер раз на 30 с.
 *
 * «Змінити» в шапці — режим вибору, як у Telegram (власник): рядки
 * зсуваються управо, ліворуч — кружки; замість нижньої панелі — смуга
 * «Прочитати всі» (з вибраними — «Прочитати») і «Видалити». Дія або
 * «Готово» — усе плавно повертається назад.
 */
export function NotificationsScreen() {
  const c = useColors()
  const qc = useQueryClient()
  const { data: session } = authClient.useSession()
  const master = roleOf(session?.user) === 'MASTER'
  const { top, shift, padTop, padBottom, scrollProps } = useLargeTitleScroll({
    refresh: true,
  })
  const y = useHeaderScroll()
  const insets = useSafeAreaInsets()
  const headerBottom = insets.top + HEADER_BAR
  const reduceMotion = useReducedMotion()

  // Режим вибору: кружки в рядках, смуга дій на місці нижньої панелі.
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set())
  /** 0 — звичайна стрічка, 1 — режим вибору (зсув рядків, кружки). */
  const mode = useSharedValue(0)

  useEffect(() => {
    mode.set(
      reduceMotion ? (selecting ? 1 : 0) : withTiming(selecting ? 1 : 0, MODE),
    )
  }, [selecting, reduceMotion, mode])

  // Нижня панель поступається місцем смузі дій (і повертається).
  useEffect(() => {
    setDockHidden(selecting)
    return () => setDockHidden(false)
  }, [selecting])

  const startSelect = () => {
    closeSwipeRows()
    setSelecting(true)
  }
  const stopSelect = useCallback(() => {
    setSelecting(false)
    setPicked(new Set())
  }, [])

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  // Android: системне «назад» виходить із режиму, а не з екрана.
  useEffect(() => {
    if (!selecting || Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      stopSelect()
      return true
    })
    return () => sub.remove()
  }, [selecting, stopSelect])

  // Нове сповіщення приносить живий канал (RealtimeBridge); без нього —
  // перепит раз на 30 с, поки екран відкритий.
  const live = useRealtimeConnected()
  const feed = useInfiniteQuery({
    queryKey: KEY,
    queryFn: ({ pageParam }) =>
      api<NotificationsPage>(
        `/api/notifications?limit=20${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: live ? false : 30_000,
  })
  const { refreshing, onRefresh } = usePullRefresh(() => feed.refetch())

  // Видалені, але ще з правом «Скасувати» (5 с) — у стрічці їх не видно.
  const hidden = useHiddenIds()

  // Дублі можливі: поки гортали, зверху прилетіло нове й зсунуло курсор.
  const seen = new Set<string>()
  const loaded = (feed.data?.pages.flatMap((p) => p.items) ?? []).filter(
    (n) => !isChatNotification(n) && !seen.has(n.id) && seen.add(n.id),
  )
  const items = loaded.filter((n) => !hidden.has(n.id))
  const entries = toEntries(items)

  /** Непрочитані за сервером — від них рахуємо правки кешу. */
  const serverUnread = feed.data?.pages[0]?.unreadCount ?? 0
  /** Непрочитані на екрані: без тих, що чекають остаточного видалення. */
  const unread = Math.max(
    serverUnread - loaded.filter((n) => hidden.has(n.id) && !n.isRead).length,
    0,
  )

  // Сервер щойно перерахував непрочитані — дзвіночок бере те саме число.
  useEffect(() => {
    if (feed.data) qc.setQueryData(['badges'], { notifications: unread })
  }, [feed.data, unread, qc])

  // Плашка «Скасувати» — над нижньою панеллю; де її немає — на її місці.
  const dockSpace = useContext(DockSpace)
  const toastBottom = dockSpace ? dockSpace + 10 : dockBottom(insets.bottom)

  /** Правка стрічки й лічильника в кеші; повертає, як було, — для відкату. */
  const patch = (read: (n: AppNotification) => boolean, unreadNext: number) => {
    const prev = qc.getQueryData<Feed>(KEY)
    qc.setQueryData<Feed>(KEY, (d) =>
      d
        ? {
            ...d,
            pages: d.pages.map((p, i) => ({
              ...p,
              items: p.items.map((n) =>
                !n.isRead && read(n) ? { ...n, isRead: true } : n,
              ),
              unreadCount: i === 0 ? unreadNext : p.unreadCount,
            })),
          }
        : d,
    )
    return () => qc.setQueryData(KEY, prev)
  }

  const markRead = (n: AppNotification) => {
    if (n.isRead) return
    const undo = patch((x) => x.id === n.id, Math.max(serverUnread - 1, 0))
    api('/api/notifications', {
      method: 'POST',
      json: { action: 'mark-read', ids: [n.id] },
    }).catch(undo)
  }

  const markAll = () => {
    if (!unread) return
    const undo = patch(() => true, 0)
    api('/api/notifications', {
      method: 'POST',
      json: { action: 'mark-all-read' },
    }).catch((e) => {
      undo()
      Alert.alert('Не вдалося позначити прочитаними', errorText(e))
    })
  }

  const open = (n: AppNotification) => {
    // Відкритий кошик іншого рядка не чекає на повернення.
    closeSwipeRows()
    markRead(n)
    openNotification(n)
  }

  // Пішли з екрана будь-як (панель, сповіщення, push) — відкритий рядок
  // закривається, режим вибору теж: повернулись — усе як було.
  useFocusEffect(
    useCallback(
      () => () => {
        closeSwipeRows()
        stopSelect()
      },
      [stopSelect],
    ),
  )

  /**
   * Видалити (кошик у свайпі або «Видалити» в режимі вибору) — з правом
   * передумати, як у Telegram (власник): рядки одразу зникають зі
   * стрічки й лічильника, над нижньою панеллю — «Сповіщення видалено ·
   * Скасувати» з відліком 5 с (lib/undo). «Скасувати» — рядки
   * повертаються, на сервер нічого не йде. Не скасували — POST
   * /api/notifications `action: 'delete'` (лише свої), і вже без
   * вороття; не вийшло — рядки повертаються.
   */
  const remove = (ids: ReadonlySet<string>) => {
    if (!ids.size) return
    hideIds(ids)
    offerUndo({
      text:
        ids.size === 1
          ? 'Сповіщення видалено.'
          : `Видалено ${ids.size} ${pluralUk(
              ids.size,
              'сповіщення',
              'сповіщення',
              'сповіщень',
            )}.`,
      bottom: toastBottom,
      undo: () => unhideIds(ids),
      commit: () => {
        inChunks([...ids], (part) =>
          api('/api/notifications', {
            method: 'POST',
            json: { action: 'delete', ids: part },
          }),
        ).then(
          () => {
            dropFromFeed(qc, ids)
            unhideIds(ids)
          },
          (e) => {
            unhideIds(ids)
            Alert.alert('Не вдалося видалити', errorText(e))
          },
        )
      },
    })
  }

  // Смуга дій режиму вибору.
  const chosen = items.filter((n) => picked.has(n.id))
  const chosenUnread = chosen.filter((n) => !n.isRead)

  /** «Прочитати» вибрані (нічого не вибрано — «Прочитати всі»). */
  const readChosen = () => {
    if (!chosen.length) {
      markAll()
    } else {
      const ids = new Set(chosenUnread.map((n) => n.id))
      const undo = patch(
        (n) => ids.has(n.id),
        Math.max(serverUnread - ids.size, 0),
      )
      inChunks([...ids], (part) =>
        api('/api/notifications', {
          method: 'POST',
          json: { action: 'mark-read', ids: part },
        }),
      ).catch((e) => {
        undo()
        Alert.alert('Не вдалося позначити прочитаними', errorText(e))
      })
    }
    stopSelect()
  }

  const removeChosen = () => {
    remove(new Set(chosen.map((n) => n.id)))
    stopSelect()
  }

  // Рядки перемальовуються, коли міняється режим чи вибір.
  const extra = useMemo(() => ({ selecting, picked }), [selecting, picked])

  // «Змінити» ↔ «Готово» — та сама пігулка, що в параметрах. Порожня
  // стрічка — вибирати нічого, кнопки немає.
  const editButton =
    selecting || items.length > 0 ? (
      <HeaderPill
        label={selecting ? 'Готово' : 'Змінити'}
        tone="secondary"
        onPress={selecting ? stopSelect : startSelect}
      />
    ) : null

  return (
    // Дотик будь-де повз відкритий рядок — закриває його.
    <View className="flex-1 bg-background" onTouchStart={swipeAreaTouch}>
      <Stack.Screen options={{ headerRight: () => editButton }} />
      <EmptyStateInset value={shift}>
        <Animated.FlatList
          {...scrollProps}
          data={entries}
          extraData={extra}
          keyExtractor={(e) => e.key}
          // Видалений рядок — решта плавно підтягується на його місце.
          itemLayoutAnimation={LinearTransition.duration(260)}
          // Гортають список — відкритий рядок закривається.
          onScrollBeginDrag={closeSwipeRows}
          contentContainerClassName="grow px-4"
          contentContainerStyle={{
            paddingTop: padTop,
            // У режимі вибору кінець списку — над смугою дій (де нижньої
            // панелі немає, її місце треба звільнити).
            paddingBottom: selecting
              ? Math.max(
                  padBottom,
                  dockBottom(insets.bottom) + DOCK_HEIGHT + 16,
                )
              : padBottom,
            // Порожня стрічка — рівно у видимій частині (lib/large-title).
            marginBottom: shift,
          }}
          renderItem={({ item }) =>
            item.kind === 'head' ? (
              <DayHead
                label={item.label}
                first={item.first}
                mode={mode}
                action={
                  item.first && unread > 0
                    ? {
                        label: 'Прочитати всі',
                        onPress: markAll,
                        // У режимі вибору — у смузі внизу.
                        off: selecting,
                      }
                    : undefined
                }
              />
            ) : (
              // Свайп уліво — кошик, як у Telegram (власник); у режимі
              // вибору рядок не тягнеться.
              <SwipeRow
                enabled={!selecting}
                actions={[
                  {
                    key: 'delete',
                    icon: 'trashFill',
                    label: 'Видалити',
                    color: c.destructive,
                    removes: true,
                    onPress: () => remove(new Set([item.n.id])),
                  },
                ]}
              >
                <NotificationRow
                  n={item.n}
                  first={item.first}
                  last={item.last}
                  select={{
                    progress: mode,
                    active: selecting,
                    on: picked.has(item.n.id),
                  }}
                  onPress={() => (selecting ? toggle(item.n.id) : open(item.n))}
                />
              </SwipeRow>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              {...refreshLook(c, top)}
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) {
              void feed.fetchNextPage()
            }
          }}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <ActivityIndicator className="py-4" color={c.mutedForeground} />
            ) : undefined
          }
          ListEmptyComponent={
            feed.isPending ? (
              <View className="pt-3">
                <NotificationSkeleton />
              </View>
            ) : feed.isError ? (
              <EmptyState
                icon="warning"
                title="Не вдалося завантажити"
                text={errorText(feed.error)}
                action={{
                  label: 'Спробувати ще',
                  onPress: () => feed.refetch(),
                }}
              />
            ) : (
              <Quiet master={master} />
            )
          }
        />
      </EmptyStateInset>
      <PullIndicator y={y} top={headerBottom} refreshing={refreshing} />
      {selecting ? (
        <DockActions
          left={{
            label: chosen.length ? 'Прочитати' : 'Прочитати всі',
            onPress: readChosen,
            disabled: chosen.length ? !chosenUnread.length : unread === 0,
          }}
          right={{
            label: 'Видалити',
            onPress: removeChosen,
            disabled: !chosen.length,
            destructive: true,
          }}
        />
      ) : null}
    </View>
  )
}

/** Стрічка → рядки з підписами днів; рядок знає, чи він перший/останній у дні. */
function toEntries(items: AppNotification[]): Entry[] {
  const out: Entry[] = []
  let day = ''
  items.forEach((n, i) => {
    const d = notificationDay(n.createdAt)
    const first = d !== day
    if (first) {
      // Ключ — сам день (у стрічці він один): після видалення рядка
      // підписи не перемонтовуються.
      out.push({ kind: 'head', key: `day-${d}`, label: d, first: !day })
      day = d
    }
    const next = items[i + 1]
    out.push({
      kind: 'row',
      key: n.id,
      n,
      first,
      last: !next || notificationDay(next.createdAt) !== d,
    })
  })
  return out
}

/**
 * Підпис дня великими літерами, як у згрупованих списках iOS. Дія
 * праворуч («Прочитати всі») гасне в режимі вибору (`mode` → 1): там
 * вона — у смузі внизу.
 */
function DayHead({
  label,
  first,
  mode,
  action,
}: {
  label: string
  first: boolean
  mode: SharedValue<number>
  action?: { label: string; onPress: () => void; off: boolean }
}) {
  const fade = useAnimatedStyle(() => ({ opacity: 1 - mode.get() }))
  return (
    <View
      className={`flex-row items-end justify-between px-4 pb-2 ${
        first ? 'pt-3' : 'pt-7'
      }`}
    >
      <Text className="text-[13px] font-medium uppercase tracking-[0.4px] text-muted-foreground">
        {label}
      </Text>
      {action ? (
        <Animated.View style={fade}>
          <Pressable
            onPress={action.onPress}
            disabled={action.off}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityElementsHidden={action.off}
            className="active:opacity-50"
          >
            <Text className="text-[15px] text-primary">{action.label}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  )
}

/**
 * Порожня стрічка: тихий сірий дзвіночок і одне коротке речення — чого
 * тут чекати. Той самий порожній стан, що й на інших екранах (шрифти,
 * плитка, місце посередині), — лише дзвіночок живий.
 */
function Quiet({ master }: { master: boolean }) {
  return (
    <EmptyState
      art={<QuietBell />}
      title="Поки тихо"
      text={
        master
          ? 'Тут зʼявляться нові заявки поруч і рішення клієнтів.'
          : 'Тут зʼявляться відгуки майстрів і новини про ваші замовлення.'
      }
    />
  )
}
