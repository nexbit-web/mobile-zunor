import { Stack } from 'expo-router'
import { useState } from 'react'

import { DrawerScene } from '@/components/drawer/drawer-scene'
import { WithBell } from '@/components/header-bell'
import { FeedFilter } from '@/components/jobs/feed-filter'
import { JobsList } from '@/components/jobs/jobs-list'
import { ZunorChat } from '@/components/zunor/zunor-chat'
import { authClient, roleOf } from '@/lib/auth'
import { CLIENT_DOCK } from '@/lib/dock'

/**
 * Перший екран після входу — головна дія ролі: клієнт розповідає Zunor,
 * що прибрати; майстер бачить заявки поруч.
 */
export default function HomeScreen() {
  const { data: session } = authClient.useSession()
  if (roleOf(session?.user) === 'MASTER') return <MasterFeed />
  // З нижньою панеллю (прототип, lib/dock) бічна панель — у (home)/_layout
  // без стека: сторінка, що відʼїжджає над нею, — тут.
  if (CLIENT_DOCK) {
    return (
      <DrawerScene>
        <ZunorChat />
      </DrawerScene>
    )
  }
  return <ZunorChat />
}

/**
 * Стрічка майстра: у шапці поруч із дзвіночком — фільтр за послугою, як
 * «Показати: …» на сайті.
 */
function MasterFeed() {
  const [service, setService] = useState<string | null>(null)
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <WithBell>
              <FeedFilter value={service} onChange={setService} />
            </WithBell>
          ),
        }}
      />
      <JobsList
        view="feed"
        service={service}
        onClearService={() => setService(null)}
      />
    </>
  )
}
