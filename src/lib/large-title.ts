import { useRoute } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import {
  makeMutable,
  useAnimatedScrollHandler,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * Великий заголовок, як у застосунках Apple: на екрані зверху ліворуч —
 * назва великими літерами; гортаєш — вона їде під шапку, а в шапці
 * зʼявляється маленька назва по центру.
 *
 * Шапка (ScreenHeader) лежить ПОВЕРХ екрана й напівпрозора, тож список
 * відступає згори на висоту шапки й великого заголовка. Скільки прокручено,
 * екран повідомляє шапці через спільне значення за ключем маршруту: шапку
 * малює навігатор, а не сам екран, і інакше вони не бачать одне одного.
 * Значення живе на UI-потоці (Reanimated) — заголовок рухається разом зі
 * списком кадр у кадр.
 */

/** Рядок шапки з кнопками й маленькою назвою. */
export const HEADER_BAR = 52
/** Смуга великого заголовка під шапкою. */
export const LARGE_TITLE = 52

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

/** Від верху екрана до початку змісту: шапка + великий заголовок. */
export function useContentTop(): number {
  return useSafeAreaInsets().top + HEADER_BAR + LARGE_TITLE
}

/**
 * Як список відступає згори на `top`.
 * - Список із «потягни, щоб оновити» на iOS — відступом прокрутки
 *   (contentInset): так індикатор оновлення зʼявляється під шапкою, а не
 *   за нею. `shift` — на скільки тоді зсунутий contentOffset.
 * - Решта (і Android, і браузер) — відступом змісту (`padTop`); Android-у
 *   для індикатора — `progressViewOffset` у RefreshControl.
 */
export function scrollInset(top: number, refresh: boolean) {
  const ios = refresh && Platform.OS === 'ios'
  return {
    shift: ios ? top : 0,
    padTop: ios ? 0 : top,
    props: {
      scrollEventThrottle: 16,
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
  const inset = scrollInset(top, refresh)
  const shift = inset.shift
  // Нова прокрутка (напр. «Змінити» в профілі міняє екран) стоїть на
  // самому верху — шапка має показати великий заголовок, а не минуле.
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
    padTop: inset.padTop,
    scrollProps: { ...inset.props, onScroll },
  }
}
