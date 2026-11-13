import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GoogleButton } from '@/components/auth/google-button'
import { useGoogleSignIn } from '@/components/auth/use-google-sign-in'
import { ChipButton } from '@/components/ui/chip-button'
import { MonoButton } from '@/components/ui/mono-button'
import { PastelGlow } from '@/components/ui/pastel-glow'
import { ZunorBlinkMark } from '@/components/zunor/zunor-mark-blink'
import { SITE_URL } from '@/lib/config'
import { useColors, withAlpha } from '@/lib/theme'

/**
 * Перший екран без акаунта — як у ChatGPT і ClickUp (скриншоти
 * власника): посередині знак і «Zunor» в один рядок, під ними —
 * заголовок першого блоку сайту («AI-сервіс замовлення клінінгу в
 * Одесі», web/…/landing/hero.svelte) — великий і жирний, як у ClickUp
 * (~46 pt, чотири рівні рядки на всю ширину); способи входу внизу під
 * рукою (трохи вище за край — так попросив власник). «Продовжити з Google» — одразу звідси;
 * далі дві окремі кнопки, як у ChatGPT: «Створити акаунт» (чорно-біла,
 * `sign-up`) і «Увійти» (з гранню, `sign-in`). Була одна «Зареєструватися
 * або увійти», що вела на вхід, — новий шукав реєстрацію в посиланні під
 * клавіатурою.
 * «Пропустити» немає: без акаунта застосунком не користуються. Угорі —
 * пастельна смуга сайту. Підзаголовка під назвою немає — власник
 * попросив прибрати.
 *
 * Унизу — юридичний рядок, як під реєстрацією на сайті: умови й
 * політика відкриваються сторінками сайту.
 */
export default function WelcomeScreen() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const google = useGoogleSignIn()

  const openSite = (path: string) => () =>
    WebBrowser.openBrowserAsync(`${SITE_URL}${path}`)

  return (
    <View className="flex-1 bg-background">
      <PastelGlow />
      <View
        className="flex-1 px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
      >
        <View className="flex-1 items-center justify-center gap-6">
          <View
            accessible
            accessibilityLabel="Zunor"
            className="flex-row items-center gap-2.5"
          >
            <ZunorBlinkMark size={34} />
            <Text className="text-[31px] font-bold tracking-[-0.9px] text-foreground">
              Zunor
            </Text>
          </View>
          <Text
            accessibilityRole="header"
            className="text-center font-extrabold"
            style={[HEADLINE, { color: withAlpha(c.foreground, 0.9) }]}
          >
            {HEADLINE_TEXT}
          </Text>
        </View>

        <View className="gap-4">
          <View className="gap-1.5">
            <GoogleButton onPress={google.start} loading={google.loading} />
            {google.error ? (
              <Text
                accessibilityLiveRegion="polite"
                className="px-1 text-center text-[13px] leading-[18px] text-destructive"
              >
                {google.error}
              </Text>
            ) : null}
          </View>

          <View className="flex-row items-center gap-3">
            <View className="h-px flex-1 bg-input" />
            <Text className="text-[13px] font-medium uppercase tracking-[0.4px] text-muted-foreground">
              або
            </Text>
            <View className="h-px flex-1 bg-input" />
          </View>

          {/* Двері окремо, як у ChatGPT: новий — одразу реєстрація, а не
              вхід із посиланням «Зареєструватися» під клавіатурою. */}
          <View className="gap-3">
            <MonoButton
              label="Створити акаунт"
              onPress={() => router.push('/sign-up')}
              disabled={google.loading}
            />
            <ChipButton
              label="Увійти"
              onPress={() => router.push('/sign-in')}
              disabled={google.loading}
            />
          </View>

          <Text className="mt-3 px-2 text-center text-[13px] leading-[19px] text-muted-foreground">
            Продовжуючи, ви погоджуєтеся з нашими{' '}
            <Text
              accessibilityRole="link"
              onPress={openSite('/terms')}
              className="font-semibold text-foreground"
              style={LINK}
            >
              Умовами використання
            </Text>{' '}
            і{' '}
            <Text
              accessibilityRole="link"
              onPress={openSite('/privacy')}
              className="font-semibold text-foreground"
              style={LINK}
            >
              Політикою конфіденційності
            </Text>
            .
          </Text>
        </View>
      </View>
    </View>
  )
}

/**
 * Заголовок сайту. «AI-сервіс» — з нерозривним дефісом (U+2011), «в
 * Одесі» — з нерозривним пробілом: «AI-» і «в» не лишаються самі в кінці
 * рядка.
 */
const NB_HYPHEN = String.fromCharCode(0x2011)
const NB_SPACE = String.fromCharCode(0xa0)
const HEADLINE_TEXT = `AI${NB_HYPHEN}сервіс замовлення клінінгу в${NB_SPACE}Одесі`

/**
 * Як у ClickUp (скриншот власника): великий, дуже жирний, тісний —
 * міжрядковий 1.1, трекінг −3.5%, колір — не чисто білий, а 90% кольору
 * тексту (мʼякий світло-сірий у темній, майже чорний у світлій). На сайті
 * 32 pt напівжирним — на телефоні власник попросив більше. Кожне слово й
 * так стає своїм рядком — BalancedText тут не потрібен.
 */
const HEADLINE = {
  fontSize: 46,
  lineHeight: 50,
  letterSpacing: -1.6,
} as const

/** Посилання в рядку — пунктиром, як у ChatGPT: видно, що натискається. */
const LINK = {
  textDecorationLine: 'underline',
  textDecorationStyle: 'dotted',
} as const
