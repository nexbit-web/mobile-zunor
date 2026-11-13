import LottieView from 'lottie-react-native'
import { useMemo } from 'react'
import { useReducedMotion } from 'react-native-reanimated'

import { ZunorMark } from '@/components/zunor-mark'
import { useColors } from '@/lib/theme'

import blink from '@/assets/animations/zunor-mark-blink.json'

import { recolorMono } from './lottie-mono'

/**
 * Знак Zunor, що кліпає, — `zunor-mark-animated` (blink) із сайту.
 * Анімація — КОПІЯ web/static/animations/zunor-mark-blink.json; полотно
 * збігається зі знаком (393×411), тож розмір той самий, що в ZunorMark.
 * Колір — колір тексту: чорний у світлій темі, білий у темній.
 * «Зменшити рух» у системі — статичний знак.
 */
export function ZunorBlinkMark({
  size = 48,
  inverse = false,
}: {
  size?: number
  /** Знак кольору фону — для темного кружечка-аватара. */
  inverse?: boolean
}) {
  const c = useColors()
  const reduceMotion = useReducedMotion()
  const fg = inverse ? c.background : c.foreground
  const bg = inverse ? c.foreground : c.background
  const source = useMemo(() => recolorMono(blink, fg, bg), [fg, bg])

  if (reduceMotion) return <ZunorMark size={size} color={fg} />
  return (
    <LottieView
      source={source}
      autoPlay
      loop
      style={{ width: size, height: (size * 411) / 393 }}
    />
  )
}
