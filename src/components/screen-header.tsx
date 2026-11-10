import type { NativeStackHeaderProps } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Glyph } from '@/components/icons/glyph'
import { Backdrop } from '@/components/ui/backdrop'
import { headerScroll, HEADER_BAR, LARGE_TITLE } from '@/lib/large-title'
import { useColors } from '@/lib/theme'

/**
 * Шапка всіх екранів зі стеком — своя, а не системна, щоб скрізь була
 * однакова, але в подачі Apple:
 * - лежить ПОВЕРХ екрана й напівпрозора з розмиттям: зміст, що заходить
 *   під неї, ледь проглядає (екран для цього вмикає `headerTransparent`
 *   і відступає згори — lib/large-title);
 * - під нею — великий заголовок ліворуч; гортаєш — він їде під шапку, а
 *   в шапці по центру зʼявляється маленька назва;
 * - зліва — «‹ Назад» кольору акценту, як у iOS (або те, що дав екран:
 *   меню клієнта, «Скасувати» в редагуванні), праворуч — `headerRight`.
 */
export function ScreenHeader({
  navigation,
  route,
  options,
  back,
}: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets()
  const c = useColors()
  const title = typeof options.title === 'string' ? options.title : route.name
  const canGoBack = Boolean(back)
  const y = headerScroll(route.key)

  // Свій headerLeft екрана (меню клієнта, «Скасувати» в редагуванні)
  // важливіший за «Назад».
  const left = options.headerLeft ? (
    <View className="-ml-2.5">
      {options.headerLeft({ tintColor: c.foreground, canGoBack })}
    </View>
  ) : canGoBack ? (
    <BackButton onPress={() => navigation.goBack()} />
  ) : null
  const right = options.headerRight?.({ tintColor: c.foreground, canGoBack })

  // Маленька назва — коли великий заголовок майже сховався під шапку.
  const smallTitle = useAnimatedStyle(() => ({
    opacity: interpolate(
      y.get(),
      [LARGE_TITLE - 22, LARGE_TITLE - 4],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }))
  // Великий — їде разом зі списком (і вниз, коли список тягнуть).
  const largeTitle = useAnimatedStyle(() => ({
    transform: [{ translateY: -y.get() }],
  }))

  return (
    <View style={{ height: insets.top + HEADER_BAR }}>
      <Backdrop />
      <View style={{ paddingTop: insets.top }}>
        <View
          className="flex-row items-center px-4"
          style={{ height: HEADER_BAR }}
        >
          <View className="w-[116px] flex-row items-center">{left}</View>
          <Animated.Text
            numberOfLines={1}
            className="flex-1 text-center text-[17px] font-semibold text-foreground"
            style={smallTitle}
          >
            {title}
          </Animated.Text>
          {/* Дзвіночок (кнопка-іконка) сам зсуває зону дотику до краю. */}
          <View className="w-[116px] flex-row items-center justify-end gap-2">
            {right}
          </View>
        </View>
      </View>

      {/* Великий заголовок — під шапкою, обрізаний по її нижньому краю:
          їдучи вгору, він ховається під неї. Дотики проходять крізь нього
          до списку. Нижче за межі шапки — тому висота з запасом під
          «потягни вниз». */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + HEADER_BAR,
          left: 0,
          right: 0,
          height: LARGE_TITLE + 240,
          overflow: 'hidden',
        }}
      >
        <Animated.Text
          numberOfLines={1}
          className="px-4 pt-0.5 text-[34px] font-bold leading-[41px] tracking-[-0.6px] text-foreground"
          style={largeTitle}
        >
          {title}
        </Animated.Text>
      </View>
    </View>
  )
}

/** «‹ Назад» — кольору акценту, як системна кнопка iOS. */
function BackButton({ onPress }: { onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Назад"
      className="-ml-1.5 h-10 flex-row items-center active:opacity-50"
    >
      <Glyph name="back" size={23} color={c.primary} weight="semibold" />
      <Text className="ml-0.5 text-[17px] text-primary">Назад</Text>
    </Pressable>
  )
}
