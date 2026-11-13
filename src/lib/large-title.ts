import { useRoute } from 'expo-router'
import { useContext, useEffect } from 'react'
import { Platform } from 'react-native'
import {
  makeMutable,
  useAnimatedScrollHandler,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { authClient, roleOf } from '@/lib/auth'
import { DockSpace } from '@/lib/dock'

/**
 * Шапка (ScreenHeader) лежить ПОВЕРХ екрана й напівпрозора, тож список
 * відступає згори на її висоту — тут ці відступи й прокрутка.
 *
 * Назва — завжди в самій шапці:
 * - головні екрани розділів із нижньою панеллю (lib/dock; клієнт і
 *   майстер) — ліворуч, 22 pt, і такою лишається під час прокрутки;
 * - головні екрани майстра із системними вкладками (MASTER_DOCK = false)
 *   — на верху великим ліворуч (useInlineTitles); щойно зміст пішов під
 *   шапку — маленька по центру, як в App Store;
 * - решта (екрани вглиб, усе в клієнта) — маленька по центру, між
 *   «‹ Назад» (чи меню) і кнопками праворуч.
 *
 * Скільки прокручено екран, він повідомляє через спільне значення за
 * ключем маршруту (на UI-потоці, Reanimated) — з нього шапка знає, коли
 * згорнути назву, а індикатор «потягни, щоб оновити» (ui/pull-indicator)
 * — наскільки тягнуть. Екран без useLargeTitleScroll (свій список)
 * повідомляє сам, як SwipeTabs.
 */

/** Рядок шапки: кнопки й назва. */
export const HEADER_BAR = 52

const values = new Map<string, SharedValue<number>>()

/**
 * Скільки прокручено екран маршруту `key` (0 — на самому верху, від'ємне —
 * потягнули вниз). Одне значення на маршрут; старі прибираємо, щоб за
 * довгу сесію мапа не росла без кінця.
 */
export function headerScroll(key: string): SharedValue<number> {
  let v = values.get(key)
  if (!v) {
    v = makeMutable(0)
    values.set(key, v)
    if (values.size > 40) {
      const oldest = values.keys().next().value
      if (oldest !== undefined && oldest !== key) values.delete(oldest)
    }
  }
  return v
}

/** Скільки прокручено ЦЕЙ екран — для свого перемикача поверх списку. */
export function useHeaderScroll(): SharedValue<number> {
  return headerScroll(useRoute().key)
}

const aways = new Map<string, SharedValue<number>>()

/**
 * Наскільки шапка маршруту `key` поступилась місцем (0 — на місці, 1 —
 * згасла). Пошук у чатах кладе на її місце своє поле й гасить шапку
 * плавно, а не ховає одним кадром. Стеля — як у headerScroll.
 */
export function headerAway(key: string): SharedValue<number> {
  let v = aways.get(key)
  if (!v) {
    v = makeMutable(0)
    aways.set(key, v)
    if (aways.size > 40) {
      const oldest = aways.keys().next().value
      if (oldest !== undefined && oldest !== key) aways.delete(oldest)
    }
  }
  return v
}

/** Шапка ЦЬОГО екрана поступається місцем (пошук). */
export function useHeaderAway(): SharedValue<number> {
  return headerAway(useRoute().key)
}

/**
 * Назва головного екрана — великим ліворуч у шапці: так у майстра (у
 * нього нижні вкладки й чиста шапка). У клієнта ліворуч кнопка бічної
 * панелі, тож назва по центру.
 */
export function useInlineTitles(): boolean {
  const { data } = authClient.useSession()
  return roleOf(data?.user) === 'MASTER'
}

/** Від верху екрана до початку змісту — низ шапки. */
export function useContentTop(): number {
  return useSafeAreaInsets().top + HEADER_BAR
}

/**
 * Відступ знизу списку, щоб кінець не ховався під нижньою панеллю.
 * На iOS кожна вкладка майстра має свій SafeAreaProvider (expo-router
 * native tabs), і `bottom` там — уже з висотою панелі вкладок; поза
 * вкладками — смужка «додому». Наш contentInsetAdjustmentBehavior
 * 'never' вимикає системне підлаштування, тож відступ ставимо самі.
 * Під нижньою панеллю клієнта (прототип, lib/dock) — над нею.
 */
export function useContentBottom(): number {
  const bottom = useSafeAreaInsets().bottom + 24
  const dock = useContext(DockSpace)
  return dock ? Math.max(bottom, dock + 16) : bottom
}

/**
 * Як список відступає згори на `top`.
 * - Список із «потягни, щоб оновити» на iOS — відступом прокрутки
 *   (contentInset): так індикатор оновлення зʼявляється під шапкою, а не
 *   за нею. `shift` — на скільки тоді зсунутий contentOffset.
 * - Решта (і Android, і браузер) — відступом змісту (`padTop`); Android-у
 *   для індикатора — `progressViewOffset` у RefreshControl.
 *
 * З contentInset зміст із `grow` (порожній список) заввишки з УСЮ
 * прокрутку, а видно на `shift` менше — його можна було підняти на висоту
 * шапки, і він відскакував не на місце, а вище (власник). Тому списки
 * ставлять змістові `marginBottom: shift`: у висоту змісту поле не
 * входить, і порожній список стоїть рівно у видимій частині; довгому
 * спискові воно нічого не міняє.
 */
export function scrollInset(top: number, refresh: boolean) {
  const ios = refresh && Platform.OS === 'ios'
  return {
    shift: ios ? top : 0,
    padTop: ios ? 0 : top,
    props: {
      scrollEventThrottle: 16,
      // Смуги прокрутки в застосунку немає ніде (так попросив власник).
      showsVerticalScrollIndicator: false,
      // Відступ рахуємо самі: «automatic» додав би ще й безпечну зону.
      contentInsetAdjustmentBehavior: 'never' as const,
      ...(ios
        ? {
            contentInset: { top },
            contentOffset: { x: 0, y: -top },
            scrollIndicatorInsets: { top },
          }
        : null),
    },
  }
}

/**
 * Для звичайного екрана з однією прокруткою: пропси для Animated.ScrollView /
 * Animated.FlatList (onScroll і відступ) і `padTop` — додати до
 * contentContainerStyle.
 */
export function useLargeTitleScroll({ refresh = false } = {}) {
  const y = useHeaderScroll()
  const top = useContentTop()
  const padBottom = useContentBottom()
  const inset = scrollInset(top, refresh)
  const shift = inset.shift
  // Нова прокрутка (напр. «Змінити» в профілі міняє екран) стоїть на
  // самому верху — значення не має тягнути минуле.
  useEffect(() => {
    y.set(0)
  }, [y])
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.set(e.contentOffset.y + shift)
    },
  })
  return {
    top,
    /** На скільки зміст у спокої нижче свого місця (iOS contentInset). */
    shift,
    padTop: inset.padTop,
    /** У contentContainerStyle — кінець списку над панеллю вкладок. */
    padBottom,
    scrollProps: { ...inset.props, onScroll },
  }
}
