// Профілі другої сторони — відповіді API сайту:
//   GET /api/masters/[id]  — майстер (web: $lib/server/master-page, ті самі
//                            дані, що й публічна сторінка /@handle);
//   GET /api/clients/[id]  — клієнт, лише майстрові (web:
//                            $lib/server/client-profile, як /dashboard/client/[id]).
// Лише ті поля, які читає застосунок; сервер може віддавати більше.

import { KIND_OPTIONS, type Crew } from './masters'

/** Відгук у профілі: автор — лише імʼя (і перша літера для кружечка). */
export interface ProfileReview {
  id: string
  authorName: string
  authorInitials: string
  rating: number
  text: string
  createdAt: string
}

export interface MasterProfile {
  id: string
  name: string | null
  avatar: string | null
  bio: string | null
  /** Назва міста. */
  city: string | null
  createdAt: string
  isVerified: boolean
  /** null — профіль старший за питання «хто ви». */
  crew: Crew | null
  /** Назви категорій. */
  categories: string[]
  /** Slug'и тих самих категорій — за ними банер шапки (profiles/banner). */
  categorySlugs?: string[]
  /** Які прибирання робить (ключ — для іконки, як у заявках). */
  services: { key: string; label: string }[]
  /** Де прибирає: житло, офіси. */
  premises: { key: string; label: string }[]
  portfolioImages: string[]
  avgRating: number
  reviewsCount: number
  completedOrders: number
  reviews: ProfileReview[]
}

export interface ClientProfile {
  id: string
  name: string
  avatar?: string | null
  bio?: string | null
  city?: string | null
  createdAt: string
  totalOrders: number
  completedOrders: number
  avgRating: number
  reviewsCount: number
  reviews: ProfileReview[]
}

/** «Приватний майстер» / «Клінінгова компанія» — як на сторінці сайту. */
export function crewKindLabel(crew: Crew | null): string | null {
  if (!crew) return null
  const kind = crew === 'COMPANY' ? 'company' : 'person'
  return KIND_OPTIONS.find((o) => o.value === kind)?.label ?? null
}

/** Рейтинг одним знаком після коми: 4.8. */
export function formatRating(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(1)
}
