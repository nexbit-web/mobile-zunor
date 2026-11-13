import { useIsFocused } from 'expo-router'
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from 'react'
import type { ScrollView } from 'react-native'
import type {
  LegacyPanGesture,
  PanGesture,
} from 'react-native-gesture-handler'

/**
 * Бічна панель клієнта відкривається свайпом управо, що ПОЧАВСЯ ближче до
 * лівого краю — у лівій чверті екрана (`drawerSwipeZone`), а не лише з
 * вузької смуги біля краю й не з будь-якої точки (так попросив власник:
 * з середини сторінки панель не відкривається). Це на всіх екранах
 * панелі — на кожному з них є кнопка меню.
 *
 * Свайп управо потрібен і горизонтальним спискам: перемикач розділів не на
 * першому розділі (SwipeTabs), стрічка підказок, прогорнута від початку.
 * Поки такий список на екрані «зайнятий», зона звужується до краю
 * (DRAWER_EDGE), а свайп управо деінде гортає список назад.
 *
 * Список повідомляє про себе `useDrawerEdgeOnly(true)` (лише поки його
 * екран у фокусі — панель тримає й сховані екрани змонтованими), а
 * ClientShell читає `useDrawerSwipeWide()`.
 */

/** Смуга від лівого краю, з якої панель відкривається завжди. */
export const DRAWER_EDGE = 48

/** Звичайна зона свайпу: ліва чверть екрана, не вужча за 80 pt. */
export function drawerSwipeZone(screenWidth: number): number {
  return Math.max(80, Math.round(screenWidth * 0.25))
}

const blockers = new Set<number>()
const listeners = new Set<() => void>()
let nextId = 0

const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Поки `active` (і екран у фокусі) — панель лише від самого краю. */
export function useDrawerEdgeOnly(active: boolean) {
  const focused = useIsFocused()
  const on = active && focused
  useEffect(() => {
    if (!on) return
    const id = nextId++
    blockers.add(id)
    emit()
    return () => {
      blockers.delete(id)
      emit()
    }
  }, [on])
}

/** Чи можна зараз відкривати панель зі всієї зони (а не лише від краю). */
export function useDrawerSwipeWide(): boolean {
  return useSyncExternalStore(subscribe, () => blockers.size === 0)
}

/**
 * Для горизонтальної стрічки (підказки, фото): прогорнута від початку —
 * свайп управо гортає її назад, а панель — лише від самого краю. Пропси — у ScrollView.
 * `shown` — чи стрічка зараз на екрані: зникла прогорнутою — панель знову
 * з усієї зони, а нова стрічка почнеться з початку.
 */
export function useRowSwipeGuard(
  shown = true,
): Pick<ComponentProps<typeof ScrollView>, 'onScroll' | 'scrollEventThrottle'> {
  const [away, setAway] = useState(false)
  useEffect(() => {
    if (!shown) setAway(false)
  }, [shown])
  useDrawerEdgeOnly(away && shown)
  return {
    scrollEventThrottle: 32,
    onScroll: (e) => setAway(e.nativeEvent.contentOffset.x > 4),
  }
}

/**
 * Жест панелі — для горизонтальних списків, які мають йому поступатись
 * (components/ui/yield-to-drawer). Родна прокрутка iOS інакше забирає
 * свайп управо собі, навіть коли гортати нікуди (перший розділ), і панель
 * не відкривалась, щойно палець потрапляв на перемикач розділів. Номер
 * жесту в gesture-handler не міняється, коли панель його перебудовує,
 * тож і старе посилання лишається дійсним.
 */
let drawerPan: LegacyPanGesture | null = null
const panListeners = new Set<() => void>()
const subscribePan = (l: () => void) => {
  panListeners.add(l)
  return () => panListeners.delete(l)
}

export function useDrawerPan(): LegacyPanGesture | null {
  return useSyncExternalStore(subscribePan, () => drawerPan)
}

/**
 * Жест закритої панелі (у зоні біля лівого краю): лише вправо (уліво —
 * одразу відмова, хай гортає список), не крутіше 45° (вертикаль — це
 * прокрутка списку). Поріг 8 pt — панель іде за пальцем із перших
 * пунктів. Горизонтальні списки чекають на його відмову (YieldToDrawer).
 * Відкриту панель закриває звичайний жест react-native-drawer-layout в
 * обидва боки.
 */
export function openOnRightSwipe(gesture: PanGesture): PanGesture {
  // Типи expo-router кажуть PanGesture (новий API gesture-handler 3), а
  // react-native-drawer-layout насправді дає старий будівник
  // Gesture.Pan() — його методи міняють сам обʼєкт.
  const pan = gesture as unknown as LegacyPanGesture
  pan.activeOffsetX([-10000, 8]).failOffsetX([-8, 10000]).failOffsetY([-8, 8])
  if (pan !== drawerPan) {
    drawerPan = pan
    // Не під час рендеру панелі: підписники (YieldToDrawer) — інші компоненти.
    queueMicrotask(() => panListeners.forEach((l) => l()))
  }
  return gesture
}
