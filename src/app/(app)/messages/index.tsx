import { Message01Icon } from '@hugeicons/core-free-icons'

import { ComingSoon } from '@/components/coming-soon'

// Далі: GET /api/chats і Pusher (`/api/pusher/auth`) — список і живі чати.
export default function MessagesScreen() {
  return (
    <ComingSoon
      icon={Message01Icon}
      title="Чати — незабаром"
      text="Листування з майстрами й клієнтами переїде сюди. Поки що — на сайті."
    />
  )
}
