import { Stack } from 'expo-router'
import type { ReactNode } from 'react'

/**
 * Стек усередині вкладки: системна шапка з великим заголовком (iOS), а
 * екрани вглиб (заявка, чат) відкриваються в тій самій вкладці — панель
 * вкладок лишається на місці.
 */
export function TabStack({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
      {children}
    </Stack>
  )
}
