import { Stack } from 'expo-router'
import type { ReactNode } from 'react'

import { authClient, roleOf } from '@/lib/auth'

import { DrawerScene } from './drawer/drawer-scene'
import { MenuButton } from './drawer/menu-button'
import { HeaderBell } from './header-bell'
import { ScreenHeader } from './screen-header'

/**
 * Стек розділу зі своєю шапкою (ScreenHeader). На головному екрані
 * розділу праворуч — дзвіночок сповіщень із числом непрочитаних, у
 * клієнта ще й зліва кнопка бічної панелі (у майстра вкладки). Екрани
 * вглиб (заявка, налаштування) — у корені, поверх усього: «назад» з них
 * повертає туди, звідки прийшли.
 */
export function TabStack({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  const { data: session } = authClient.useSession()
  const master = roleOf(session?.user) === 'MASTER'

  const stack = (
    <Stack
      screenOptions={{
        // Шапка поверх екрана, напівпрозора, з великим заголовком
        // (components/screen-header, lib/large-title).
        headerTransparent: true,
        header: (props) => <ScreenHeader {...props} />,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title,
          headerRight: () => <HeaderBell edge />,
          headerLeft: master ? undefined : () => <MenuButton />,
        }}
      />
      {children}
    </Stack>
  )

  return master ? stack : <DrawerScene>{stack}</DrawerScene>
}
