import LottieView from 'lottie-react-native'
import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import success from '@/assets/animations/success.json'

/** Довжина анімації (54 кадри по 30) і запас, якщо Lottie не скаже, що скінчила. */
const LENGTH_MS = 1800
const FALLBACK_MS = LENGTH_MS + 600
/** «Зменшити рух»: кадр уже останній — лише мить, щоб його побачили. */
const STILL_MS = 400

/**
 * «Успіх»: зелений кружечок виростає, з-за нього вибухає конфеті й тане,
 * малюється галочка (assets/animations/success.json, збирає
 * scripts/animations/success.mjs). Грається один раз і лишається
 * кружечок із галочкою. «Зменшити рух» — одразу останній кадр.
 *
 * `onDone` — анімація скінчилась (раз): тоді батько показує решту
 * екрана, щоб нічого не перебивало вибух. Якщо Lottie не повідомить
 * (буває на вебі), — за таймером.
 *
 * Конфеті розлітається ширше за кружечок: `size` — усе полотно, кружечок
 * у ньому — ~38 %. Прикраса — читачу екрана її не видно.
 */
export function SuccessBurst({
  size = 200,
  onDone,
}: {
  size?: number
  onDone?: () => void
}) {
  const reduceMotion = useReducedMotion()
  const done = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  function finish() {
    if (done.current) return
    done.current = true
    onDoneRef.current?.()
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    const timer = setTimeout(
      () => finishRef.current(),
      reduceMotion ? STILL_MS : FALLBACK_MS,
    )
    return () => clearTimeout(timer)
  }, [reduceMotion])

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <LottieView
        source={success}
        autoPlay={!reduceMotion}
        loop={false}
        progress={reduceMotion ? 1 : undefined}
        onAnimationFinish={(cancelled) => {
          if (!cancelled) finish()
        }}
        style={{ width: size, height: size }}
      />
    </View>
  )
}
