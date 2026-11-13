import * as Haptics from 'expo-haptics'
import { Platform, Pressable, Text } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated'

import { domainSuggestions, withDomain } from '@/lib/email-domains'

const IN = FadeIn.duration(180).easing(Easing.out(Easing.cubic))
const OUT = FadeOut.duration(140).easing(Easing.in(Easing.cubic))

/**
 * Плашки доменів під полем пошти — як у ClickUp: почав вводити — під
 * полем «@gmail.com», «@ukr.net»…, почав домен — лишаються ті, що
 * підходять; натиснув — домен дописався, плашки зникли, а `onPick` (вхід)
 * переводить курсор на пароль. Немає що підказати (поле порожнє, домен
 * повний чи свій) — нічого не малює. Не більше чотирьох (два рядки): з
 * клавіатурою пароль не має сховатись під «Увійти». Поява й зникнення —
 * рівно, без пружин.
 */
export function EmailDomains({
  value,
  visible,
  onPick,
}: {
  value: string
  /** Лише поки людина в полі пошти. */
  visible: boolean
  onPick: (email: string) => void
}) {
  const domains = visible ? domainSuggestions(value) : []
  if (domains.length === 0) return null

  return (
    <Animated.View
      entering={IN}
      exiting={OUT}
      className="flex-row flex-wrap gap-2"
      accessibilityLabel="Підказки пошти"
    >
      {domains.map((domain) => (
        <Pressable
          key={domain}
          onPress={() => {
            if (Platform.OS !== 'web') void Haptics.selectionAsync()
            onPick(withDomain(value, domain))
          }}
          accessibilityRole="button"
          accessibilityLabel={`Дописати @${domain}`}
          className="h-10 justify-center rounded-xl border border-field-edge px-3.5 active:opacity-60"
          style={{ borderCurve: 'continuous' }}
        >
          <Text className="text-[15px] font-semibold text-foreground">
            @{domain}
          </Text>
        </Pressable>
      ))}
    </Animated.View>
  )
}
