import { useRef, useState } from 'react'
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type TextLayoutEvent,
  type TextProps,
} from 'react-native'

/** Точність підбору ширини, pt. */
const STEP = 2

type Probe = { width: number; lines: number; lo: number; hi: number }

/**
 * Заголовок із рівними рядками — як `text-wrap: balance` на сайті:
 * замість «Генеральне / прибирання / приватного будинку і / миття 5 вікон»
 * — «Генеральне прибирання приватного / будинку і миття 5 вікон».
 * Системного балансу рядків в iOS немає, тож підбираємо ширину самі:
 *
 * 1. справжня ширина місця (W) — з onLayout обгортки;
 * 2. невидима копія тексту з ЖОРСТКОЮ шириною W каже, скільки рядків (N)
 *    виходить на всю ширину;
 * 3. двійковим пошуком між W/N і W — найвужча ширина, на якій рядків
 *    усе ще N; видимий текст стає такої ширини.
 *
 * Міряємо лише копію з точно заданою шириною: перший onTextLayout самого
 * тексту iOS може дати з проміжної, вужчої ширини — на ньому попередня
 * версія звужувала назву до чотирьох рваних рядків. Рядків ніколи не
 * більше, ніж на всю ширину; поки рахуємо (кілька кадрів) — звичайний
 * перенос на всю ширину. Один рядок — нічого не міняємо. Новий текст чи
 * ширина — рахуємо наново. У браузері onTextLayout немає — звичайний
 * перенос.
 */
export function BalancedText(props: TextProps) {
  const text = typeof props.children === 'string' ? props.children : ''
  return <Balanced key={text} {...props} />
}

function Balanced({ style, children, ...rest }: TextProps) {
  // Обгортка — завжди на всю ширину місця. У батька з `items-center` вона
  // інакше стискалась до ширини тексту: звузили текст — звузилась і
  // вона, onLayout дав нову W, підбір починався знову — і так по колу,
  // текст «смикався» (привітання). По центру — текст у ній, не вона.
  const centered =
    StyleSheet.flatten(style)?.textAlign === 'center' ||
    (rest as { className?: string }).className?.includes('text-center')
  const [full, setFull] = useState(0)
  const [fit, setFit] = useState<number | undefined>()
  const [probe, setProbe] = useState<Probe | null>(null)
  // Ширина, відповіді для якої чекаємо: подія від старої копії — мимо.
  const awaiting = useRef<number | null>(null)

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width)
    if (w <= 0 || w === full || Platform.OS === 'web') return
    setFull(w)
    setFit(undefined)
    awaiting.current = w
    setProbe({ width: w, lines: 0, lo: 0, hi: w })
  }

  const onProbe = (width: number, e: TextLayoutEvent) => {
    if (!probe || awaiting.current !== width) return
    const lines = e.nativeEvent.lines.length
    const next = (p: Probe) => {
      awaiting.current = p.width
      setProbe(p)
    }
    const finish = (w: number | undefined) => {
      awaiting.current = null
      setProbe(null)
      setFit(w)
    }

    // Перший замір — на всю ширину: скільки рядків має лишитись.
    if (probe.lines === 0) {
      if (lines < 2) return finish(undefined)
      const lo = Math.floor(width / lines)
      next({ width: Math.floor((lo + width) / 2), lines, lo, hi: width })
      return
    }

    // Влізло в стільки ж рядків — можна ще вужче; ні — ширше.
    const lo = lines > probe.lines ? width : probe.lo
    const hi = lines > probe.lines ? probe.hi : width
    if (hi - lo <= STEP) return finish(hi >= full ? undefined : hi)
    next({ width: Math.floor((lo + hi) / 2), lines: probe.lines, lo, hi })
  }

  return (
    <View
      onLayout={onLayout}
      style={{ alignSelf: 'stretch', alignItems: centered ? 'center' : undefined }}
    >
      <Text
        {...rest}
        style={[style, fit !== undefined ? { width: fit } : null]}
      >
        {children}
      </Text>
      {probe ? (
        <Text
          key={probe.width}
          {...rest}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onTextLayout={(e) => onProbe(probe.width, e)}
          style={[
            style,
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: probe.width,
              opacity: 0,
            },
          ]}
        >
          {children}
        </Text>
      ) : null}
    </View>
  )
}
