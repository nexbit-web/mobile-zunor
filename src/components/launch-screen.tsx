import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { ZunorBlinkMark } from '@/components/zunor/zunor-mark-blink'

const MARK_SIZE = 112
/** Поява знака: швидкий старт, мʼяка зупинка — «хоп», але без перельоту. */
const APPEAR_EASING = Easing.bezier(0.16, 1, 0.3, 1)
const APPEAR_MS = 520
const FADE_IN_MS = 300
/** Знак устиг постояти, перш ніж зникнути, — інакше він лише блимне. */
const HOLD_MS = 200
/** Шар іде так само, як решта шарів застосунку (~350 мс, рівно). */
const EXIT_MS = 350

/**
 * Екран запуску — поки застосунок дізнається, чи є сесія (так попросив
 * власник): фон теми й посередині лише знак Zunor, без назви. Знак —
 * кольору тексту (чорний у світлій темі, білий у темній), той, що кліпає:
 * якщо завантаження затягнеться, він «живе», а не завмирає.
 *
 * Поява — «нізвідки»: із прозорого й меншого (60%) до повного, рівним
 * timing, без пружини. Системна заставка (app.json) — лише фон тієї ж
 * теми, без знака: її ховаємо, щойно цей шар ліг, тож підміни не видно.
 * У Expo Go системна заставка — завжди іконка застосунку (так Expo Go
 * влаштований), у збірці — порожній фон.
 *
 * Готово (`ready`) і знак уже зʼявився — пауза, і шар тане, відкриваючи
 * застосунок, що вже лежить під ним; тоді `onDone` прибирає шар зовсім.
 */
export function LaunchScreen({
  ready,
  onDone,
}: {
  ready: boolean
  onDone: () => void
}) {
  const [appeared, setAppeared] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const scale = useSharedValue(0.6)
  const markOpacity = useSharedValue(0)
  const layerOpacity = useSharedValue(1)

  useEffect(() => {
    markOpacity.set(
      withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.quad) }),
    )
    scale.set(
      withTiming(1, { duration: APPEAR_MS, easing: APPEAR_EASING }, (done) => {
        if (done) scheduleOnRN(setAppeared, true)
      }),
    )
  }, [markOpacity, scale])

  useEffect(() => {
    if (!appeared || !ready || leaving) return
    setLeaving(true)
    layerOpacity.set(
      withDelay(
        HOLD_MS,
        withTiming(
          0,
          { duration: EXIT_MS, easing: Easing.inOut(Easing.quad) },
          (done) => {
            if (done) scheduleOnRN(onDone)
          },
        ),
      ),
    )
  }, [appeared, ready, leaving, layerOpacity, onDone])

  const layerStyle = useAnimatedStyle(() => ({ opacity: layerOpacity.get() }))
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.get(),
    transform: [{ scale: scale.get() }],
  }))

  return (
    <Animated.View
      // Поки знак на екрані — дотики не доходять до застосунку під ним;
      // коли шар тане — уже доходять.
      pointerEvents={leaving ? 'none' : 'auto'}
      accessible
      accessibilityLabel="Zunor завантажується"
      onLayout={() => SplashScreen.hide()}
      className="items-center justify-center bg-background"
      style={[StyleSheet.absoluteFill, layerStyle]}
    >
      <Animated.View style={markStyle}>
        <ZunorBlinkMark size={MARK_SIZE} />
      </Animated.View>
    </Animated.View>
  )
}
