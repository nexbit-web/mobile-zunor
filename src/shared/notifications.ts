// Сповіщення — контракт GET/POST /api/notifications, слова за типом і
// куди веде. Іконка й колір плитки — справа екрана
// (components/notifications), тут лише чисті правила.

export interface AppNotification {
  id: string
  type: string
  title: string
  body?: string | null
  jobId?: string | null
  proposalId?: string | null
  orderId?: string | null
  chatId?: string | null
  isRead: boolean
  createdAt: string
}

export interface NotificationsPage {
  items: AppNotification[]
  nextCursor: string | null
  unreadCount: number
}

/**
 * Ярлик над заголовком — КОПІЯ `KIND_TEXT[type].label` з
 * web/src/lib/notifications/kinds.ts. Невідомий тип — «Сповіщення».
 */
const LABELS: Record<string, string> = {
  NEW_JOB: 'Нова заявка',
  NEW_PROPOSAL: 'Новий відгук',
  PROPOSAL_ACCEPTED: 'Вас обрали',
  ORDER_STARTED: 'Робота почалась',
  ORDER_COMPLETED: 'Роботу завершено',
  ORDER_CANCELLED: 'Скасовано',
  ORDER_REMINDER: 'Нагадування',
  JOB_REOPENED: 'Шукаємо нового',
  JOB_UPDATED: 'Заявку змінено',
  VERIFICATION_APPROVED: 'Верифікація',
  VERIFICATION_REJECTED: 'Верифікація',
  REPORT_RESOLVED: 'Скарга',
}

export function notificationLabel(type: string): string {
  return LABELS[type] ?? 'Сповіщення'
}

/**
 * Куди веде сповіщення — те саме правило, що `linkFor` на сайті
 * (web/src/lib/notifications/types.ts), але з екранами застосунку:
 * замовлення, заявка й розмова відкриваються тут, профіль на модерації —
 * поки на сайті.
 */
export function notificationTarget(
  n: Pick<AppNotification, 'type' | 'orderId' | 'jobId' | 'chatId'>,
):
  | { app: string }
  | { order: string }
  | { chat: string }
  | { site: string }
  | null {
  if (
    n.type === 'VERIFICATION_APPROVED' ||
    n.type === 'VERIFICATION_REJECTED'
  ) {
    return { site: '/dashboard/profile' }
  }
  if (n.orderId) return { order: n.orderId }
  if (n.jobId) return { app: n.jobId }
  if (n.chatId) return { chat: n.chatId }
  return null
}

/** Стрічка без повідомлень чату — як на сайті (`isChatNotification`). */
export function isChatNotification(n: AppNotification): boolean {
  return n.type === 'NEW_MESSAGE'
}

/**
 * День групи: «Сьогодні», «Учора», цього тижня — день тижня
 * («Понеділок»), далі — дата («5 листопада», з роком, якщо не цей).
 * За Києвом, як усе в застосунку.
 */
export function notificationDay(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const kyiv = (d: Date) =>
    d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })
  const day = Date.parse(`${kyiv(date)}T00:00:00Z`)
  const today = Date.parse(`${kyiv(now)}T00:00:00Z`)
  const diff = Math.round((today - day) / 86_400_000)

  if (diff <= 0) return 'Сьогодні'
  if (diff === 1) return 'Учора'
  if (diff < 7) {
    const w = date.toLocaleDateString('uk-UA', {
      timeZone: 'Europe/Kyiv',
      weekday: 'long',
    })
    return w.charAt(0).toUpperCase() + w.slice(1)
  }
  const sameYear = kyiv(date).slice(0, 4) === kyiv(now).slice(0, 4)
  return date.toLocaleDateString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? null : { year: 'numeric' }),
  })
}

/** Час рядка: сьогодні — «5 хв тому» / «14:32», раніше — лише час. */
export function notificationTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const min = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (min < 1) return 'щойно'
  if (min < 60) return `${min} хв`
  return date.toLocaleTimeString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
  })
}
