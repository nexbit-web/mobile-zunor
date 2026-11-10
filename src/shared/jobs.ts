// Відповіді API заявок сайту (web/src/routes/api/jobs/**). Лише ті поля,
// які читає застосунок; сервер може віддавати більше. Контракт: поля на
// сервері лише додаються (../AGENTS.md), тож нове тут — опційне.

import { pluralUk } from './format'

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
  /** Лише стрічка майстра: район заявки й відстань від його району. */
  place?: { district: string | null; distanceKm: number | null } | null
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
