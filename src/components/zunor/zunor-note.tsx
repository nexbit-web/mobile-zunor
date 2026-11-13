import { useEffect, useState } from 'react'
import { Text, useColorScheme, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { SQUIRCLE } from '@/components/ui/tile'
import { useColors } from '@/lib/theme'

import { ZunorBlinkMark } from './zunor-mark-blink'

/**
 * Повідомлення від Zunor поза чатом (сторінка заявки): знак, що кліпає,
 * ім’я й бульбашка, у якій текст ДРУКУЄТЬСЯ — спершу «…» (Zunor пише),
 * далі по літерах із живою швидкістю, як assistant-card на сайті. Друкує
 * один раз на відкриття екрана; «Зменшити рух» — текст одразу.
 *
 * Говорить від першої особи («я сповіщу»), як у розмові з Zunor, — так
 * попросив власник; на сайті картка асистента поки в третій особі.
 */
export function ZunorNote({
  text,
  bare = false,
}: {
  text: string
  /** Усередині іншої картки (документ заявки) — без власного тла. */
  bare?: boolean
}) {
  const c = useColors()
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState(reduceMotion ? text.length : 0)
  const [typing, setTyping] = useState(!reduceMotion)

  useEffect(() => {
    if (reduceMotion) return
    let i = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      i += 1
      setShown(i)
      if (i < text.length) timer = setTimeout(tick, 18 + Math.random() * 30)
    }
    // Коротка пауза «Zunor пише…», потім друк.
    const start = setTimeout(() => {
      setTyping(false)
      tick()
    }, 800)
    return () => {
      clearTimeout(start)
      clearTimeout(timer)
    }
  }, [text, reduceMotion])

  const done = shown >= text.length
  const online = useColorScheme() === 'dark' ? '#30d158' : '#248a3d'

  return (
    <View
      className={`flex-row items-start gap-3 ${
        bare ? '' : 'rounded-[24px] bg-card p-4'
      }`}
      style={bare ? undefined : SQUIRCLE}
    >
      {/* Аватар: знак Zunor на кружечку й зелена «онлайн»-крапка. */}
      <View className="size-11">
        {/* Темний кружечок зі світлим знаком — як аватар у чаті. */}
        <View className="size-11 items-center justify-center rounded-full bg-foreground">
          <ZunorBlinkMark size={24} inverse />
        </View>
        <View
          className="absolute -bottom-px -right-px size-3.5 rounded-full border-[2.5px]"
          // Обідок — кольору картки: на ній ZunorNote і лежить (сторінка
          // заявки теж має тло кольору картки).
          style={{ backgroundColor: '#34c759', borderColor: c.card }}
        />
      </View>

      <View className="flex-1 gap-1.5">
        <View className="flex-row items-baseline gap-1.5">
          <Text className="text-[15.5px] font-semibold text-foreground">
            Zunor
          </Text>
          <Text
            className="text-[13px] font-medium"
            style={{ color: typing ? c.mutedForeground : online }}
          >
            {typing ? 'пише…' : 'онлайн'}
          </Text>
        </View>
        <View
          className="self-start rounded-[18px] rounded-tl-[6px] bg-secondary px-3.5 py-2.5"
          style={SQUIRCLE}
          accessibilityLabel={text}
        >
          {typing ? (
            <TypingDots />
          ) : (
            <Text className="text-[15.5px] leading-[22px] text-foreground">
              {text.slice(0, shown)}
              {!done ? (
                <Text style={{ color: c.mutedForeground }}>▍</Text>
              ) : null}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}

/** «…» — Zunor пише: три крапки, що по черзі підстрибують. */
function TypingDots() {
  return (
    <View className="h-[22px] flex-row items-center gap-1">
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  )
}

function Dot({ delay }: { delay: number }) {
  const c = useColors()
  const y = useSharedValue(0)
  useEffect(() => {
    y.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-3, { duration: 280 }),
            withTiming(0, { duration: 280 }),
            withTiming(0, { duration: 340 }),
          ),
          -1,
        ),
      ),
    )
  }, [delay, y])
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
  }))
  return (
    <Animated.View
      className="size-[7px] rounded-full"
      style={[{ backgroundColor: c.mutedForeground }, style]}
    />
  )
}
