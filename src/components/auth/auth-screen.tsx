import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  KEYBOARD_GAP,
  useKeyboardHeight,
} from '@/components/auth/use-keyboard-height'
import { Glyph } from '@/components/icons/glyph'
import { BalancedText } from '@/components/ui/balanced-text'
import { PastelGlow } from '@/components/ui/pastel-glow'
import { HEADER_BAR } from '@/lib/large-title'
import { useColors } from '@/lib/theme'

/**
 * Поява — усе одразу, без затримок (так попросив власник): екран
 * проявляється на місці (fade у _layout), заголовок і поля водночас
 * проявляються й ледь піднімаються (12 pt), рівно, без пружин, а знизу
 * в ту ж мить виїжджає клавіатура й підштовхує кнопку. Кожному — свій
 * будівник: методи ланцюжка міняють сам обʼєкт.
 */
const rise = () =>
  FadeInDown.duration(380)
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })
const TITLE_IN = rise()
const BODY_IN = rise()
const FOOTER_IN = FadeIn.duration(380).easing(Easing.out(Easing.cubic))

/** Поле під плашками доменів зсувається рівно, коли ті зʼявляються. */
export const FIELD_SHIFT = LinearTransition.duration(200).easing(
  Easing.out(Easing.cubic),
)

/**
 * Каркас екранів без акаунта — вхід, реєстрація, код із листа — як у
 * ClickUp (скриншоти власника): угорі коротка кольорова смуга
 * (PastelGlow short), ліворуч лише шеврон «Назад» (без кола й обводки),
 * заголовок по центру (28 pt напівжирним, рядки 1.1), під ним `body` —
 * поля; `action` — чорно-біла кнопка ВНИЗУ екрана, `footer` — посилання
 * під нею.
 *
 * Клавіатура: під кнопкою розпірка висотою з клавіатуру, тож кнопка їде
 * просто над нею й НЕ може наїхати на поля — область із полями
 * (прокрутка) лише стає нижчою; `footer` стоїть унизу на місці й
 * ховається під клавіатуру. Висота — з подій клавіатури (iOS
 * keyboardWillChangeFrame: куди й за скільки поїде), розпірку веде
 * withTiming з тією ж тривалістю й кривою. useAnimatedKeyboard тут не
 * годиться: клавіатура виїжджає ще під час появи екрана, і він віддавав
 * одразу кінцеву висоту — кнопка стрибала (власник помітив).
 * Підписка — в ефекті цього каркаса; поле, що кличе клавіатуру одразу
 * (`focusOnMount`), робить це кадром пізніше — коли підписка вже є.
 */
export function AuthScreen({
  title,
  subtitle,
  action,
  footer,
  back = true,
  glow = true,
  children,
}: {
  title: string
  /** Рядок під заголовком (код із листа: куди надіслали). */
  subtitle?: ReactNode
  action?: ReactNode
  footer?: ReactNode
  /** Шеврон «Назад»; немає куди — без нього («Хто ви?» після входу). */
  back?: boolean
  /**
   * Кольорова смуга вгорі. Вона — для входу й реєстрації; «Хто ви?» —
   * уже в акаунті, як анкета далі, тож без неї (власник).
   */
  glow?: boolean
  children: ReactNode
}) {
  const c = useColors()
  const insets = useSafeAreaInsets()

  // Висота посилань унизу (з «додому»): у спокої розпірка під кнопкою —
  // рівно вона, з клавіатурою — клавіатура. До заміру — приблизно.
  const below = useSharedValue(insets.bottom + (footer ? 86 : 8))
  const keyboard = useKeyboardHeight()

  const spacerStyle = useAnimatedStyle(() => ({
    height: Math.max(keyboard.get() + KEYBOARD_GAP, below.get()),
  }))

  return (
    <View className="flex-1 bg-background">
      {glow ? <PastelGlow short /> : null}

      {/* Посилання — унизу на місці; з клавіатурою ховаються під неї. */}
      {footer ? (
        <Animated.View
          entering={FOOTER_IN}
          className="absolute bottom-0 left-0 right-0 px-6 pt-3"
          style={{ paddingBottom: insets.bottom + 8 }}
          onLayout={(e) => below.set(e.nativeEvent.layout.height)}
        >
          {footer}
        </Animated.View>
      ) : null}

      {/* Клавіатура ховається, щойно потягнеш екран униз (як у Пошті): під
          нею — «Забули пароль?» і «Зареєструватися», а поле у фокусі
          одразу. Тому прокрутка й пружинить, навіть коли гортати нічого:
          без руху вона не помітила б, що тягнуть. Дотик по порожньому
          місцю теж ховає (`handled` — дотики по полях і кнопках ні). */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-6"
        contentContainerStyle={{
          paddingTop: insets.top + HEADER_BAR + 8,
          paddingBottom: 16,
        }}
      >
        <Animated.View entering={TITLE_IN} className="items-center gap-3 px-2">
          {/* Як у ClickUp: ~28 pt, рядки щільні (1.1), штрих — як у
              напівжирного SF (жирний виходив товщим, ніж у них). */}
          <BalancedText
            accessibilityRole="header"
            className="text-center text-[28px] font-semibold leading-[31px] tracking-[-0.6px] text-foreground"
          >
            {title}
          </BalancedText>
          {subtitle}
        </Animated.View>

        <Animated.View entering={BODY_IN} className="mt-8 gap-4">
          {children}
        </Animated.View>
      </ScrollView>

      {action ? <View className="px-6">{action}</View> : null}
      {/* Прозора й без дотиків: лежить над посиланнями. */}
      <Animated.View pointerEvents="none" style={spacerStyle} />

      {/* «Назад» — лише шеврон, без кола й обводки, як у ClickUp (так
          попросив власник); зона дотику — 44 pt. */}
      {back ? (
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/welcome')
          }
          accessibilityRole="button"
          accessibilityLabel="Назад"
          hitSlop={8}
          className="absolute left-2 size-11 items-center justify-center active:opacity-50"
          style={{ top: insets.top + (HEADER_BAR - 44) / 2 }}
        >
          <Glyph name="back" size={24} color={c.foreground} weight="medium" />
        </Pressable>
      ) : null}
    </View>
  )
}
