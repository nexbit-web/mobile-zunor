import { useQuery } from '@tanstack/react-query'
import { router, type Href } from 'expo-router'

import { LoadState } from '@/components/onboarding/load-state'
import { MasterOnboarding } from '@/components/onboarding/master-onboarding'
import { api } from '@/lib/api'
import type { MasterProfileData } from '@/shared/settings'

/** Анкета майстра (components/onboarding/master-onboarding). */
export default function MasterOnboardingScreen() {
  const query = useQuery({
    queryKey: ['me', 'master-profile'],
    queryFn: () => api<MasterProfileData>('/api/me/master-profile'),
  })
  // Назад — до «Хто ви?». Типи маршрутів знають його як /onboarding/index,
  // а адреса — /onboarding.
  const exit = () =>
    router.canGoBack() ? router.back() : router.replace('/onboarding' as Href)

  if (query.data) return <MasterOnboarding data={query.data} onExit={exit} />
  return (
    <LoadState
      error={query.error}
      onRetry={() => query.refetch()}
      onBack={exit}
    />
  )
}
