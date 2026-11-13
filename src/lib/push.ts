// Push-сповіщення на цей телефон — через Expo Push Service, як і сайт
// (web/src/lib/server/push.ts): сайт шле кожне сповіщення (те саме, що
// у дзвіночку й у Telegram) на всі пристрої людини.
//
// Пристрій реєструється сам: увімкнули push у «Параметри → Сповіщення» —
// питаємо дозвіл системи, беремо Expo-токен і шлемо його на сайт
// (POST /api/me/push). Вимкнули чи виходять з акаунта — DELETE. Який
// токен і для кого зареєстровано — у SecureStore: без нього вимкнути
// було б нічим, а стан перемикача брехав би після перезапуску.
//
// Де push немає:
//   • браузер (dev) і симулятор — немає справжнього пристрою;
//   • Expo Go на Android — з SDK 53 Expo прибрав звідти push зовсім;
//   • без projectId проєкту Expo (`npx eas-cli init` у теці mobile
//     записує його в app.json → extra.eas.projectId) — токена не видадуть.
// Expo Go на iPhone push отримує (поки є projectId); у збірці магазину —
// через ключі Apple й Firebase, які EAS бере при збірці.

import { isRunningInExpoGo } from 'expo'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

import { isChatOpen } from '@/components/chat/use-chats'

import { api } from './api'
import { isRealtimeConnected } from './realtime'

const STORE_KEY = 'zunor-push'
/** Канал Android — той самий `channelId`, що ставить сайт. */
const CHANNEL = 'default'

/** Тип push про нове повідомлення (сайт, MESSAGE_PUSH_TYPE). */
const MESSAGE = 'NEW_MESSAGE'

const SHOW = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
}
const SILENT = {
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
}

// Застосунок відкритий (обробник кличеться лише тоді):
// - сповіщення — банер усе одно: нова заявка поруч не має чекати, поки
//   людина сама зайде в дзвіночок;
// - повідомлення — системного банера немає: його показує своя картка
//   згори (components/message-banner, з живого каналу), а в самій
//   розмові — нічого. Канал не підключений — тоді системний, інакше про
//   повідомлення не дізнались би зовсім.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const data = (n.request.content.data ?? {}) as {
        type?: unknown
        chatId?: unknown
      }
      if (data.type !== MESSAGE) return SHOW
      if (typeof data.chatId === 'string' && isChatOpen(data.chatId)) {
        return SILENT
      }
      return isRealtimeConnected() ? SILENT : SHOW
    },
  })
}

export type PushStatus =
  | { kind: 'on' }
  | { kind: 'off' }
  /** Система заборонила — вмикається лише в параметрах телефона. */
  | { kind: 'denied' }
  | { kind: 'unavailable'; reason: string }

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    { eas?: { projectId?: string } } | undefined
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId
}

/** Чому push тут неможливий; null — можливий. */
function unavailable(): string | null {
  if (Platform.OS === 'web') return 'Лише в застосунку на телефоні'
  if (!Device.isDevice) return 'Лише на справжньому телефоні'
  if (Platform.OS === 'android' && isRunningInExpoGo()) {
    return 'Недоступно в Expo Go на Android'
  }
  if (!projectId()) return 'Ще не налаштовано'
  return null
}

interface Stored {
  token: string
  userId: string
}

function readStored(): Stored | null {
  if (Platform.OS === 'web') return null
  try {
    const raw = SecureStore.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

function writeStored(value: Stored | null): void {
  if (Platform.OS === 'web') return
  try {
    if (value) SecureStore.setItem(STORE_KEY, JSON.stringify(value))
    else void SecureStore.deleteItemAsync(STORE_KEY)
  } catch {}
}

async function granted(): Promise<boolean> {
  const p = await Notifications.getPermissionsAsync()
  return p.granted
}

async function deviceToken(): Promise<string> {
  // Android: без каналу система не дасть ні дозволу, ні токена.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Сповіщення Zunor',
      importance: Notifications.AndroidImportance.HIGH,
    })
  }
  const res = await Notifications.getExpoPushTokenAsync({
    projectId: projectId(),
  })
  return res.data
}

async function register(token: string, userId: string): Promise<void> {
  await api('/api/me/push', {
    method: 'POST',
    json: { token, platform: Platform.OS },
  })
  writeStored({ token, userId })
}

/** Стан перемикача для цієї людини на цьому пристрої. */
export async function readPushStatus(userId: string): Promise<PushStatus> {
  const reason = unavailable()
  if (reason) return { kind: 'unavailable', reason }
  const stored = readStored()
  if (!stored || stored.userId !== userId) return { kind: 'off' }
  return (await granted()) ? { kind: 'on' } : { kind: 'denied' }
}

/**
 * Увімкнути: дозвіл системи (перший раз — її питання), токен, запис на
 * сайті. 'denied' — людина відмовила тепер чи раніше: далі лише через
 * параметри телефона. Помилка мережі — кидає.
 */
export async function enablePush(userId: string): Promise<PushStatus> {
  const reason = unavailable()
  if (reason) return { kind: 'unavailable', reason }

  let ok = await granted()
  if (!ok) {
    const p = await Notifications.getPermissionsAsync()
    if (p.canAskAgain)
      ok = (await Notifications.requestPermissionsAsync()).granted
  }
  if (!ok) return { kind: 'denied' }

  await register(await deviceToken(), userId)
  return { kind: 'on' }
}

/** Вимкнути на цьому пристрої. Помилка мережі — кидає (стан не міняється). */
export async function disablePush(): Promise<void> {
  const stored = readStored()
  if (!stored) return
  await api('/api/me/push', { method: 'DELETE', json: { token: stored.token } })
  writeStored(null)
}

/**
 * Перед виходом з акаунта: пристрій більше не отримує push цієї людини.
 * Вихід не чекає довше за 3 с і не падає — без мережі запис на сайті
 * лишиться, доки на цьому телефоні не ввімкнуть push іншим акаунтом.
 */
export async function releasePush(): Promise<void> {
  if (!readStored()) return
  await Promise.race([
    disablePush().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
  writeStored(null)
}

/** Акаунт видалено — сайт уже стер пристрої, лишилось забути локально. */
export function forgetPush(): void {
  writeStored(null)
}

let synced = false

/**
 * Раз за запуск, коли людина вже в застосунку: токен міг змінитись
 * (перевстановлення, відновлення з копії) — оновлюємо запис на сайті.
 * Нічого не питає й не кидає.
 */
export async function syncPush(userId: string): Promise<void> {
  if (synced || unavailable()) return
  const stored = readStored()
  if (!stored || stored.userId !== userId) return
  synced = true
  try {
    if (!(await granted())) return
    await register(await deviceToken(), userId)
  } catch {
    synced = false
  }
}
