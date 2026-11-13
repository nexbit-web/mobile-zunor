import { Stack } from 'expo-router'
import type { ReactNode } from 'react'

import { authClient, roleOf } from '@/lib/auth'
import { CLIENT_DOCK, MASTER_DOCK } from '@/lib/dock'

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
  // З нижньою панеллю (прототип, lib/dock) розділи клієнта перемикає вона:
  // кнопки ☰ немає (бічна панель — лише на головній), а сповіщення — її
  // вкладкою, тож і дзвіночка в шапці немає.
  const dock = !master && CLIENT_DOCK
  // Назва розділу ліворуч, 22 pt, і так і лишається під час прокрутки — у
  // всіх із нижньою панеллю, і в майстра (власник: не переїжджати в центр).
  const leftTitle = dock || (master && MASTER_DOCK)

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
          headerRight: dock ? undefined : () => <HeaderBell />,
          // Розділ із нижньою панеллю: зліва кнопки немає — назва
          // ліворуч і більша (так попросив власник).
          headerTitleAlign: leftTitle ? 'left' : undefined,
          headerLeft: master || dock ? undefined : () => <MenuButton />,
        }}
      />
      {children}
    </Stack>
  )

  // Сторінка відʼїжджає над бічною панеллю — лише там, де панель є: з
  // нижньою (прототип) розділи живуть без неї.
  return master || dock ? stack : <DrawerScene>{stack}</DrawerScene>
}
