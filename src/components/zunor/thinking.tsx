import LottieView from 'lottie-react-native'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react'
import { Text, View } from 'react-native'

import { useColors } from '@/lib/theme'

import animation from '@/assets/animations/zunor-mark-thinking.json'

import { recolorMono } from './lottie-mono'

// Анімація — КОПІЯ web/static/animations/zunor-mark-thinking.json (її
// генерує scripts/animations/zunor-mark-thinking.cjs на сайті). Полотно
// 461×489, знак 393×411 стоїть на ньому в (34, 70): зверху й з боків —
// місце під стрибок і нахил, яке виходить за межі знака, не зсуваючи
// сусідів (як у zunor-mark-animated.svelte).
const CANVAS = { w: 461, h: 489 }
const MARK = { x: 34, y: 70, w: 393, h: 411 }

const SCENES = (animation.markers ?? []).map((m) => ({
  from: m.tm,
  to: m.tm + m.dr,
}))

/**
 * Знак Zunor, що «думає»: сценки у випадковому порядку, без повтору тієї
 * самої двічі поспіль (одна петля приїдається вже на третій репліці).
 * `height` — висота самого знака.
 */
export function ZunorThinkingMark({ height = 22 }: { height?: number }) {
  const c = useColors()
  const ref = useRef<ComponentRef<typeof LottieView>>(null)
  const last = useRef(-1)
  const source = useMemo(
    () => recolorMono(animation, c.foreground, c.background),
    [c.foreground, c.background],
  )

  const scale = height / MARK.h
  const playNext = () => {
    if (!SCENES.length) return ref.current?.play()
    let i = Math.floor(Math.random() * SCENES.length)
    if (i === last.current) i = (i + 1) % SCENES.length
    last.current = i
    ref.current?.play(SCENES[i].from, SCENES[i].to)
  }

  // Перша сценка — один раз після появи (onLayout міг би спрацювати
  // кілька разів і обірвати її).
  useEffect(() => {
    const id = setTimeout(playNext, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={{ width: MARK.w * scale, height }}>
      <LottieView
        ref={ref}
        source={source}
        autoPlay={false}
        loop={false}
        onAnimationFinish={(cancelled) => {
          if (!cancelled) playNext()
        }}
        style={{
          position: 'absolute',
          left: -MARK.x * scale,
          top: -MARK.y * scale,
          width: CANVAS.w * scale,
          height: CANVAS.h * scale,
        }}
      />
    </View>
  )
}

/** Лічильник зʼявляється не одразу: на коротких ходах він лише миготить. */
const SHOW_AFTER_SEC = 3

/**
 * «Думаю…», доки модель не дала першого слова — як thinking-indicator на
 * сайті: знак, що думає, і лічильник секунд (довга пауза без нього
 * виглядає як зависання).
 */
export function Thinking() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const startedAt = Date.now()
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    )
    return () => clearInterval(timer)
  }, [])

  return (
    <View className="flex-row items-center gap-2.5 py-1" role="status">
      <ZunorThinkingMark height={20} />
      <Text className="text-[15px] text-muted-foreground">Думаю…</Text>
      {seconds >= SHOW_AFTER_SEC ? (
        <Text
          className="text-[13px] text-muted-foreground opacity-70"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {seconds} с
        </Text>
      ) : null}
    </View>
  )
}
