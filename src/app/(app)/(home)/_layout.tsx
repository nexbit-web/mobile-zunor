import { TabStack } from '@/components/tab-stack'
import { authClient, roleOf } from '@/lib/auth'

/** Головна: клієнтові — розмова з Zunor, майстрові — стрічка. */
export default function HomeLayout() {
  const { data: session } = authClient.useSession()
  const master = roleOf(session?.user) === 'MASTER'
  return <TabStack title={master ? 'Стрічка' : 'Zunor'} />
}
