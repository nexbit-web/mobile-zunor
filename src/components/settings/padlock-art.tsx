import LottieView from 'lottie-react-native'
import { useWindowDimensions, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import padlock from '@/assets/animations/padlock.json'

/** Полотно (scripts/animations/padlock.mjs): замок рівно посередині. */
const W = 400
const H = 320
/** Ширина на екрані: корпус замка ~75 pt — «не великий, але солідно». */
const WIDTH = 180
/** «Зменшити рух» — кадр 114 із 360: ключ у щілині. */
const STILL = 114 / 360

/**
 * Угорі «Безпеки» (власник): замок і ключ. Ключ підлітає, заходить у
 * щілину, тричі пробує провернути — дужка смикається й тримає, — ключ
 * виходить, біля дужки спалахують іскорки; і знову, по колу (6 с).
 * Прикраса — читачу екрана її не видно. Кіт-грабіжник, що стояв тут, —
 * в archive/cat-lock у корені, ключ у стилі Telegram — в archive/key.
 */
export function PadlockArt() {
  const { width: screen } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const width = Math.min(WIDTH, screen - 48)
  return (
    <View
      className="items-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LottieView
        source={padlock}
        autoPlay={!reduceMotion}
        loop
        progress={reduceMotion ? STILL : undefined}
        style={{ width, height: (width * H) / W }}
      />
    </View>
  )
}
