import { Briefcase01Icon } from '@hugeicons/core-free-icons'

import { ComingSoon } from '@/components/coming-soon'

// Далі: GET /api/orders (вже є на сайті) — список, як orders/order-card.
export default function OrdersScreen() {
  return (
    <ComingSoon
      icon={Briefcase01Icon}
      title="Замовлення — незабаром"
      text="Тут будуть домовленості з майстрами: статус, ціна, чат. Поки що вони на сайті."
    />
  )
}
