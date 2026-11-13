import { useColorScheme, useWindowDimensions, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { useColors } from '@/lib/theme'

/** Кут смуги, як `linear-gradient(100deg, …)` на сайті. */
const ANGLE = (100 * Math.PI) / 180

/**
 * Кольори за темою.
 *
 * Світла — як над входом на сайті (web/…/components/pastel-glow.svelte):
 * персиковий, рожевий, бузковий, блакитний, 90%, на 30% висоти.
 *
 * Темна — своя, за скриншотом ClickUp від власника: ті самі відтінки, але
 * глибокі й насичені — малиновий, сливовий, фіолетовий, синій, — і смуга
 * вища (40%). Сайтова пастель тут була на 14% і майже не читалась, а
 * на повну — світла пляма на графіті.
 */
const PALETTE = {
  light: {
    stops: ['#fde3d3', '#f7d0e8', '#e4dafb', '#d3e6fd'],
    offsets: [0, 0.28, 0.58, 1],
    opacity: 0.9,
    share: 0.3,
  },
  dark: {
    stops: ['#8c2747', '#6a2770', '#47348f', '#2b4ea3'],
    offsets: [0, 0.32, 0.62, 1],
    opacity: 0.9,
    share: 0.4,
  },
} as const

/**
 * Кольорова смуга вгорі екранів без акаунта (привітання, вхід): під
 * кутом 100°, донизу розчиняється у фон — межі ніде не видно.
 *
 * Лежить під змістом (`absolute`, без дотиків): батько малює фон, зміст
 * іде поверх. Змінились кольори світлої на сайті — зміни й тут.
 */
export function PastelGlow({ short = false }: { short?: boolean }) {
  const c = useColors()
  const p = PALETTE[useColorScheme() === 'dark' ? 'dark' : 'light']
  const { width, height: screen } = useWindowDimensions()
  // `short` — сторінка входу: як у ClickUp, смуга лише вгорі (~20%), не
  // заходить глибоко під заголовок і поля.
  const height = short
    ? Math.max(140, Math.round(screen * 0.2))
    : Math.max(192, Math.round(screen * p.share))

  // CSS-кут: лінія градієнта йде через центр, довжиною на всю «тінь»
  // прямокутника в її напрямку — тоді крайні кольори стоять у кутах.
  const dx = Math.sin(ANGLE)
  const dy = -Math.cos(ANGLE)
  const half = (width * Math.abs(dx) + height * Math.abs(dy)) / 2
  const cx = width / 2
  const cy = height / 2

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height,
        opacity: p.opacity,
      }}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient
            id="pastel"
            gradientUnits="userSpaceOnUse"
            x1={cx - dx * half}
            y1={cy - dy * half}
            x2={cx + dx * half}
            y2={cy + dy * half}
          >
            {p.stops.map((color, i) => (
              <Stop key={color} offset={p.offsets[i]} stopColor={color} />
            ))}
          </LinearGradient>
          {/* Маска сайту (`to bottom, #000 → transparent`): на суцільному
              фоні те саме дає шар кольору фону, що густішає донизу.
              Проміжна точка — мʼякший хвіст: у темній лінійне згасання
              давало помітну межу на глибоких кольорах. */}
          <LinearGradient id="pastel-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.background} stopOpacity={0} />
            <Stop offset="0.55" stopColor={c.background} stopOpacity={0.6} />
            <Stop offset="1" stopColor={c.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#pastel)" />
        <Rect width={width} height={height} fill="url(#pastel-fade)" />
      </Svg>
    </View>
  )
}
