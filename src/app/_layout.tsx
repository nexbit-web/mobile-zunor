import '@/global.css'

import {
  Stack,
  ThemeProvider,
  type NativeStackHeaderProps,
} from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { HeaderBell } from '@/components/header-bell'
import { Providers } from '@/components/providers'
import { ScreenHeader } from '@/components/screen-header'
import { initAppearance } from '@/lib/appearance'
import { authClient } from '@/lib/auth'
import { useNavigationTheme } from '@/lib/theme'

/** Екрани поверх застосунку — зі своєю шапкою, як і решта (ScreenHeader). */
// Шапка поверх екрана, напівпрозора, з великим заголовком
// (components/screen-header, lib/large-title).
const OVERLAY = {
  headerShown: true,
  headerTransparent: true,
  header: (props: NativeStackHeaderProps) => <ScreenHeader {...props} />,
}

SplashScreen.preventAutoHideAsync()
// Тема й колір акценту, обрані в налаштуваннях, — до першого кадру.
initAppearance()

/**
 * Корінь: дві половини застосунку за сесією. Без сесії доступний лише
 * вхід, із сесією — вкладки; `Stack.Protected` сам переводить між ними,
 * коли сесія зʼявляється чи зникає (вхід, вихід, сесія сплила).
 */
export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession()
  const theme = useNavigationTheme()

  // Сесію better-auth тримає в SecureStore, тож після першого входу це
  // мить, а не запит у мережу. Доти — заставка, а не мигання екрана входу.
  useEffect(() => {
    if (!isPending) SplashScreen.hideAsync()
  }, [isPending])

  if (isPending) return null
  const signedIn = Boolean(session)

  // GestureHandlerRootView — для свайпу бічної панелі клієнта.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Providers>
        <ThemeProvider value={theme}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(app)" />
              {/* Поверх усього — «Назад» повертає туди, звідки відкрили. */}
              <Stack.Screen
                name="job/[id]"
                options={{ ...OVERLAY, title: 'Заявка' }}
              />
              <Stack.Screen
                name="notifications"
                options={{ ...OVERLAY, title: 'Сповіщення' }}
              />
              {/* Налаштування — кожен розділ окремим екраном поверх
                  головного, як у Telegram. */}
              <Stack.Screen
                name="settings"
                options={{
                  ...OVERLAY,
                  title: 'Налаштування',
                  headerRight: () => <HeaderBell edge />,
                }}
              />
              <Stack.Screen
                name="settings/profile"
                options={{ ...OVERLAY, title: 'Профіль' }}
              />
              <Stack.Screen
                name="settings/security"
                options={{ ...OVERLAY, title: 'Безпека' }}
              />
              <Stack.Screen
                name="settings/notifications"
                options={{ ...OVERLAY, title: 'Сповіщення' }}
              />
              <Stack.Screen
                name="settings/appearance"
                options={{ ...OVERLAY, title: 'Вигляд' }}
              />
              <Stack.Screen
                name="settings/assistant"
                options={{ ...OVERLAY, title: 'AI асистент' }}
              />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="sign-in" />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </Providers>
    </GestureHandlerRootView>
  )
}
