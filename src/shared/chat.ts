// Чат — КОПІЯ чистого ядра сайту:
//   типи         — web/src/lib/components/chat/types.ts
//   реакції      — web/src/lib/components/chat/reactions.ts
//   емодзі       — web/src/lib/components/chat/emoji.ts (без localStorage)
//   посилання    — web/src/lib/components/chat/linkify.ts
//   час у списку — web/src/lib/components/chat/calendar-time.ts
// Міняється там — міняй тут. Сервер поля лише додає, тож нові поля тут —
// опційні.

// ═══════════════════════ Типи ═══════════════════════

export type MessageType = 'TEXT' | 'PHOTO' | 'FILE'

export interface ChatUser {
  id: string
  name: string
  username: string | null
  avatar: string | null
  isVerified: boolean
}

export interface LinkPreview {
  url: string
  siteName: string
  title: string
  description: string
}

/** Реакції повідомлення, згруповані за емодзі: хто поставив. */
export interface ReactionGroup {
  emoji: string
  userIds: string[]
}

export interface ChatMessage {
  id: string
  type: MessageType
  text: string
  attachmentUrl: string | null
  attachmentMimeType: string | null
  attachmentSize: number | null
  attachmentName: string | null
  isRead: boolean
  editedAt: string | null
  deletedAt: string | null
  createdAt: string
  senderId: string
  replyToId: string | null
  replyTo: {
    id: string
    text: string
    senderId: string
    type: MessageType
  } | null
  reactions?: ReactionGroup[]
  linkPreview?: LinkPreview | null
}

export interface ChatPreview {
  id: string
  peer: ChatUser
  lastMessageText: string | null
  lastMessageAt: string | null
  lastSenderId: string | null
  /** До якого моменту співрозмовник прочитав — ✓✓ біля мого останнього. */
  peerLastReadAt?: string | null
  unreadCount: number
  updatedAt: string
}

export interface ChatDetails {
  id: string
  peer: ChatUser
  members: ChatUser[]
  myLastReadAt: string | null
  peerLastReadAt: string | null
  peerLastSeen: string | null
  mutedUntil: string | null
}

export interface MessagesPage {
  messages: ChatMessage[]
  nextCursor: string | null
}

/** Як на сайті: текст до 4000 знаків, правка — протягом доби. */
export const MAX_TEXT_LENGTH = 4000
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000

/** Можна ще правити: своє, текстове, не видалене, не старше доби. */
export function canEdit(m: ChatMessage, me: string, now = Date.now()): boolean {
  return (
    m.senderId === me &&
    m.type === 'TEXT' &&
    !m.deletedAt &&
    now - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS
  )
}

// ═══════════════════════ Реакції ═══════════════════════

/** Набір закритий — сервер приймає лише ці. Перша — «швидка». */
export const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '👏'] as const

/** Що поставив цей користувач (null — нічого). */
export function myReaction(
  groups: readonly ReactionGroup[],
  userId: string,
): string | null {
  return groups.find((g) => g.userIds.includes(userId))?.emoji ?? null
}

/** Та сама — знімає, інша — замінює (те саме правило й на сервері). */
export function nextReaction(
  groups: readonly ReactionGroup[],
  userId: string,
  emoji: string,
): string | null {
  return myReaction(groups, userId) === emoji ? null : emoji
}

/** Групи після того, як користувач поставив `emoji` (чи зняв — null). */
export function applyReaction(
  groups: readonly ReactionGroup[],
  userId: string,
  emoji: string | null,
): ReactionGroup[] {
  const without = groups
    .map((g) => ({ ...g, userIds: g.userIds.filter((id) => id !== userId) }))
    .filter((g) => g.userIds.length > 0)
  if (!emoji) return without
  const existing = without.find((g) => g.emoji === emoji)
  if (existing) {
    return without.map((g) =>
      g.emoji === emoji ? { ...g, userIds: [...g.userIds, userId] } : g,
    )
  }
  return [...without, { emoji, userIds: [userId] }]
}

// ═══════════════════════ Емодзі поля вводу ═══════════════════════

export interface EmojiGroup {
  title: string
  emoji: string[]
}

// Короткий набір під наші розмови, а не весь Unicode — як на сайті.
// prettier-ignore
export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    title: 'Смайли',
    emoji: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
      '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋',
      '😜', '🤪', '😎', '🥳', '😏', '😌', '🤗', '🤭',
      '🤔', '🤨', '😐', '🙄', '😬', '😴', '🥺', '😢',
      '😭', '😤', '😠', '😱', '😳', '🤯', '😮', '🤧',
    ],
  },
  {
    title: 'Жести',
    emoji: [
      '👍', '👎', '👌', '✌️', '🤞', '🤙', '👋', '👏',
      '🙌', '🙏', '🤝', '💪', '👀', '☝️', '👉', '✊',
    ],
  },
  {
    title: 'Серця й символи',
    emoji: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '💯', '🔥', '✨', '⭐', '🎉', '🎁', '✅', '❌',
      '⚠️', '❗', '❓', '💬', '📌', '👑', '🌞', '🌧️',
    ],
  },
  {
    title: 'Дім і прибирання',
    emoji: [
      '🏠', '🏡', '🏢', '🏬', '🧹', '🧽', '🧼', '🧺',
      '🧴', '🧤', '🚪', '🛁', '🚿', '🚽', '🛏️', '🛋️',
      '🍳', '🍽️', '🌿', '🌸', '🐶', '🐱', '🔑', '🗑️',
    ],
  },
  {
    title: 'Справи',
    emoji: [
      '⏰', '📅', '🕐', '📍', '🚗', '🚕', '📞', '📷',
      '💰', '💳', '🧾', '📝', '📦', '⏳', '☕', '🍰',
    ],
  },
]

export const KNOWN_EMOJI = new Set(EMOJI_GROUPS.flatMap((g) => g.emoji))
export const RECENT_MAX = 16

/** Обраний — першим, без повторів, зі стелею. */
export function withRecent(list: string[], emoji: string): string[] {
  return [emoji, ...list.filter((e) => e !== emoji)].slice(0, RECENT_MAX)
}

// ═══════════════════════ Посилання ═══════════════════════

export type TextPart =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string; href: string }

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi
const TRAILING = /[.,!?:;'")\]}»]+$/

/** Посиланням стає лише http(s) або www. — як на сайті. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0
    let raw = match[0]
    const tail = raw.match(TRAILING)?.[0] ?? ''
    const keepParen =
      tail.startsWith(')') && raw.slice(0, -tail.length).includes('(')
    if (tail && !keepParen) raw = raw.slice(0, -tail.length)
    if (!raw) continue
    if (start > last) parts.push({ kind: 'text', value: text.slice(last, start) })
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    parts.push({ kind: 'link', value: raw, href })
    last = start + raw.length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}

// ═══════════════════════ Час ═══════════════════════

const KYIV = 'Europe/Kyiv'
const kyivDay = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: KYIV })

/**
 * Час у списку чатів, як у Telegram: сьогодні — година, учора — «вчора»,
 * цього тижня — день тижня, далі — дата.
 */
export function formatChatTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
  if (diffMin < 1) return 'щойно'
  if (diffMin < 60) return `${diffMin} хв`

  const day = Date.parse(`${kyivDay(date)}T00:00:00Z`)
  const today = Date.parse(`${kyivDay(now)}T00:00:00Z`)
  const days = Math.round((today - day) / 86_400_000)
  if (days <= 0) return messageTime(iso)
  if (days === 1) return 'вчора'
  if (days < 7) {
    return date
      .toLocaleDateString('uk-UA', { timeZone: KYIV, weekday: 'short' })
      .replace('.', '')
  }
  return date.toLocaleDateString('uk-UA', {
    timeZone: KYIV,
    day: 'numeric',
    month: 'short',
  })
}

/** Час у бульбашці: «14:05». */
export function messageTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('uk-UA', {
    timeZone: KYIV,
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Чи в один день за Києвом — для плашок дати між повідомленнями. */
export function sameDay(a: string, b: string): boolean {
  return kyivDay(new Date(a)) === kyivDay(new Date(b))
}

/** Менше цього з останньої активності — «у мережі» (як на сайті). */
const ONLINE_MS = 5 * 60_000

/** «у мережі» / «був(ла) 5 хв тому» / «був(ла) нещодавно». */
export function presenceLabel(
  lastSeen: string | null,
  formatRelative: (iso: string) => string,
  now = Date.now(),
): string {
  if (!lastSeen) return 'був(ла) нещодавно'
  const t = new Date(lastSeen).getTime()
  if (Number.isNaN(t)) return 'був(ла) нещодавно'
  return now - t < ONLINE_MS ? 'у мережі' : `був(ла) ${formatRelative(lastSeen)}`
}

/** Текст повідомлення в цитаті й меню: фото/файл без підпису — словом. */
export function messageSummary(m: Pick<ChatMessage, 'type' | 'text'>): string {
  if (m.text) return m.text
  if (m.type === 'PHOTO') return 'Фото'
  if (m.type === 'FILE') return 'Файл'
  return ''
}
