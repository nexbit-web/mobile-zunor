import * as Haptics from 'expo-haptics'
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols'
import { useEffect, useId, useState } from 'react'
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { useUnreadChats } from '@/components/chat/use-chats'
import { useUnreadCount } from '@/components/header-bell'
import { Glyph } from '@/components/icons/glyph'
import { GlowSurface } from '@/components/ui/glow-button'
import {
  dockBottom,
  DOCK_HEIGHT as H,
  DOCK_SIDE as SIDE,
  rememberSection,
  useDockHidden,
} from '@/lib/dock'
import { useColors, withAlpha } from '@/lib/theme'

/** Від краю пігулки до підсвітки активної вкладки. */
const PAD = 4
/** Між пігулкою й «+». */
const GAP = 10

const SEG_H = H - PAD * 2

/**
 * Поверхня пігулки — за скриншотом власника: графітова, ледь світліша
 * вгорі, з тонкою «скляною» гранню — світлий відблиск угорі зліва й
 * унизу справа, як у скла iOS 26. У світлій темі — та сама будова,
 * біла.
 */
const LOOK = {
  dark: {
    fill: ['#303033', '#242426'],
    /** Грань: відблиск угорі зліва → майже немає → відблиск унизу справа. */
    rim: [0.34, 0.06, 0.2],
    rimColor: '#ffffff',
    /** Тонкий зовнішній контур — край на темному тлі. */
    outline: 'rgba(0,0,0,0.5)',
    /** «Тінь» вибору за пальцем, поки його тягнуть: сіра, напівпрозора. */
    ghost: 'rgba(255,255,255,0.16)',
    /**
     * Активна вкладка — світла нейтральна капсула (не primary — так
     * попросив власник; акцент лише іконка). На сірій капсулі темно-синя
     * іконка губилась і виглядала похмуро, на світлій — чітка.
     */
    selected: '#e8eaee',
    shadow: '0 10px 30px rgba(0,0,0,0.5)',
    idle: 0.8,
  },
  light: {
    fill: ['#ffffff', '#f2f2f4'],
    rim: [1, 0.5, 0.9],
    rimColor: '#ffffff',
    outline: 'rgba(0,0,0,0.08)',
    ghost: 'rgba(0,0,0,0.08)',
    selected: '#e6e9ef',
    shadow: '0 1px 3px rgba(0,0,0,0.08), 0 10px 30px rgba(0,0,0,0.12)',
    idle: 0.72,
  },
} as const

/** Вкладка панелі — маршрут (app), підпис для читалки й іконки. */
export interface DockTab {
  route: string
  label: string
  ios: SFSymbol
  iosOn: SFSymbol
  android: AndroidSymbol
}

const ORDERS: DockTab = {
  route: 'orders',
  label: 'Замовлення',
  ios: 'checkmark.seal',
  iosOn: 'checkmark.seal.fill',
  android: 'handshake',
}
const MESSAGES: DockTab = {
  route: 'messages',
  label: 'Чати',
  ios: 'bubble.left.and.bubble.right',
  iosOn: 'bubble.left.and.bubble.right.fill',
  android: 'chat',
}
const PROFILE: DockTab = {
  route: 'profile',
  label: 'Профіль',
  ios: 'person.crop.circle',
  iosOn: 'person.crop.circle.fill',
  android: 'account_circle',
}

/** Клієнт: розділи; розмова з Zunor — «+» поруч. */
export const CLIENT_TABS: DockTab[] = [
  ORDERS,
  MESSAGES,
  {
    route: 'alerts',
    label: 'Сповіщення',
    ios: 'bell',
    iosOn: 'bell.fill',
    android: 'notifications',
  },
  PROFILE,
]

/**
 * Майстер: ті самі вкладки, що були системними (стрічка заявок перша);
 * сповіщення в нього — дзвіночком у шапці, «+» немає.
 */
export const MASTER_TABS: DockTab[] = [
  {
    route: '(home)',
    label: 'Стрічка',
    ios: 'list.bullet.rectangle',
    iosOn: 'list.bullet.rectangle.fill',
    android: 'list_alt',
  },
  ORDERS,
  MESSAGES,
  PROFILE,
]

/**
 * ПРОТОТИП (lib/dock). Нижня панель на розділах (app/(app)/_layout):
 * у клієнта (ClientDockShell; на головній — розмові з Zunor — її немає)
 * і в майстра (MasterDockShell — та сама, лише без «+»; так попросив
 * власник):
 * - пігулка — графітова «скляна» поверхня (LOOK, за скриншотом
 *   власника); активна вкладка — світла нейтральна капсула й іконка
 *   primary (акцент — лише іконка); капсула плавно їде за вибором
 *   (350 мс, без пружини).
 *   Кольорове сяйво під іконкою було — власник попросив прибрати;
 * - вибір можна перетягнути (так попросив власник): підсвітка стоїть,
 *   за пальцем іде така сама капсула-«тінь», іконки не
 *   міняються, вібрації під час руху немає; відпустили — відкривається
 *   вкладка під тінню, і тоді підсвітка їде туди;
 * - «+» (`onCompose`, лише клієнт) — «світне» коло акценту, як «Нова
 *   розмова» в бічній панелі: нова розмова з Zunor на головній. Без
 *   нього пігулка — на всю ширину.
 *
 * Лежить поверх сторінки — списки заходять під неї, а кінець списку стоїть
 * над нею (DockSpace → useContentBottom). Поки відкрита клавіатура —
 * ховається. Екрани вглиб (замовлення, розмова, параметри) — у корені,
 * поверх усього, тож панелі там немає.
 */
export function BottomDock({
  tabs,
  current,
  onPick,
  onCompose,
}: {
  /** Вкладки — CLIENT_TABS чи MASTER_TABS. */
  tabs: DockTab[]
  /** Відкритий розділ — маршрут (app): `orders`, `messages`… */
  current: string | undefined
  /** Відкрити інший розділ. */
  onPick: (route: string) => void
  /** «+» — нова розмова з Zunor (клієнт). Без нього «+» немає. */
  onCompose?: () => void
}) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const c = useColors()
  const dark = useColorScheme() === 'dark'
  const look = dark ? LOOK.dark : LOOK.light
  const reduceMotion = useReducedMotion()
  const unreadChats = useUnreadChats()
  const unreadAlerts = useUnreadCount()
  const keyboard = useKeyboardShown()
  // Екран поставив на її місце свою смугу дій (lib/dock).
  const hidden = useDockHidden()

  // «✕» у розмові веде туди, де людина була востаннє.
  useEffect(() => {
    if (current) rememberSection(current)
  }, [current])

  const pill = width - SIDE * 2 - (onCompose ? GAP + H : 0)
  const seg = (pill - PAD * 2) / tabs.length

  const active = tabs.findIndex((t) => t.route === current)
  const last = tabs.length - 1

  const x = useSharedValue(Math.max(active, 0) * seg)
  /** «Тінь» вибору — капсула, що йде за пальцем, поки тягнуть. */
  const gx = useSharedValue(0)
  const ghost = useSharedValue(0)

  useEffect(() => {
    // Перейшли (дотиком, жестом чи ззовні) — підсвітка їде на нову вкладку.
    if (active < 0) return
    x.set(
      reduceMotion
        ? active * seg
        : withTiming(active * seg, {
            duration: 350,
            easing: Easing.out(Easing.cubic),
          }),
    )
  }, [active, seg, reduceMotion, x])

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
  }))
  const shadow = useAnimatedStyle(() => ({
    opacity: ghost.get(),
    transform: [{ translateX: gx.get() }],
  }))

  /** Перейти на вкладку (з легким «клацанням»), якщо вона інша. */
  function go(route: string) {
    if (route === current) return
    if (Platform.OS !== 'web') void Haptics.selectionAsync()
    onPick(route)
  }

  function tapAt(px: number) {
    go(tabs[Math.min(last, Math.max(0, Math.floor((px - PAD) / seg)))].route)
  }

  function release(i: number) {
    go(tabs[i].route)
  }

  // Вибір можна перетягнути: підсвітка лишається на місці, а за пальцем
  // іде її «тінь» — така сама напівпрозора капсула.
  // Іконки під час руху не міняються й вібрації немає. Відпустили — тінь
  // гасне, вкладка під нею відкривається, і лише тоді підсвітка їде туди.
  const max = last * seg
  const fade = { duration: 180, easing: Easing.out(Easing.cubic) }
  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .onStart((e) => {
      gx.set(Math.min(max, Math.max(0, e.x - PAD - seg / 2)))
      ghost.set(reduceMotion ? 1 : withTiming(1, fade))
    })
    .onUpdate((e) => {
      gx.set(Math.min(max, Math.max(0, e.x - PAD - seg / 2)))
    })
    .onEnd(() => {
      const i = Math.min(last, Math.max(0, Math.round(gx.get() / seg)))
      scheduleOnRN(release, i)
    })
    .onFinalize(() => {
      ghost.set(reduceMotion ? 0 : withTiming(0, fade))
    })
  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd((e, ok) => {
      if (ok) scheduleOnRN(tapAt, e.x)
    })

  if (keyboard || hidden) return null

  return (
    // Зʼявляється й гасне плавно: коли виїжджає розмова (там панелі
    // немає), коли відкривається клавіатура і коли на її місце стає
    // смуга дій екрана (режим вибору в сповіщеннях).
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: SIDE,
        right: SIDE,
        bottom: dockBottom(insets.bottom),
        flexDirection: 'row',
        alignItems: 'center',
        gap: GAP,
      }}
    >
      {/* Пігулка вкладок — «скляна» графітова поверхня. */}
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View
          style={{
            width: pill,
            height: H,
            borderRadius: H / 2,
            borderCurve: 'continuous',
            boxShadow: look.shadow,
          }}
        >
          <DockSurface width={pill} height={H} dark={dark} />

          {/* Підсвітка активної вкладки — світла нейтральна капсула, їде
            під іконками. */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: PAD,
                left: PAD,
                width: seg,
                height: SEG_H,
                borderRadius: SEG_H / 2,
                borderCurve: 'continuous',
                opacity: active < 0 ? 0 : 1,
                backgroundColor: look.selected,
              },
              indicator,
            ]}
          />

          {/* «Тінь» вибору — за пальцем, поки тягнуть. */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: PAD,
                left: PAD,
                width: seg,
                height: SEG_H,
                borderRadius: SEG_H / 2,
                borderCurve: 'continuous',
                backgroundColor: look.ghost,
              },
              shadow,
            ]}
          />

          <View
            style={{ flexDirection: 'row', padding: PAD }}
            accessibilityRole="tablist"
          >
            {tabs.map((t, i) => {
              const on = i === active
              const badge =
                t.route === 'messages'
                  ? unreadChats
                  : t.route === 'alerts'
                    ? unreadAlerts
                    : 0
              return (
                <View
                  key={t.route}
                  accessible
                  onAccessibilityTap={() => go(t.route)}
                  accessibilityRole="tab"
                  accessibilityLabel={
                    badge > 0 ? `${t.label}, непрочитаних: ${badge}` : t.label
                  }
                  accessibilityState={{ selected: on }}
                  style={{
                    width: seg,
                    height: SEG_H,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View>
                    <SymbolView
                      name={{
                        ios: on ? t.iosOn : t.ios,
                        android: t.android,
                        web: t.android,
                      }}
                      size={26}
                      // Неактивні — світло-сірі, як на скриншоті; активна —
                      // кольору акценту (primary).
                      tintColor={
                        on ? c.primary : withAlpha(c.foreground, look.idle)
                      }
                      weight={on ? 'semibold' : 'medium'}
                      type="monochrome"
                      resizeMode="scaleAspectFit"
                    />
                    {badge > 0 ? (
                      // Обідок кольору пігулки «вирізає» значок, як у iOS.
                      <View
                        className="absolute -right-2.5 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full border-2 bg-destructive px-1"
                        style={{ borderColor: look.fill[0] }}
                      >
                        <Text
                          className="text-[11px] font-bold leading-[13px] text-white"
                          style={{ fontVariant: ['tabular-nums'] }}
                        >
                          {badge > 99 ? '99+' : badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      </GestureDetector>

      {/* «+» — як «Нова розмова» в бічній панелі (лише клієнт). */}
      {onCompose ? (
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }
            onCompose()
          }}
          accessibilityRole="button"
          accessibilityLabel="Нова розмова з Zunor"
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <GlowSurface
            radius={H / 2}
            strength="sm"
            style={{ width: H, height: H }}
            className="items-center justify-center"
          >
            <Glyph
              name="plus"
              size={24}
              color={c.primaryForeground}
              weight="semibold"
            />
          </GlowSurface>
        </Pressable>
      ) : null}
    </Animated.View>
  )
}

/** Чи відкрита клавіатура — тоді панель ховається. */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    // iOS — до появи (клавіатура наїжджає поверх), Android — після.
    const ios = Platform.OS === 'ios'
    const show = Keyboard.addListener(
      ios ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setShown(true),
    )
    const hide = Keyboard.addListener(
      ios ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setShown(false),
    )
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return shown
}

/**
 * «Скляна» поверхня пігулки: заливка ледь світліша вгорі, грань-відблиск
 * (яскравіша вгорі зліва й унизу справа) і тонкий зовнішній контур.
 */
export function DockSurface({
  width,
  height,
  dark,
}: {
  width: number
  height: number
  dark: boolean
}) {
  const look = dark ? LOOK.dark : LOOK.light
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const r = height / 2
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`fill${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={look.fill[0]} />
          <Stop offset="1" stopColor={look.fill[1]} />
        </LinearGradient>
        <LinearGradient id={`rim${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop
            offset="0"
            stopColor={look.rimColor}
            stopOpacity={look.rim[0]}
          />
          <Stop
            offset="0.5"
            stopColor={look.rimColor}
            stopOpacity={look.rim[1]}
          />
          <Stop
            offset="1"
            stopColor={look.rimColor}
            stopOpacity={look.rim[2]}
          />
        </LinearGradient>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={r}
        fill={`url(#fill${id})`}
      />
      {/* Зовнішній контур — край не зливається з тлом. */}
      <Rect
        x={0.25}
        y={0.25}
        width={width - 0.5}
        height={height - 0.5}
        rx={r - 0.25}
        fill="none"
        stroke={look.outline}
        strokeWidth={0.5}
      />
      {/* Грань-відблиск — усередині контуру. */}
      <Rect
        x={1.25}
        y={1.25}
        width={width - 2.5}
        height={height - 2.5}
        rx={r - 1.25}
        fill="none"
        stroke={`url(#rim${id})`}
        strokeWidth={1.2}
      />
    </Svg>
  )
}
