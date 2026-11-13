import { Drawer, getDrawerStatusFromState } from 'expo-router/drawer'
import { useState, type ReactNode } from 'react'
import { useWindowDimensions } from 'react-native'

import {
  DRAWER_EDGE,
  drawerSwipeZone,
  openOnRightSwipe,
  useDrawerSwipeWide,
} from '@/lib/drawer-swipe'
import { useColors } from '@/lib/theme'

import { ClientDrawer } from './client-drawer'

/**
 * Бічна панель клієнта — навігатор `expo-router/drawer` з нашою панеллю
 * (ClientDrawer) і нашим жестом. `children` — його екрани (`Drawer.Screen`):
 * усі розділи (ClientShell) або лише розмова (нижня панель, прототип
 * lib/dock — app/(app)/(home)/_layout).
 */
export function ClientDrawerNavigator({ children }: { children: ReactNode }) {
  const c = useColors()
  const { width } = useWindowDimensions()
  // Свайп управо, що почався в лівій чверті екрана, відкриває панель
  // (lib/drawer-swipe); де свайп управо зараз потрібен списку — лише від
  // самого краю.
  const wide = useDrawerSwipeWide()
  // Відкриту панель закриває звичайний жест (в обидва боки), закриту —
  // відкриває лише свайп управо: уліво гортаються розділи.
  const [open, setOpen] = useState(false)
  return (
    <Drawer
      drawerContent={(props) => <ClientDrawer {...props} />}
      screenListeners={{
        state: (e) => {
          type DrawerState = Parameters<typeof getDrawerStatusFromState>[0]
          const status = getDrawerStatusFromState(
            (e.data as { state: DrawerState }).state,
            'closed',
          )
          setOpen(status !== 'closed')
        },
      }}
      screenOptions={{
        headerShown: false,
        // Шарами, як у ClickUp: панель лежить ПІД сторінкою на весь екран,
        // сторінка відʼїжджає вправо поверх неї — на всю висоту, із
        // заокругленими кутами й тонкою гранню (DrawerScene), панель
        // підіймається з глибини (ClientDrawer). Без затемнення й тіні.
        drawerType: 'back',
        overlayColor: 'transparent',
        drawerStyle: { width: '80%', backgroundColor: c.drawer },
        sceneStyle: { backgroundColor: c.background },
        swipeEdgeWidth: wide ? drawerSwipeZone(width) : DRAWER_EDGE,
        swipeMinDistance: 40,
        configureGestureHandler: open ? undefined : openOnRightSwipe,
      }}
    >
      {children}
    </Drawer>
  )
}
