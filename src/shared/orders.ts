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
