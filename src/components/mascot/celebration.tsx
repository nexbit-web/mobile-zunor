import * as Haptics from 'expo-haptics'
import LottieView from 'lottie-react-native'
import { useEffect, useRef } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import catChampion from '@/assets/animations/cat-champion.json'

/** Скільки свято на екрані, поки не підемо далі (анімація — 5 с). */
const HOLD_MS = 4000
const HOLD_STILL_MS = 2500

/**
 * Свято на весь екран (власник): анкету надіслано / профіль створено —
 * рудий кіт піднімає кубок зі знаком Zunor, з боків вибухає конфеті й
 * сиплеться згори (assets/animations/cat-champion.json, збирає
 * scripts/mascot/build.mjs). Під котом — `title` і `text`.
 *
 * Проявляється за 250 мс, грається один раз; через ~4 с (чи від дотику —
 * не чекати) кличе `onDone`. Сам НЕ зникає: батько тим часом відкриває
 * застосунок, і корінь замінює екран, — анкета не блимає між святом і
 * застосунком. Не вдалося — батько прибирає свято й показує помилку.
 * «Зменшити рух» — нерухомий кадр (кубок угорі, конфеті в повітрі), коротше.
 */
export function Celebration({
  title,
  text,
  onDone,
}: {
  title: string
  text: string
  onDone: () => void
}) {
  const { width: screen } = useWindowDimensions()
  const size = Math.min(screen, 440)
  const reduceMotion = useReducedMotion()
  const shown = useSharedValue(0)
  const done = useRef(false)

  function finish() {
    if (done.current) return
    done.current = true
    onDone()
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    shown.set(
      withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) }),
    )
    if (Platform.OS !== 'web')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    const timer = setTimeout(
      () => finishRef.current(),
      reduceMotion ? HOLD_STILL_MS : HOLD_MS,
    )
    return () => clearTimeout(timer)
  }, [reduceMotion, shown])

  const style = useAnimatedStyle(() => ({ opacity: shown.get() }))

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Pressable
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel={`${title} ${text}`}
        accessibilityHint="Торкніться, щоб продовжити"
        className="flex-1 items-center justify-center bg-background px-6"
      >
        <LottieView
          source={catChampion}
          autoPlay={!reduceMotion}
          loop={false}
          progress={reduceMotion ? 0.45 : undefined}
          style={{ width: size, height: size, marginTop: -size * 0.12 }}
        />
        <Animated.View
          entering={FadeIn.delay(300).duration(400)}
          className="items-center"
        >
          <Text className="text-center text-[30px] font-semibold leading-[34px] tracking-[-0.6px] text-foreground">
            {title}
          </Text>
          <Text className="mt-3 max-w-[320px] text-center text-[17px] leading-[24px] text-muted-foreground">
            {text}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}
