import { View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { Glyph, type GlyphName } from '@/components/icons/glyph'

/**
 * Системні кольори iOS для плиток. Колір плитки — лише впізнаваність
 * (розділу, послуги), як у налаштуваннях iPhone і Telegram, тому він не
 * залежить ні від теми, ні від обраного акценту.
 */
export const TINT = {
  blue: '#007aff',
  gray: '#8e8e93',
  red: '#ff3b30',
  pink: '#ff2d55',
  cyan: '#32ade6',
  purple: '#af52de',
  indigo: '#5856d6',
  orange: '#ff9500',
  green: '#34c759',
  teal: '#30b0c7',
  telegram: '#2aabee',
} as const

/**
 * Скруглення «суперелипсом», як у системних карток і значків iOS: кут
 * переходить у бік плавно, а не дугою кола. Android ігнорує.
 */
export const SQUIRCLE = { borderCurve: 'continuous' } as const

/**
 * Кольорова плитка з білою суцільною іконкою, як у Telegram: легкий
 * відблиск згори вниз робить її обʼємною, а не пласкою наліпкою.
 */
export function Tile({
  icon,
  tint,
  size = 30,
}: {
  icon: GlyphName
  tint: string
  size?: number
}) {
  return (
    <View
      className="items-center justify-center overflow-hidden"
      style={[
        SQUIRCLE,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.27),
          backgroundColor: tint,
        },
      ]}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.24} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#sheen)" />
      </Svg>
      <Glyph
        name={icon}
        size={Math.round(size * 0.58)}
        color="#ffffff"
        weight="medium"
      />
    </View>
  )
}
