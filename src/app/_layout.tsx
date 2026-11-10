import '@/global.css'

import { Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'

import { Providers } from '@/components/providers'
import { authClient } from '@/lib/auth'
import { useNavigationTheme } from '@/lib/theme'

SplashScreen.preventAutoHideAsync()

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

  return (
    <Providers>
      <ThemeProvider value={theme}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </Providers>
  )
}
