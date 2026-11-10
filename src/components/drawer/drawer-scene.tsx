import { useDrawerProgress } from 'expo-router/drawer'
import type { ReactNode } from 'react'
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated'

/**
 * Екран, що відʼїжджає вправо, коли відкрита панель: заокруглюється, як
 * картка поверх панелі. Рамки немає — екран і панель розрізняє колір
 * (панель — шар «картка»). Лише всередині панелі клієнта
 * (useDrawerProgress без неї кидає).
 */
export function DrawerScene({ children }: { children: ReactNode }) {
  const progress = useDrawerProgress()
  const frame = useAnimatedStyle(() => ({
    borderRadius: interpolate(progress.value, [0, 1], [0, 32]),
  }))
  return (
    <Animated.View style={[{ flex: 1, overflow: 'hidden' }, frame]}>
      {children}
    </Animated.View>
  )
}
