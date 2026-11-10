import { Notification01Icon } from '@hugeicons/core-free-icons'

import { ComingSoon } from '@/components/coming-soon'

// Далі: GET /api/notifications і push (PushDevice на сервері).
export default function NotificationsScreen() {
  return (
    <ComingSoon
      icon={Notification01Icon}
      title="Сповіщення — незабаром"
      text="Нові заявки, пропозиції й нагадування прийдуть сюди й на екран телефону."
    />
  )
}
