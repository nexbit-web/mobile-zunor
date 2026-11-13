import { router, type Href } from 'expo-router'
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs'
import { createContext, useSyncExternalStore } from 'react'
import { Easing } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// ───────────────────────────────────────────────────────────────────────
// ПРОТОТИП. Нижня панель клієнта на розділах: «Замовлення · Чати ·
// Сповіщення · Профіль» у пігулці й «+» поруч — нова розмова з Zunor.
// Головна — розмова з Zunor; бічна панель (кнопка ☰ і свайп) — лише там,
// і в ній тоді лише «Ваші заявки», «✎» (анкета AI асистента) і «+»; «✕»
// у розмові веде назад до розділів. Власник дивиться, чи варто так робити.
//
// Розділи й розмова — JS-вкладки (ClientDockShell в app/(app)/_layout):
// лише в них під час переходу видно обидва екрани, тож розмова виїжджає
// знизу поверх розділу, а не зʼявляється (між розділами — миттєво, див.
// stillScene). Бічна панель — у самій розмові (app/(app)/(home)/_layout).
//
// `false` — усе як було: розділи з кнопкою ☰ і свайпом панелі, без нижньої.
// ───────────────────────────────────────────────────────────────────────
export const CLIENT_DOCK = true

/**
 * Майстер — та сама нижня панель замість системних вкладок, лише без
 * «+» (MasterDockShell в app/(app)/_layout; так попросив власник).
 * `false` — системні вкладки (NativeTabs), як було.
 */
export const MASTER_DOCK = true

/** Розділи з нижньою панеллю — маршрути (app). */
export const DOCK_ROUTES = ['orders', 'messages', 'alerts', 'profile']

/** Куди веде вкладка панелі. */
export const DOCK_HREF: Record<string, Href> = {
  orders: '/orders',
  messages: '/messages',
  // Маршрут новий (app/(app)/alerts): згенеровані типи (.expo/types)
  // підхоплюють його лише з новим запуском Metro.
  alerts: '/alerts' as Href,
  profile: '/profile',
}

/** Розділ, де людина була востаннє, — туди веде «✕» із розмови. */
let lastSection = 'orders'

export function rememberSection(route: string) {
  if (DOCK_ROUTES.includes(route)) lastSection = route
}

export function lastSectionHref(): Href {
  return DOCK_HREF[lastSection] ?? '/orders'
}

/** Висота пігулки й діаметр «+» — як коло «+» у бічній панелі. */
export const DOCK_HEIGHT = 58

/** Від країв екрана до панелі — як системна панель iOS 26. */
export const DOCK_SIDE = 24

/** Від низу екрана до панелі — як системна панель iOS 26. */
export function dockBottom(insetBottom: number): number {
  return Math.max(insetBottom - 8, 16)
}

/** Скільки знизу займає панель (з відступом від краю екрана). */
export function useDockSpace(): number {
  return dockBottom(useSafeAreaInsets().bottom) + DOCK_HEIGHT
}

/**
 * Висота панелі для екранів під нею (0 — панелі немає): кінець списку
 * стає над нею (useContentBottom у lib/large-title).
 */
export const DockSpace = createContext(0)

/**
 * Панель сховали — на її місці смуга дій екрана (режим вибору в
 * сповіщеннях: «Прочитати всі» / «Видалити», як у Telegram).
 */
let dockHidden = false
const dockListeners = new Set<() => void>()

export function setDockHidden(hidden: boolean) {
  if (hidden === dockHidden) return
  dockHidden = hidden
  dockListeners.forEach((listener) => listener())
}

function subscribeDock(listener: () => void) {
  dockListeners.add(listener)
  return () => {
    dockListeners.delete(listener)
  }
}

export function useDockHidden(): boolean {
  return useSyncExternalStore(subscribeDock, () => dockHidden)
}

/** Перехід між розмовою й розділами — 350 мс, без пружини. */
export const CHAT_TRANSITION: NonNullable<
  BottomTabNavigationOptions['transitionSpec']
> = {
  animation: 'timing',
  config: { duration: 350, easing: Easing.out(Easing.cubic) },
}

/**
 * Розмова виїжджає знизу, коли відкривається, і їде вниз, коли її
 * закривають (`progress`: 0 — на екрані, ±1 — ні).
 */
export function chatScene(
  height: number,
): NonNullable<BottomTabNavigationOptions['sceneStyleInterpolator']> {
  return ({ current }) => ({
    sceneStyle: {
      transform: [
        {
          translateY: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [height, 0, height],
          }),
        },
      ],
    },
  })
}

/**
 * Розділ, поки над ним виїжджає розмова: стоїть як є (без руху).
 *
 * Чому розділи вмикають перехід лише тоді (`isChatOpening`): поки йде
 * перехід, попередній екран лишається видимим, а на iOS зверху — той,
 * що стоїть ПІЗНІШЕ в списку вкладок, а не той, що відкривається. Тож
 * при переході між розділами попередній 350 мс закривав новий —
 * «Замовлення» (перша вкладка) відкривались із затримкою. Без переходу
 * попередній розділ ховається одразу. Розмова — остання вкладка, тож
 * вона й так зверху: виїжджає над розділом, а на «✕» їде вниз над ним.
 */
export const stillScene: NonNullable<
  BottomTabNavigationOptions['sceneStyleInterpolator']
> = () => ({ sceneStyle: {} })

let chatOpening = false
let openingTimer: ReturnType<typeof setTimeout> | undefined

/** Розмова саме виїжджає — розділ під нею має лишитись видимим. */
export function isChatOpening(): boolean {
  return chatOpening
}

/**
 * Скільки розмова, закрита «✕», чекає на повернення: «+» у цей час
 * відкриває її ж, а не нову (так попросив власник — замість
 * попередження «розмова не збережеться»). Живе в памʼяті застосунку:
 * після його повного закриття розмови немає (збереження на сервері ще
 * не зроблено).
 */
const KEEP_MS = 30 * 60_000

/** Розмова йде й заявки з неї ще немає — є що повертати (ZunorChat). */
let keepable = false
/** Коли розмову закрили «✕». */
let leftAt = 0

export function setChatKeepable(value: boolean) {
  keepable = value
}

/**
 * Відкрити розмову — виїжджає знизу поверх розділу. `fresh` — нова
 * розмова («+»), але якщо почату закрили щойно (KEEP_MS) — вона ж; без
 * `fresh` — та, що була («Написати Zunor»).
 */
export function openChat(fresh = true) {
  chatOpening = true
  clearTimeout(openingTimer)
  // Довше за перехід: поки він іде, навігатор може перемалюватись.
  openingTimer = setTimeout(() => {
    chatOpening = false
  }, 700)
  const resume = keepable && Date.now() - leftAt < KEEP_MS
  router.navigate(
    fresh && !resume
      ? { pathname: '/', params: { fresh: String(Date.now()) } }
      : '/',
  )
}

/**
 * «✕» у розмові — до розділу, де людина була востаннє. Без
 * попередження: почату розмову «+» ще KEEP_MS відкриває знову.
 */
export function leaveChat() {
  leftAt = Date.now()
  router.navigate(lastSectionHref())
}
