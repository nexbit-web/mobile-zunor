import '@/global.css'

import { isRunningInExpoGo } from 'expo'
import { Stack, ThemeProvider, type NativeStackHeaderProps } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { HeaderBell } from '@/components/header-bell'
import { LaunchScreen } from '@/components/launch-screen'
import { MessageBanner } from '@/components/message-banner'
import { UndoToast } from '@/components/undo-toast'
import { Providers } from '@/components/providers'
import { ScreenHeader } from '@/components/screen-header'
import { initAppearance } from '@/lib/appearance'
import { authClient, isStaff, roleOf } from '@/lib/auth'
import { useNavigationTheme } from '@/lib/theme'

/** Екрани поверх застосунку — зі своєю шапкою, як і решта (ScreenHeader). */
// Шапка поверх екрана, напівпрозора, з великим заголовком
// (components/screen-header, lib/large-title).
const OVERLAY = {
  headerShown: true,
  headerTransparent: true,
  header: (props: NativeStackHeaderProps) => <ScreenHeader {...props} />,
}
/**
 * Те саме з дзвіночком праворуч — екрани поверх, крім сповіщень і
 * розділів налаштувань із кнопкою в шапці («Змінити», «Зберегти»): там
 * дзвіночок зайвий (так попросив власник).
 */
const WITH_BELL = { ...OVERLAY, headerRight: () => <HeaderBell /> }

// Системна заставка тримається, поки не ляже наш екран запуску
// (components/launch-screen) — він її й ховає. Тане (iOS), а не зникає:
// тема, обрана в застосунку, може відрізнятись від системної, і тоді
// фон заставки й екрана запуску різний.
SplashScreen.preventAutoHideAsync()
// В Expo Go заставка — його власна, а виклик лише сипле попередження в Metro.
if (!isRunningInExpoGo()) SplashScreen.setOptions({ fade: true, duration: 250 })
// Тема й колір акценту, обрані в налаштуваннях, — до першого кадру.
initAppearance()

/**
 * Корінь: три стани за сесією, і `Stack.Protected` сам переводить між
 * ними, коли сесія зʼявляється, міняється чи зникає. Без сесії —
 * привітання й вхід; із сесією, але без анкети (`onboarded`) — лише
 * «Хто ви?» і анкета своєї ролі, як замок онбордингу на сайті
 * (hooks.server.ts); з анкетою — застосунок. Співробітника без анкети
 * анкета не тримає (на сайті його місце — адмінка).
 */
export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession()
  const theme = useNavigationTheme()

  // Поки не відомо, чи є сесія, навігатора немає — лише екран запуску
  // (знак посередині), а не мигання екрана входу. Сесію better-auth тримає
  // в SecureStore, тож після першого входу це мить.
  //
  // Лише ДО ПЕРШОЇ відповіді. Далі better-auth перепитує сесію сам (після
  // реєстрації й входу, повернення застосунку з фону) і, поки сесії немає,
  // знову ставить `isPending: true`. Ховати тоді навігатор не можна: екран
  // реєстрації зникав разом із переходом на код із листа (власник
  // реєструвався — і опинявся на вході), а код губився б, щойно людина
  // сходила в Пошту по нього.
  const [booted, setBooted] = useState(false)
  if (!booted && !isPending) setBooted(true)
  // Екран запуску дотанув — більше його не малюємо.
  const [launched, setLaunched] = useState(false)

  const signedIn = Boolean(session)
  const needsProfile =
    signedIn && !session?.user.onboarded && !isStaff(roleOf(session?.user))

  // GestureHandlerRootView — для свайпу бічної панелі клієнта.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Providers>
        <ThemeProvider value={theme}>
          <StatusBar style="auto" />
          {booted ? (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Protected guard={signedIn && !needsProfile}>
                <Stack.Screen name="(app)" />
                {/* Поверх усього — «Назад» повертає туди, звідки відкрили. */}
                <Stack.Screen
                  name="job/[id]"
                  options={{ ...WITH_BELL, title: 'Заявка' }}
                />
                <Stack.Screen
                  name="order/[id]"
                  options={{ ...WITH_BELL, title: 'Замовлення' }}
                />
                <Stack.Screen
                  name="notifications"
                  options={{ ...OVERLAY, title: 'Сповіщення' }}
                />
                {/* Розмова — без нижньої панелі; праворуч фото співрозмовника
                  замість дзвіночка, як у Telegram. */}
                <Stack.Screen
                  name="chat/[id]"
                  options={{ ...OVERLAY, title: 'Чат' }}
                />
                {/* Налаштування — кожен розділ окремим екраном поверх
                  головного, як у Telegram. */}
                <Stack.Screen
                  name="settings"
                  options={{
                    ...WITH_BELL,
                    // «Параметри», як у iOS українською: коротше й легше.
                    title: 'Параметри',
                  }}
                />
                <Stack.Screen
                  name="settings/profile"
                  options={{ ...OVERLAY, title: 'Профіль' }}
                />
                <Stack.Screen
                  name="settings/security"
                  options={{ ...WITH_BELL, title: 'Безпека' }}
                />
                <Stack.Screen
                  name="settings/notifications"
                  options={{ ...WITH_BELL, title: 'Сповіщення' }}
                />
                <Stack.Screen
                  name="settings/appearance"
                  options={{ ...WITH_BELL, title: 'Вигляд' }}
                />
                <Stack.Screen
                  name="settings/assistant"
                  options={{ ...OVERLAY, title: 'AI асистент' }}
                />
              </Stack.Protected>
              {/* Без акаунта — привітання (Google, «Зареєструватися або
                увійти») першим, вхід поштою — окремим екраном далі. */}
              {/* Новий акаунт — спершу «Хто ви?» і анкета (components/onboarding).
                  Жесту «назад» в анкеті немає: він кидав би всю анкету, а не
                  крок; крок назад — шеврон (і «назад» Android). */}
              <Stack.Protected guard={needsProfile}>
                <Stack.Screen name="onboarding/index" />
                <Stack.Screen
                  name="onboarding/client"
                  options={{ gestureEnabled: false }}
                />
                <Stack.Screen
                  name="onboarding/master"
                  options={{ gestureEnabled: false }}
                />
              </Stack.Protected>
              <Stack.Protected guard={!signedIn}>
                <Stack.Screen name="welcome" />
                {/* Вхід проявляється на місці (не їде справа) — і одразу
                  знизу виїжджає клавіатура (так попросив власник). */}
                <Stack.Screen
                  name="sign-in"
                  options={{ animation: 'fade', animationDuration: 250 }}
                />
                {/* Реєстрація й код із листа — так само, проявою. */}
                <Stack.Screen
                  name="sign-up"
                  options={{ animation: 'fade', animationDuration: 250 }}
                />
                <Stack.Screen
                  name="verify-email"
                  options={{ animation: 'fade', animationDuration: 250 }}
                />
                {/* Відновлення пароля: пошта → код → новий пароль. */}
                <Stack.Screen
                  name="forgot-password"
                  options={{ animation: 'fade', animationDuration: 250 }}
                />
                <Stack.Screen
                  name="reset-code"
                  options={{ animation: 'fade', animationDuration: 250 }}
                />
                <Stack.Screen
                  name="new-password"
                  options={{ animation: 'fade', animationDuration: 250 }}
                />
              </Stack.Protected>
            </Stack>
          ) : null}
          {/* «Вам написали» — картка згори поверх усіх екранів, поки
              людина в застосунку (components/message-banner). */}
          {booted && signedIn && !needsProfile ? <MessageBanner /> : null}
          {/* «Видалено · Скасувати» — 5 с передумати (lib/undo). */}
          {booted && signedIn ? <UndoToast /> : null}
          {/* Поверх — поки не дотане; застосунок під ним уже готовий. */}
          {launched ? null : (
            <LaunchScreen ready={booted} onDone={() => setLaunched(true)} />
          )}
        </ThemeProvider>
      </Providers>
    </GestureHandlerRootView>
  )
}
