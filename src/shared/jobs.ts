// Відповіді API заявок сайту (web/src/routes/api/jobs/**). Лише ті поля,
// які читає застосунок; сервер може віддавати більше. Контракт: поля на
// сервері лише додаються (../AGENTS.md), тож нове тут — опційне.

import { pluralUk } from './format'
import { formatPrice } from './orders'

export type JobStatus =
  'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'

/** Картка в списку: GET /api/jobs/feed?view=mine|feed. */
export interface JobListItem {
  id: string
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  status?: JobStatus
  proposalsCount?: number
  createdAt: string
  /** Бюджет клієнта в копійках; обидва null — «ціну запропонує майстер». */
  budgetMinCents?: number | null
  budgetMaxCents?: number | null
  currency?: string | null
  /** Лише стрічка майстра: район заявки й відстань від його району. */
  place?: { district: string | null; distanceKm: number | null } | null
  /** Лише стрічка майстра: замовник і його рейтинг від інших майстрів. */
  client?: {
    name: string | null
    avgRating: number
    reviewsCount: number
  } | null
  /** Лише стрічка майстра: «Топ для тебе» — причини з мозку підбору. */
  match?: string[] | null
}

export interface JobsPage {
  jobs: JobListItem[]
  nextCursor: string | null
}

/** GET /api/jobs/[id]. */
/** Пропозиція майстра — як віддає GET /api/jobs/[id] (job-detail на сайті). */
export interface JobProposal {
  id: string
  message: string
  priceCents: number
  estimatedDays: number
  /** SENT · ACCEPTED · REJECTED · WITHDRAWN */
  status: string
  createdAt: string
  /** Топ за тими самими вагами, що й розсилка (лише власникові). */
  recommended?: boolean
  /** Слот новачку — щоб нові майстри мали шанс (лише власникові). */
  isNew?: boolean
  master: {
    id: string
    name: string | null
    username: string | null
    avatar: string | null
    avgRating: number
    reviewsCount: number
  }
}

/**
 * GET /api/jobs/[id]. Поля з позначкою «нове» сайт віддає з
 * листопада 2026 — до деплою їх немає, екран без них просто коротший.
 */
export interface JobDetail {
  job: {
    id: string
    /**
     * Номер для людей (Job.number на сайті): цифрами, з 100001 — за ним
     * підтримка знаходить заявку. Старий сервер не шле.
     */
    number?: number
    title: string
    description: string | null
    status: JobStatus
    proposalsCount: number
    attachments: string[]
    createdAt: string
    budgetMinCents: number | null
    budgetMaxCents: number | null
    currency: string
    viewsCount: number
    expiresAt: string
    /** нове */
    metadata?: unknown
    /** нове: обсяг роботи 1–10 */
    effort?: number | null
    /** нове */
    editedAt?: string | null
    /** нове: назва міста */
    cityName?: string
    /** нове: район (не адреса) і відстань від району глядача */
    place?: { district: string | null; distanceKm: number | null }
    client: {
      name: string | null
      avatar?: string | null
      avgRating: number
      reviewsCount: number
      /** нове */
      createdAt?: string
    }
  }
  isOwner: boolean
  /** нове */
  isMaster?: boolean
  /** нове: власникові — усі, майстрові — його власна */
  proposals?: JobProposal[]
  /** нове */
  canPropose?: boolean
  /** нове */
  cantProposeReason?: string | null
}

// ─── КОПІЇ з web/src/lib/components/jobs/display.ts і categories/effort.ts ───

/** «Невелике / Середнє / Велике / Дуже велике прибирання» за балом 1–10. */
export function effortLabel(effort: number | null | undefined): string {
  if (!effort) return ''
  const tier =
    effort <= 3
      ? 'Невелике'
      : effort <= 6
        ? 'Середнє'
        : effort <= 8
          ? 'Велике'
          : 'Дуже велике'
  return `${tier} прибирання`
}

/** Обсяг одним словом для таблиці: «Невеликий», «Середній», «Великий». */
export function effortSize(effort: number | null | undefined): string {
  if (!effort) return ''
  if (effort <= 3) return 'Невеликий'
  if (effort <= 6) return 'Середній'
  if (effort <= 8) return 'Великий'
  return 'Дуже великий'
}

/** Скільки лишилось до закінчення заявки: «5 дн», «3 год», «< 1 год». */
export function expiresIn(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Прострочено'
  const days = Math.floor(diff / (24 * 60 * 60_000))
  const hr = Math.floor(diff / (60 * 60_000))
  if (days >= 1) return `${days} дн`
  if (hr >= 1) return `${hr} год`
  return '< 1 год'
}

/** «бер. 2025 р.» — з якого часу людина на Zunor. */
export function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', {
    month: 'short',
    year: 'numeric',
  })
}

/** «за 1 день», «за 3 дні». */
export function formatDays(n: number): string {
  return `${n} ${pluralUk(n, 'день', 'дні', 'днів')}`
}

const PROPOSAL_STATUS: Record<string, string> = {
  SENT: 'Очікує',
  ACCEPTED: 'Прийнято',
  REJECTED: 'Відхилено',
  WITHDRAWN: 'Відкликано',
}
export function proposalStatusLabel(s: string): string {
  return PROPOSAL_STATUS[s] ?? s
}

/**
 * Стан заявки словами людини — КОПІЯ `jobState` з
 * web/src/lib/components/jobs/display.ts. `action` — клієнтові треба щось
 * зробити (обрати майстра), лише цей стан підсвічується кольором.
 */
export function jobState(
  job: { status?: JobStatus; proposalsCount?: number | null },
  viewer: 'client' | 'master',
): { label: string; tone: 'live' | 'action' | 'progress' | 'done' | 'off' } {
  switch (job.status) {
    case 'OPEN': {
      if (viewer === 'master')
        return { label: 'Приймає пропозиції', tone: 'live' }
      const n = job.proposalsCount ?? 0
      return n > 0
        ? {
            label: `${n} ${pluralUk(n, 'пропозиція', 'пропозиції', 'пропозицій')}`,
            tone: 'action',
          }
        : { label: 'Шукаємо майстра', tone: 'live' }
    }
    case 'IN_PROGRESS':
      return { label: 'Майстра обрано', tone: 'progress' }
    case 'COMPLETED':
      return { label: 'Завершена', tone: 'done' }
    case 'EXPIRED':
      return { label: 'Термін минув', tone: 'off' }
    default:
      return { label: 'Скасована', tone: 'off' }
  }
}

/** «≈4 км», свій район — словами. КОПІЯ formatDistance з web/src/lib/geo. */
export function formatDistance(km: number): string {
  if (km < 0.5) return 'ваш район'
  return `≈${Math.max(1, Math.round(km))} км`
}

/**
 * Чому заявка «Топ для тебе» — КОПІЯ `fitReasonLabels` з
 * web/src/lib/components/jobs/display.ts. Невідома причина — без підпису.
 */
const FIT_REASONS: Record<string, string> = {
  near: 'Поруч з тобою',
  crew: 'Під твій формат роботи',
  vehicle: 'Є авто для вивозу',
}
export function fitReasonLabels(reasons: readonly string[]): string[] {
  return reasons.map((r) => FIT_REASONS[r]).filter(Boolean)
}

/** Свіжа заявка (майстрові): менше двох годин — як isFresh на сайті. */
export function isFresh(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 2 * 60 * 60_000
}

/** Бюджет словами: «800 ₴», «800 – 1 200 ₴», «до 1 200 ₴», «від 800 ₴». */
export function formatBudget(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
): string {
  const money = (cents: number) => formatPrice(cents, currency ?? 'UAH') ?? ''
  if (min && max) {
    if (min === max) return money(min)
    // «800 – 1 200 ₴»: знак валюти один раз, у кінці.
    return `${money(min).replace(/\s?₴$/, '')} – ${money(max)}`
  }
  if (max) return `до ${money(max)}`
  if (min) return `від ${money(min)}`
  return ''
}
