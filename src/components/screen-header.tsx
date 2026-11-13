import type { NativeStackHeaderProps } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Backdrop } from '@/components/ui/backdrop'
import { HeaderFade } from '@/components/ui/header-fade'
import { RoundButton } from '@/components/ui/round-button'
import {
  HEADER_BAR,
  headerAway,
  headerScroll,
  useInlineTitles,
} from '@/lib/large-title'
import { useColors } from '@/lib/theme'

/**
 * Шапка всіх екранів зі стеком — своя, а не системна, щоб скрізь була
 * однакова, але в подачі Apple:
 * - лежить ПОВЕРХ екрана (екран для цього вмикає `headerTransparent` і
 *   відступає згори — lib/large-title). Тло — градієнт кольору фону
 *   (HeaderFade): зміст заходить під шапку й до верху екрана плавно тоне
 *   у фон, без лінії-краю. Два винятки:
 *   - `headerShadowVisible: false` — тло малює сам екран (SwipeTabs: один
 *     ефект від верху екрана до перемикача, інакше два накладались би);
 *   - `headerBlurEffect` — тверда шапка з чітким краєм (Backdrop):
 *     розмова — суцільний фон і лінія, як у поля внизу (власник);
 * - кнопки — круглі, на підкладці з контуром (RoundButton, HeaderPill),
 *   «Назад» — такою самою кнопкою з шевроном кольору тексту (так попросив
 *   власник);
 * - головний екран майстра із системними вкладками (lib/dock,
 *   MASTER_DOCK = false) — на самому верху назва великим ліворуч;
 *   щойно зміст пішов під шапку — велика тане, по центру — маленька, як в
 *   App Store. З нижньою панеллю — як у клієнта (нижче): назва ліворуч і
 *   не переїжджає (власник);
 * - решта — назва по центру, зліва «Назад» (або те, що дав екран: меню
 *   клієнта, «✕» у редагуванні), праворуч — `headerRight`. Бічні
 *   місця однакові (назва — точно по центру) і не вужчі за свій вміст:
 *   «Змінити» ширша за кнопку — тоді обидва розсуваються, а назва
 *   скорочується;
 * - екран може дати свою назву (`headerTitle`-функція — розмова: імʼя й
 *   «у мережі»);
 * - `headerTitleAlign: 'left'` без кнопки зліва — назва ліворуч, більша
 *   (22 pt) і така сама під час прокрутки: розділи з нижньою панеллю
 *   (lib/dock) — і клієнта, і майстра.
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
  // Екран зі своїм тлом (заявка — колір картки) дає його через headerStyle.
  const headerBg = StyleSheet.flatten(options.headerStyle)?.backgroundColor
  // Назва ліворуч, що не згортається (`headerTitleAlign: 'left'` — розділи
  // з нижньою панеллю, і в майстра теж), важливіша за «велику → маленьку».
  const inline =
    useInlineTitles() &&
    !canGoBack &&
    !options.headerLeft &&
    options.headerTitleAlign !== 'left'
  const customTitle =
    typeof options.headerTitle === 'function'
      ? options.headerTitle({ children: title, tintColor: c.foreground })
      : null

  // Свій headerLeft екрана (меню клієнта, «✕» у редагуванні)
  // важливіший за «Назад».
  const left = options.headerLeft ? (
    options.headerLeft({ tintColor: c.foreground, canGoBack })
  ) : canGoBack ? (
    <RoundButton
      icon="back"
      label="Назад"
      onPress={() => navigation.goBack()}
    />
  ) : null
  const right = options.headerRight?.({ tintColor: c.foreground, canGoBack })
  // Розділ клієнта з нижньою панеллю (прототип, lib/dock): зліва нічого —
  // назва ліворуч, більша.
  const leftTitle = options.headerTitleAlign === 'left' && !left
  // Справжня ширина вмісту зліва й справа — від неї ширина бічних місць.
  // Місце — НЕ вужче за вміст (minWidth, а не width): у тісному місці
  // пігулка «Змінити» мірялась би стиснутою — колом з половиною «З».
  const [leftW, setLeftW] = useState(0)
  const [rightW, setRightW] = useState(0)
  const slot = Math.max(SLOT, Math.ceil(leftW), Math.ceil(rightW))

  // Велика назва ліворуч ↔ маленька по центру: перемикаємо за порогом
  // прокрутки, а не пропорційно — без напівпрозорих «двох назв» разом.
  const y = headerScroll(route.key)
  const collapsed = useSharedValue(0)
  useAnimatedReaction(
    () => y.get() > COLLAPSE_AT,
    (now, prev) => {
      if (now !== prev) {
        collapsed.set(withTiming(now ? 1 : 0, { duration: 220 }))
      }
    },
  )
  const big = useAnimatedStyle(() => {
    const k = collapsed.get()
    return {
      opacity: 1 - k,
      transform: [{ translateY: -8 * k }, { scale: 1 - 0.08 * k }],
    }
  })
  const small = useAnimatedStyle(() => {
    const k = collapsed.get()
    return { opacity: k, transform: [{ translateY: 6 * (1 - k) }] }
  })
  // Екран кладе на місце шапки своє (пошук у чатах) — шапка плавно гасне.
  const away = headerAway(route.key)
  const presence = useAnimatedStyle(() => ({ opacity: 1 - away.get() }))
  const bg = typeof headerBg === 'string' ? headerBg : undefined
  const height = insets.top + HEADER_BAR

  return (
    <Animated.View style={[{ height }, presence]}>
      {options.headerBlurEffect ? (
        <Backdrop color={bg} />
      ) : options.headerShadowVisible === false ? null : (
        <HeaderFade height={height} color={bg} />
      )}
      <View style={{ paddingTop: insets.top }}>
        {inline ? (
          <View
            className="flex-row items-center gap-3 px-4"
            style={{ height: HEADER_BAR }}
          >
            {/* Маленька — по центру всієї шапки, не залазить на кнопки. */}
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: Math.max(rightW, 60) + 20,
                },
                small,
              ]}
            >
              <Text
                numberOfLines={1}
                className="text-[17px] font-semibold text-foreground"
              >
                {title}
              </Text>
            </Animated.View>
            <Animated.Text
              numberOfLines={1}
              accessibilityRole="header"
              className="flex-1 text-[30px] font-bold tracking-[-0.6px] text-foreground"
              style={[{ transformOrigin: 'left' }, big]}
            >
              {title}
            </Animated.Text>
            {/* Дзвіночок (кнопка-іконка) сам зсуває зону дотику до краю. */}
            <View
              className="flex-row items-center gap-2"
              onLayout={(e) => setRightW(e.nativeEvent.layout.width)}
            >
              {right}
            </View>
          </View>
        ) : leftTitle ? (
          <View
            className="flex-row items-center gap-3 px-4"
            style={{ height: HEADER_BAR }}
          >
            <Text
              numberOfLines={1}
              accessibilityRole="header"
              className="flex-1 pl-1 text-[22px] font-bold tracking-[-0.4px] text-foreground"
            >
              {title}
            </Text>
            <View
              className="flex-row items-center gap-2"
              onLayout={(e) => setRightW(e.nativeEvent.layout.width)}
            >
              {right}
            </View>
          </View>
        ) : (
          <View
            className="flex-row items-center px-4"
            style={{ height: HEADER_BAR }}
          >
            <View className="flex-row items-center" style={{ minWidth: slot }}>
              <View
                className="flex-row items-center"
                onLayout={(e) => setLeftW(e.nativeEvent.layout.width)}
              >
                {left}
              </View>
            </View>
            {/* Від кнопок — проміжок, щоб довга назва не липла до кола. */}
            {customTitle ? (
              <View className="flex-1 items-center px-2">{customTitle}</View>
            ) : (
              <Text
                numberOfLines={1}
                accessibilityRole="header"
                className="flex-1 px-2 text-center text-[17px] font-semibold text-foreground"
              >
                {title}
              </Text>
            )}
            <View
              className="flex-row items-center justify-end"
              style={{ minWidth: slot }}
            >
              <View
                className="flex-row items-center gap-2"
                onLayout={(e) => setRightW(e.nativeEvent.layout.width)}
              >
                {right}
              </View>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  )
}

/** Найвужче бічне місце — одна кругла кнопка. */
const SLOT = 44

/** Скільки прокрутити, щоб велика назва поступилась маленькій по центру. */
const COLLAPSE_AT = 8
