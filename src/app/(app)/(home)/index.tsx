import { JobsList } from '@/components/jobs/jobs-list'
import { ZunorChat } from '@/components/zunor/zunor-chat'
import { authClient, roleOf } from '@/lib/auth'

/**
 * Перший екран після входу — головна дія ролі: клієнт розповідає Zunor,
 * що прибрати; майстер бачить заявки поруч.
 */
export default function HomeScreen() {
  const { data: session } = authClient.useSession()
  return roleOf(session?.user) === 'MASTER' ? (
    <JobsList view="feed" />
  ) : (
    <ZunorChat />
  )
}
