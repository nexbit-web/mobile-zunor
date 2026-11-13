import { useDrawerProgress } from 'expo-router/drawer'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

import { PageShift } from '@/components/ui/header-fade'
import { useColors } from '@/lib/theme'

/** Заокруглення сторінки, коли вона відʼїхала. */
const RADIUS = 28

/**
 * Бічна панель клієнта — шарами, як у ClickUp (скриншот власника): панель
 * лежить ПІД сторінкою на весь екран (`drawerType: 'back'`), а сторінка
 * відʼїжджає вправо поверх неї — на всю висоту, без відступів згори й
 * знизу, із заокругленими кутами й тонкою світлою гранню по краю
 * (`drawerEdge`). Край — чіткий: без тіні й розмиття (тінь власник
 * попросив прибрати). Панель у цей час підіймається з глибини
 * (ClientDrawer).
 *
 * Під заокругленими кутами — колір панелі, тож вона читається одним
 * шаром під сторінкою. Грань — окремим шаром поверх змісту, а не
 * `borderWidth` сторінки: та зсувала б зміст на пункт і в спокої.
 *
 * Усе — за `useDrawerProgress`, тобто за пальцем, без своїх пружин.
 * Лише всередині панелі клієнта (useDrawerProgress без неї кидає).
 */
export function DrawerScene({ children }: { children: ReactNode }) {
  const progress = useDrawerProgress()
  const c = useColors()

  const sheet = useAnimatedStyle(() => ({
    borderRadius: RADIUS * progress.get(),
  }))
  // Грань зʼявляється з першими пунктами руху й далі вже не міняється.
  const edge = useAnimatedStyle(() => ({
    borderRadius: RADIUS * progress.get(),
    opacity: Math.min(1, progress.get() * 6),
  }))

  return (
    <View style={{ flex: 1, backgroundColor: c.drawer }}>
      <Animated.View
        style={[
          {
            flex: 1,
            overflow: 'hidden',
            borderCurve: 'continuous',
            backgroundColor: c.background,
          },
          sheet,
        ]}
      >
        {/* Тло шапки гасить розмиття, поки сторінка їде (PageShift). */}
        <PageShift value={progress}>{children}</PageShift>
        {/* Грань — завжди найвище: шапки з `zIndex` її не накривають. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderWidth: 1,
              borderColor: c.drawerEdge,
              borderCurve: 'continuous',
              zIndex: 100,
            },
            edge,
          ]}
        />
      </Animated.View>
    </View>
  )
}
