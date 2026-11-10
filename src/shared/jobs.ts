// Відповіді API заявок сайту (web/src/routes/api/jobs/**). Лише ті поля,
// які читає застосунок; сервер може віддавати більше. Контракт: поля на
// сервері лише додаються (../AGENTS.md), тож нове тут — опційне.

import { pluralUk } from './format'
import { formatPrice } from './orders'

export type JobStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'

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
export interface JobDetail {
  job: {
    id: string
    title: string
    description: string | null
    status: JobStatus
    proposalsCount: number
    attachments: string[]
    createdAt: string
    client: {
      name: string | null
      avgRating: number
      reviewsCount: number
    }
  }
  isOwner: boolean
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
