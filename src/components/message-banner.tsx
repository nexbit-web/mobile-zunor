import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { Avatar } from '@/components/ui/avatar'

// ─── Що показувати ───

interface Banner {
  /** Новий показ — новий ключ (той самий чат знову — теж). */
  key: number
  chatId: string
  name: string
  avatar: string | null
  text: string
}

let current: Banner | null = null
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/**
 * «Вам написали» — картка згори, поки застосунок відкритий (з
 * RealtimeBridge, подія `chat:update`). Нова поверх старої — замінює її.
 */
export function showMessageBanner(banner: Omit<Banner, 'key'>): void {
  current = { ...banner, key: ++seq }
  emit()
}

function clearBanner(key: number): void {
  if (current?.key !== key) return
  current = null
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ─── Картка ───

/** Скільки висить, мс. */
const SHOW_MS = 4500
const IN = { duration: 350, easing: Easing.out(Easing.cubic) }
const OUT = { duration: 260, easing: Easing.in(Easing.cubic) }

const RADIUS = 26

/**
 * Матеріал — як у системного банера iOS (скриншот власника): матове скло
 * systemMaterial без рамки. Поверх — 35% білого (у темній — 28%
 * темного): власник підбирав на око — при 20% скло було надто
 * прозорим, при 50% — надто щільним. Кольори під ним просвічують, а
 * текст читається на будь-чому. Android (expo-blur там не розмиває) —
 * майже суцільна заливка.
 */
const LOOK = {
  light: {
    tint: 'systemMaterialLight',
    veil:
      Platform.OS === 'ios'
        ? 'rgba(255, 255, 255, 0.35)'
        : 'rgba(255, 255, 255, 0.97)',
    shadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 28px rgba(0, 0, 0, 0.12)',
  },
  dark: {
    tint: 'systemMaterialDark',
    veil:
      Platform.OS === 'ios'
        ? 'rgba(30, 30, 32, 0.28)'
        : 'rgba(34, 34, 34, 0.97)',
    shadow: '0 8px 28px rgba(0, 0, 0, 0.4)',
  },
} as const

/**
 * Нове повідомлення, поки застосунок відкритий, — банер згори в подачі
 * iOS (власник: «як у Apple», не жорстка біла картка): матове скло
 * системного матеріалу без рамки, мʼяка тінь, фото відправника, імʼя
 * жирним і «зараз» праворуч, текст повідомлення — звичайним кольором, не
 * більше двох рядків (далі «…»). Виїжджає рівно (350 мс, без пружини), висить 4,5 с,
 * дотик — відкрити розмову, свайп угору — прибрати (поки палець на
 * банері, він не ховається). У самій розмові банера немає
 * (RealtimeBridge це перевіряє), системний банер push у відкритому
 * застосунку для повідомлень вимкнений (lib/push) — двох сповіщень про
 * одне не буває.
 *
 * Лежить у корені поверх усіх екранів; лише з сесією й анкетою.
 */
export function MessageBanner() {
  const banner = useSyncExternalStore(subscribe, () => current)
  const insets = useSafeAreaInsets()
  const dark = useColorScheme() === 'dark'
  const look = dark ? LOOK.dark : LOOK.light
  // Куди ховатись: вище верхнього краю з запасом на висоту картки.
  const hidden = -(insets.top + 160)
  const y = useSharedValue(hidden)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const hide = (key: number) => {
    stopTimer()
    y.set(
      withTiming(hidden, OUT, (done) => {
        if (done) scheduleOnRN(clearBanner, key)
      }),
    )
  }

  const startTimer = (key: number) => {
    stopTimer()
    timer.current = setTimeout(() => hide(key), SHOW_MS)
  }

  const key = banner?.key
  useEffect(() => {
    if (key === undefined) return
    y.set(withTiming(0, IN))
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    startTimer(key)
    return stopTimer
    // Тригер — лише новий показ; hide/startTimer свіжі на кожному рендері.
  }, [key])

  const open = (b: Banner) => {
    hide(b.key)
    router.push({ pathname: '/chat/[id]', params: { id: b.chatId } })
  }

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
  }))

  if (!banner) return null

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    // Тягнуть — не ховаємо з-під пальця.
    .onStart(() => {
      scheduleOnRN(stopTimer)
    })
    .onUpdate((e) => {
      // Угору — за пальцем, униз — ледь-ледь, як резинка без пружини.
      y.set(e.translationY < 0 ? e.translationY : e.translationY * 0.15)
    })
    .onEnd((e) => {
      if (e.translationY < -24 || e.velocityY < -400) {
        scheduleOnRN(hide, banner.key)
      } else {
        y.set(withTiming(0, IN))
        scheduleOnRN(startTimer, banner.key)
      }
    })
  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd((_e, ok) => {
      if (ok) scheduleOnRN(open, banner)
    })

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          top: insets.top + 6,
          // Поля — як у змісту екранів (px-4): банер стоїть рівно над
          // картками й кнопками шапки.
          left: 16,
          right: 16,
          zIndex: 1000,
        },
        style,
      ]}
    >
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${banner.name}: ${banner.text}`}
          accessibilityHint="Відкрити розмову"
          accessibilityLiveRegion="polite"
          style={{
            borderRadius: RADIUS,
            borderCurve: 'continuous',
            boxShadow: look.shadow,
          }}
        >
          {/* Скло — окремим шаром з обрізанням: тінь лишається зовні. */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: RADIUS,
                borderCurve: 'continuous',
                overflow: 'hidden',
              },
            ]}
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                tint={look.tint}
                intensity={100}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: look.veil }]}
            />
          </View>

          <View className="flex-row items-center gap-3 py-4 pl-3.5 pr-4">
            <Avatar uri={banner.avatar} name={banner.name} size={46} />
            <View className="flex-1">
              <View className="flex-row items-baseline gap-2">
                <Text
                  numberOfLines={1}
                  className="shrink text-[15px] font-semibold tracking-[-0.24px] text-foreground"
                >
                  {banner.name}
                </Text>
                <View className="flex-1" />
                <Text className="text-[13px] text-muted-foreground">зараз</Text>
              </View>
              <Text
                numberOfLines={2}
                className="text-[15px] leading-[20px] tracking-[-0.24px] text-foreground"
              >
                {banner.text}
              </Text>
            </View>
          </View>
        </View>
      </GestureDetector>
    </Animated.View>
  )
}
