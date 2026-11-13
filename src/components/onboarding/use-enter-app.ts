import { queryClient } from '@/components/providers'
import { authClient } from '@/lib/auth'

/**
 * Анкету збережено — у застосунок. Корінь (`app/_layout.tsx`) пускає
 * далі за `onboarded` у сесії, тож беремо свіжу сесію повз кеш у cookie
 * (5 хв): сервер після збереження вже переписав копію користувача в
 * сесіях (`refreshSessionUser`). Лише коли там справді `onboarded`,
 * оновлюємо сесію кореня — і він сам відкриває застосунок потрібної ролі
 * (майстрові — вкладки майстра). Ні (збій мережі) — `false`: екран
 * покаже помилку й кнопку ще раз, а не «зависне» на останньому кроці.
 */
export function useEnterApp() {
  const { refetch } = authClient.useSession()
  return async function enterApp(): Promise<boolean> {
    try {
      const { data } = await authClient.getSession({
        query: { disableCookieCache: true },
      })
      if (!data?.user.onboarded) return false
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      await refetch({ query: { disableCookieCache: true } })
      return true
    } catch {
      return false
    }
  }
}
