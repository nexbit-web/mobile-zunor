// «Нещодавні» в панелі емодзі, як у Telegram: що ставив останнім — першим
// рядом. Зручність цього пристрою, а не дані: лежить у SecureStore (він
// уже є й читається синхронно), у браузері (dev) — у localStorage. Як на
// сайті (chat/emoji.ts), беремо лише емодзі з нашого набору.

import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

import { KNOWN_EMOJI, RECENT_MAX, withRecent } from '@/shared/chat'

const KEY = 'zunor-recent-emoji'

function read(): string | null {
  try {
    return Platform.OS === 'web'
      ? (globalThis.localStorage?.getItem(KEY) ?? null)
      : SecureStore.getItem(KEY)
  } catch {
    return null
  }
}

export function recentEmoji(): string[] {
  try {
    const raw: unknown = JSON.parse(read() ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((e): e is string => typeof e === 'string' && KNOWN_EMOJI.has(e))
      .slice(0, RECENT_MAX)
  } catch {
    return []
  }
}

export function rememberEmoji(emoji: string): void {
  if (!KNOWN_EMOJI.has(emoji)) return
  const value = JSON.stringify(withRecent(recentEmoji(), emoji))
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, value)
    else SecureStore.setItem(KEY, value)
  } catch {
    // Сховище недоступне — просто без «нещодавніх».
  }
}
