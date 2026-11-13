import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, Text } from 'react-native'

import { AuthScreen } from '@/components/auth/auth-screen'
import { ChoiceList } from '@/components/onboarding/controls'
import { useEnterApp } from '@/components/onboarding/use-enter-app'
import { queryClient } from '@/components/providers'
import { MonoButton } from '@/components/ui/mono-button'
import { api } from '@/lib/api'
import { authClient } from '@/lib/auth'
import { confirmAction } from '@/lib/confirm'

type Role = 'client' | 'master'

const ROLES = [
  {
    value: 'client' as Role,
    icon: 'person' as const,
    label: 'Я замовник',
    hint: 'Хочу замовити прибирання',
  },
  {
    value: 'master' as Role,
    icon: 'cleaning' as const,
    label: 'Я майстер',
    hint: 'Хочу отримувати заявки та заробляти',
  },
]

/** Дані анкети — ті самі ключі, що в налаштуваннях профілю. */
const DATA = {
  client: { queryKey: ['me', 'profile'], path: '/api/me/profile' },
  master: {
    queryKey: ['me', 'master-profile'],
    path: '/api/me/master-profile',
  },
} as const

/**
 * «Хто ви?» — перший екран нового акаунта, як на сайті
 * (dashboard/onboarding): дві картки й «Далі». Картка лише позначає
 * вибір — крок робить кнопка (можна подивитись на другий варіант), а
 * поки нічого не обрано, «Далі» підкаже «Оберіть, хто ви», а не мовчки
 * не натиснеться. Далі — покрокова анкета своєї ролі; дані для неї
 * починаємо тягнути, щойно людина обрала картку.
 *
 * Корінь пускає сюди, доки в сесії немає `onboarded` (як замок
 * онбордингу на сайті), тож «Назад» тут немає — є «Вийти з акаунта»
 * (раптом зайшли не тим акаунтом).
 */
export default function OnboardingRoleScreen() {
  const [role, setRole] = useState<Role | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const enterApp = useEnterApp()

  // Анкету могли вже заповнити (на сайті, щойно), а сесія в кеші cookie
  // (до 5 хв) ще стара — одна свіжа перевірка: є — одразу в застосунок.
  useEffect(() => {
    void enterApp()
    // Лише на появі екрана.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function pick(next: Role) {
    setRole(next)
    setHint(null)
    const { queryKey, path } = DATA[next]
    void queryClient.prefetchQuery({ queryKey, queryFn: () => api(path) })
  }

  function next() {
    if (!role) {
      setHint('Оберіть, хто ви')
      return
    }
    router.push(role === 'client' ? '/onboarding/client' : '/onboarding/master')
  }

  async function signOut() {
    const ok = await confirmAction('Вийти з акаунта?', {
      confirm: 'Вийти',
      destructive: true,
    })
    if (!ok) return
    await authClient.signOut()
    // Дані попередньої людини не мають пережити вихід.
    queryClient.clear()
  }

  return (
    <AuthScreen
      back={false}
      glow={false}
      title="Хто ви?"
      subtitle={
        <Text className="text-center text-[16px] leading-[22px] text-muted-foreground">
          Від цього залежить, що ви побачите далі.
        </Text>
      }
      action={<MonoButton label="Далі" onPress={next} />}
      footer={
        <Pressable
          onPress={signOut}
          className="items-center py-1.5 active:opacity-60"
        >
          <Text className="text-[15px] text-muted-foreground">
            Вийти з акаунта
          </Text>
        </Pressable>
      }
    >
      <ChoiceList
        options={ROLES}
        selected={(v) => role === v}
        onPress={pick}
        error={hint}
      />
    </AuthScreen>
  )
}
