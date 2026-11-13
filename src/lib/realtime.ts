// Живий канал — той самий Pusher, що на сайті (web/src/lib/pusher-client.ts):
// ті самі канали й події, тож сервер шле їх і сайту, і застосунку разом.
//
//   private-user-{id}  — notification:new, chat:update (бейджі, список чатів)
//   private-chat-{id}  — message:new / edit / delete / reaction / preview /
//                        read, client-typing («друкує…»)
//
// Одне зʼєднання на застосунок. Відкриває й закриває його RealtimeBridge
// (каркас після входу); екрани лише підписуються на канали
// (`useChannel`). Ключ і кластер — з сайту (GET /api/pusher/config):
// застосунок бере ключ саме того сайту, до чийого API ходить. Немає ключа
// чи мережі — екрани лишаються на перепиті, нічого не ламається.
//
// Приватні канали підписує сервер (POST /api/pusher/auth) — через наш
// api(): на телефоні cookie сесії лежить у SecureStore, і звичайний запит
// pusher-js його б не мав. Тіло — JSON, а не форма, як у браузері: форму
// без заголовка Origin (у нативного запиту його немає) відхиляє
// CSRF-перевірка SvelteKit.
//
// Чому так, а не як у браузері (там просто `new Pusher` і все):
//
// - «Живим» екран вважає канал лише після УСПІШНОЇ підписки, а не просто
//   зʼєднання: коли підписка не проходила, екрани вимикали перепит, а
//   подій не було — нове не приходило.
// - Застосунок пішов на тло — зʼєднання закриваємо, повернувся —
//   відкриваємо наново. Телефон присипляє застосунок, і сокет тихо
//   вмирає, а pusher-js помічав це лише за 2,5 хв (activityTimeout +
//   pongTimeout): увесь цей час екрани думали, що канал живий, не
//   перепитували, і нове не приходило зовсім. Так само робить Telegram.
// - Після кожної (пере)підписки екрани докачують своє
//   (`pusher:subscription_succeeded` у їхніх обробниках): за час без
//   каналу події пропали.

import * as SecureStore from 'expo-secure-store'
import PusherExport, { type Channel } from 'pusher-js/react-native'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { AppState, Platform, type NativeEventSubscription } from 'react-native'

import { api } from './api'
import { API_URL } from './config'

// Збірка pusher-js 8.6 для React Native віддає клас як
// `module.exports.Pusher`, без default (типи обіцяють default). Тож
// `import Pusher from …` давав обʼєкт `{ Pusher }`, і `new Pusher` падав
// («Object cannot be used as a constructor») — живого каналу на телефоні
// не було зовсім, усе йшло перепитом. Беремо клас звідти, де він є; якщо
// колись default полагодять — спрацює й він.
type Pusher = PusherExport
const Pusher: typeof PusherExport =
  (PusherExport as unknown as { Pusher?: typeof PusherExport }).Pusher ??
  PusherExport

let client: Pusher | null = null
let starting: Promise<Pusher | null> | null = null
/** Чи потрібне зʼєднання (людина в застосунку) — для повторних спроб. */
let wanted = false
/** Сайт без ключа Pusher — живого каналу не буде, не питаємо щоразу. */
let noKey = false
/** Номер спроби: зупинили, поки чекали ключ, — стара спроба не відкриє. */
let attempt = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let appStateSub: NativeEventSubscription | null = null
let connected = false
/** Канали, на які підписка вже пройшла. */
const subscribed = new Set<string>()
/** Особистий канал людини — від нього «живі» бейджі й списки. */
let userChannel: string | null = null
const listeners = new Set<() => void>()
/** Скільки екранів тримають канал — відписуємось, коли нікому не треба. */
const holds = new Map<string, number>()

const notify = () => listeners.forEach((l) => l())

/**
 * У лог Metro (лише dev) — тільки збої: канал не піднявся, сайт не
 * підписав, підписка застрягла. Звичайна робота (зʼєднання, кожна подія)
 * мовчить — заважала в терміналі. Для розбору затримок тимчасово можна
 * логувати подію в `useChannel` із часом від `message.createdAt`.
 */
function log(...args: unknown[]) {
  if (__DEV__) console.log('[Pusher]', ...args)
}

function setConnected(next: boolean) {
  if (next === connected) return
  connected = next
  if (!next) subscribed.clear()
  notify()
}

function setClient(next: Pusher | null) {
  client = next
  notify()
}

/** Закрити поточне зʼєднання й забути його підписки. */
function dropClient() {
  client?.disconnect()
  holds.clear()
  subscribed.clear()
  connected = false
  setClient(null)
}

// ─── Ключ Pusher, запамʼятований з минулого запуску ───
// Без нього кожен запуск спершу йшов на сайт по ключ (на Vercel — 0,4 с,
// а функція «холодна» — й 1–2 с) і лише тоді зʼєднувався. Ключ сайту
// не міняється, тож зʼєднуємось одразу із запамʼятованим, а свіжий
// беремо паралельно: змінився — перепідключаємось. Привʼязаний до адреси
// сайту: в іншого сайту (dev / прод) свій ключ.

interface PusherConfig {
  key: string | null
  cluster: string
}

const CONFIG_KEY = 'zunor-pusher-config'

function cachedConfig(): { key: string; cluster: string } | null {
  try {
    const raw =
      Platform.OS === 'web'
        ? globalThis.localStorage?.getItem(CONFIG_KEY)
        : SecureStore.getItem(CONFIG_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as {
      site?: unknown
      key?: unknown
      cluster?: unknown
    }
    return c.site === API_URL &&
      typeof c.key === 'string' &&
      typeof c.cluster === 'string'
      ? { key: c.key, cluster: c.cluster }
      : null
  } catch {
    return null
  }
}

function rememberConfig(cfg: PusherConfig) {
  try {
    if (!cfg.key) {
      if (Platform.OS === 'web') globalThis.localStorage?.removeItem(CONFIG_KEY)
      else void SecureStore.deleteItemAsync(CONFIG_KEY).catch(() => {})
      return
    }
    const value = JSON.stringify({
      site: API_URL,
      key: cfg.key,
      cluster: cfg.cluster,
    })
    if (Platform.OS === 'web')
      globalThis.localStorage?.setItem(CONFIG_KEY, value)
    else SecureStore.setItem(CONFIG_KEY, value)
  } catch {
    // Сховище недоступне — наступний запуск просто спитає сайт.
  }
}

/** Не вийшло (мережа, сервер прокидається) — ще раз за 15 с. */
function retryLater() {
  if (!wanted || retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void startRealtime()
  }, 15_000)
}

/**
 * Тло — закрити зʼєднання; повернувся — відкрити. Неактивний стан iOS
 * (центр керування, шторка) зʼєднання не чіпає.
 */
function watchAppState() {
  if (appStateSub) return
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'background') {
      if (client && client.connection.state !== 'disconnected') {
        client.disconnect()
      }
    } else if (state === 'active') {
      if (!client) {
        if (!noKey) void startRealtime()
      } else if (
        client.connection.state !== 'connected' &&
        client.connection.state !== 'connecting'
      ) {
        client.connect()
      }
    }
  })
}

/** Підняти зʼєднання (повторний виклик — те саме зʼєднання). */
export function startRealtime(): Promise<Pusher | null> {
  wanted = true
  watchAppState()
  if (client) return Promise.resolve(client)
  if (starting) return starting
  const mine = ++attempt
  const cached = cachedConfig()
  // Свіжий ключ питаємо завжди; із запамʼятованим зʼєднання його не чекає.
  const fresh = api<PusherConfig>('/api/pusher/config')
  fresh.catch(() => {}) // збій обробляє той, хто чекає (нижче)
  starting = (async () => {
    try {
      const cfg = cached ?? (await fresh)
      if (mine !== attempt) return null
      if (!cfg.key) {
        log('ключа немає — лишаємось на перепиті')
        noKey = true
        rememberConfig(cfg)
        return null
      }
      const pusher = new Pusher(cfg.key, {
        cluster: cfg.cluster,
        forceTLS: true,
        // Лише WebSocket: запасні HTTP-транспорти pusher-js у React Native
        // доставляють події з помітною затримкою.
        enabledTransports: ['ws', 'wss'],
        // Мертвий сокет помічаємо за ≤ 40 с, а не за 2,5 хв (типові 120 +
        // 30 с): мобільна мережа рве зʼєднання мовчки.
        activityTimeout: 30_000,
        pongTimeout: 10_000,
        channelAuthorization: {
          customHandler: ({ socketId, channelName }, callback) => {
            api<{ auth: string; channel_data?: string }>('/api/pusher/auth', {
              method: 'POST',
              json: { socket_id: socketId, channel_name: channelName },
            })
              .then((data) => callback(null, data))
              .catch((err: unknown) => {
                log('авторизація каналу не пройшла', channelName, err)
                callback(
                  err instanceof Error ? err : new Error(String(err)),
                  null,
                )
              })
          },
        },
      })
      pusher.connection.bind(
        'state_change',
        ({ current }: { current: string }) =>
          setConnected(current === 'connected'),
      )
      pusher.connection.bind('error', (err: unknown) => log('помилка', err))
      setClient(pusher)
      if (!cached) {
        rememberConfig(cfg)
      } else {
        fresh
          .then((next) => {
            rememberConfig(next)
            if (mine !== attempt || client !== pusher) return
            if (next.key === cfg.key && next.cluster === cfg.cluster) return
            // Ключ змінився (інший застосунок Pusher на сайті) — наново.
            dropClient()
            if (next.key) void startRealtime()
            else noKey = true
          })
          .catch(() => {})
      }
      return pusher
    } catch (err) {
      log('не вдалося підняти', err)
      if (mine === attempt) retryLater()
      return null
    } finally {
      if (mine === attempt) starting = null
    }
  })()
  return starting
}

/** Закрити зʼєднання — вихід з акаунта. */
export function stopRealtime(): void {
  wanted = false
  noKey = false
  attempt++
  starting = null
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  appStateSub?.remove()
  appStateSub = null
  userChannel = null
  dropClient()
}

/** Особистий канал людини (RealtimeBridge) — від нього «живі» бейджі. */
export function setUserChannel(name: string | null): void {
  userChannel = name
  notify()
}

function useStore<T>(read: () => T): T {
  return useSyncExternalStore((l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, read)
}

/**
 * Чи приходять події людини (зʼєднання є й особистий канал підписаний) —
 * від цього бейджі, список чатів і сповіщення вирішують, чи перепитувати.
 */
export function useRealtimeConnected(): boolean {
  return useStore(isRealtimeConnected)
}

/** Те саме поза компонентом (lib/push: чи покаже повідомлення банер). */
export function isRealtimeConnected(): boolean {
  return connected && userChannel !== null && subscribed.has(userChannel)
}

/** Чи приходять події саме цього каналу. */
export function useChannelLive(name: string | null): boolean {
  return useStore(() => connected && name !== null && subscribed.has(name))
}

type Handlers = Record<string, (data: never) => void>

/**
 * Слухати події каналу, поки екран змонтований. Обробники беруться
 * свіжі на кожну подію (через ref), тож замикання не застарівають.
 * Повертає ref на канал — щоб надсилати клієнтські події («друкує»).
 *
 * `pusher:subscription_succeeded` серед обробників — «підписка пройшла»:
 * і перша, і після кожного повторного зʼєднання (тло, мережа). Саме там
 * екран докачує те, що могло пройти повз.
 *
 * Зʼєднання відкриває RealtimeBridge; поки його немає — хук чекає й
 * підписується, щойно воно зʼявиться (і знову — на новому, після
 * повторного входу).
 */
export function useChannel(name: string | null, handlers: Handlers) {
  const ref = useRef(handlers)
  ref.current = handlers
  const channel = useRef<Channel | null>(null)
  const events = Object.keys(handlers).sort().join('|')
  const pusher = useStore(() => client)

  useEffect(() => {
    if (!name || !pusher) return
    const callbacks = new Map<string, (data: unknown) => void>()
    const call = (event: string, data?: unknown) =>
      (ref.current[event] as ((d: unknown) => void) | undefined)?.(data)

    const ok = () => {
      subscribed.add(name)
      notify()
      call('pusher:subscription_succeeded')
    }
    const fail = (err: unknown) => {
      log('підписка не пройшла', name, err)
      subscribed.delete(name)
      notify()
    }

    holds.set(name, (holds.get(name) ?? 0) + 1)
    // Саме subscribe, а не channel(): він же відновлює підписку, яку щойно
    // скасували (вийшли з розмови й одразу повернулись), — на такий канал
    // події вже не прийшли б. Підписаний канал він лише повертає.
    const bound = pusher.subscribe(name)
    channel.current = bound
    bound.bind('pusher:subscription_succeeded', ok)
    bound.bind('pusher:subscription_error', fail)
    for (const event of events.split('|')) {
      if (!event || event === 'pusher:subscription_succeeded') continue
      const cb = (data: unknown) => call(event, data)
      callbacks.set(event, cb)
      bound.bind(event, cb)
    }
    // Канал уже був підписаний іншим екраном — живий одразу.
    if (bound.subscribed) ok()
    // Для лога: підписка застрягла — де саме (зʼєднання чи сервер).
    const watchdog = __DEV__
      ? setTimeout(() => {
          if (bound.subscribed) return
          log(
            'за 5 с підписки немає:',
            name,
            '| зʼєднання:',
            pusher.connection.state,
            bound.subscriptionPending ? '| чекаємо відповідь сайту' : '',
          )
        }, 5000)
      : null

    return () => {
      if (watchdog) clearTimeout(watchdog)
      bound.unbind('pusher:subscription_succeeded', ok)
      bound.unbind('pusher:subscription_error', fail)
      for (const [event, cb] of callbacks) bound.unbind(event, cb)
      channel.current = null
      // Зʼєднання вже інше (вихід з акаунта) — старе закрите разом із
      // підписками, лічильники обнулені.
      if (pusher !== client) return
      const left = (holds.get(name) ?? 1) - 1
      if (left <= 0) {
        holds.delete(name)
        subscribed.delete(name)
        pusher.unsubscribe(name)
        notify()
      } else {
        holds.set(name, left)
      }
    }
  }, [name, events, pusher])

  return channel
}
