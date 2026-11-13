import { Drawer } from 'expo-router/drawer'

import { ClientDrawerNavigator } from '@/components/drawer/client-drawer-navigator'
import { TabStack } from '@/components/tab-stack'
import { authClient, roleOf } from '@/lib/auth'
import { CLIENT_DOCK } from '@/lib/dock'

/**
 * Головна: клієнтові — розмова з Zunor, майстрові — стрічка.
 *
 * З нижньою панеллю (прототип, lib/dock) бічна панель клієнта — лише тут,
 * у розмові: розділи перемикає нижня панель, а в бічній — історія заявок.
 */
export default function HomeLayout() {
  const { data: session } = authClient.useSession()
  const master = roleOf(session?.user) === 'MASTER'
  if (!master && CLIENT_DOCK) {
    return (
      <ClientDrawerNavigator>
        <Drawer.Screen name="index" />
      </ClientDrawerNavigator>
    )
  }
  return <TabStack title={master ? 'Стрічка' : 'Zunor'} />
}
