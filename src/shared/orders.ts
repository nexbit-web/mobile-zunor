// Відповідь GET /api/orders сайту (web/src/routes/api/orders/+server.ts).
// Лише поля, які читає застосунок. Контракт: на сервері поля лише
// додаються, тож нове тут — опційне.

export type OrderStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface OrderPerson {
  id: string
  name: string | null
  username: string | null
  avatar: string | null
}

export interface OrderListItem {
  id: string
  title: string
  /** Деталі прибирання (послуга, день, характеристики) — з нових версій API. */
  metadata?: Record<string, unknown> | null
  /** Коли створено заявку: від неї рахуються «сьогодні/завтра». */
  jobCreatedAt?: string | null
  priceCents: number | null
  currency: string | null
  status: OrderStatus
  createdAt: string
  updatedAt: string
  clientId: string
  masterId: string
  client: OrderPerson | null
  master: OrderPerson | null
}

export interface OrdersList {
  orders: OrderListItem[]
}

/** Сторона угоди на екрані замовлення: з телефоном — угода вже є. */
export interface OrderParty extends OrderPerson {
  city: string | null
  phone: string | null
  avgRating: number
  reviewsCount: number
}

export interface OrderReview {
  id: string
  rating: number
  comment: string | null
  direction: 'CLIENT_TO_MASTER' | 'MASTER_TO_CLIENT'
  authorId: string
  createdAt: string
}

/**
 * Відповідь GET /api/orders/[id] сайту (web: $lib/server/order-detail,
 * `orderDetailDto`) — ті самі дані, що на сторінці замовлення сайту.
 */
export interface OrderDetail {
  id: string
  title: string
  description: string
  metadata: Record<string, unknown> | null
  priceCents: number | null
  currency: string | null
  status: OrderStatus
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  cancelledById: string | null
  clientId: string
  masterId: string
  chatId: string | null
  /** Заявка, з якої вийшло замовлення. */
  jobId: string | null
  jobCreatedAt: string | null
  /** Номер заявки для людей (Job.number). Старий сервер не шле. */
  jobNumber?: number | null
  client: OrderParty
  master: OrderParty & { isVerified: boolean; completedOrders: number }
  reviews: OrderReview[]
}

/** Стан замовлення — КОПІЯ підписів web/src/lib/orders/labels.ts. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: 'Створено',
  IN_PROGRESS: 'В роботі',
  COMPLETED: 'Завершено',
  CANCELLED: 'Скасовано',
}

/** «1 200 ₴». Ціни на сайті — у копійках. */
export function formatPrice(
  cents: number | null,
  currency: string | null,
): string | null {
  if (cents == null) return null
  const amount = Math.round(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return currency && currency !== 'UAH'
    ? `${amount} ${currency}`
    : `${amount} ₴`
}
