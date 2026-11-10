import { Stack } from 'expo-router'

import { TabStack } from '@/components/tab-stack'
import { authClient, roleOf } from '@/lib/auth'

export default function JobsLayout() {
  const { data: session } = authClient.useSession()
  const master = roleOf(session?.user) === 'MASTER'
  return (
    <TabStack title={master ? 'Стрічка' : 'Мої заявки'}>
      <Stack.Screen
        name="job/[id]"
        options={{ title: 'Заявка', headerLargeTitle: false }}
      />
    </TabStack>
  )
}
