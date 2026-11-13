import { useQuery } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'

import { ClientOnboarding } from '@/components/onboarding/client-onboarding'
import { LoadState } from '@/components/onboarding/load-state'
import { api } from '@/lib/api'
import type { ProfileData } from '@/shared/settings'

/** Анкета замовника (components/onboarding/client-onboarding). */
export default function ClientOnboardingScreen() {
  const query = useQuery({
    queryKey: ['me', 'profile'],
    queryFn: () => api<ProfileData>('/api/me/profile'),
  })
  // Назад — до «Хто ви?». Типи маршрутів знають його як /onboarding/index,
  // а адреса — /onboarding.
  const exit = () =>
    router.canGoBack() ? router.back() : router.replace('/onboarding' as Href)

  if (query.data) return <ClientOnboarding data={query.data} onExit={exit} />
  return (
    <LoadState
      error={query.error}
      onRetry={() => query.refetch()}
      onBack={exit}
    />
  )
}
