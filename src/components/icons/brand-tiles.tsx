import { View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'

import { SQUIRCLE } from '@/components/ui/tile'

// Плитки сторонніх сервісів — їхні справжні знаки, а не наша іконка в
// їхньому кольорі: людина впізнає Google і Telegram з першого погляду.
// Форма — та сама плитка-суперелипс, що й решта рядків налаштувань.

/**
 * Знак Google — багатобарвна «G», контури офіційного знака (кнопка
 * «Увійти з Google»). Сам по собі — для кнопки входу; у налаштуваннях —
 * на білій плитці (GoogleTile).
 */
export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  )
}

/**
 * Google — багатобарвна «G» на білій плитці, як значок застосунку Google.
 * Контури — офіційного знака (кнопка «Увійти з Google»).
 */
export function GoogleTile({ size = 30 }: { size?: number }) {
  const g = Math.round(size * 0.6)
  return (
    <View
      className="items-center justify-center bg-white"
      style={[
        SQUIRCLE,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.27),
          // На світлій картці біла плитка інакше зливається з фоном.
          boxShadow: '0 0 0 0.5px rgba(0, 0, 0, 0.12)',
        },
      ]}
    >
      <GoogleMark size={g} />
    </View>
  )
}

/**
 * Telegram — білий паперовий літачок на блакитному градієнті, як значок
 * Telegram на iPhone. Контури — офіційного знака (сітка 240).
 */
export function TelegramTile({ size = 30 }: { size?: number }) {
  return (
    <View
      className="overflow-hidden"
      style={[
        SQUIRCLE,
        { width: size, height: size, borderRadius: Math.round(size * 0.27) },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 240 240">
        <Defs>
          <LinearGradient id="tg-sky" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#2AABEE" />
            <Stop offset="1" stopColor="#229ED9" />
          </LinearGradient>
        </Defs>
        <Rect width="240" height="240" fill="url(#tg-sky)" />
        {/* Літачок трохи менший за знак у колі: плитка квадратна. */}
        <Path
          fill="#FFFFFF"
          transform="translate(14 8) scale(0.92)"
          d="M54.3 118.8c35-15.2 58.3-25.3 70-30.2 33.3-13.9 40.3-16.3 44.8-16.4 1 0 3.2.2 4.7 1.4 1.2 1 1.5 2.3 1.7 3.3s.4 3.1.2 4.7c-1.8 19-9.6 65.1-13.6 86.3-1.7 9-5 12-8.2 12.3-7 .6-12.3-4.6-19-9-10.6-6.9-16.5-11.2-26.8-18-11.9-7.8-4.2-12.1 2.6-19.1 1.8-1.8 32.5-29.8 33.1-32.3.1-.3.1-1.5-.6-2.1-.7-.6-1.7-.4-2.5-.2-1.1.2-17.9 11.4-50.6 33.5-4.8 3.3-9.1 4.9-13 4.8-4.3-.1-12.5-2.4-18.7-4.4-7.5-2.4-13.5-3.7-13-7.9.3-2.2 3.3-4.4 8.9-6.7z"
        />
      </Svg>
    </View>
  )
}
