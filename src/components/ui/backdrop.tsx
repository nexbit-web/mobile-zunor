import { StyleSheet, View } from 'react-native'

import { useColors } from '@/lib/theme'

const FILL = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const

/**
 * Тло шапки розмови — таке саме, як у поля внизу (ChatComposer): суцільний
 * колір фону й тонка лінія-край (у шапки — знизу, у поля — згори). Так
 * попросив власник: раніше тут було напівпрозоре скло з розмиттям, і
 * шапка виглядала інакше, ніж низ.
 *
 * `color` — тло сторінки, якщо воно не звичайне.
 */
export function Backdrop({ color }: { color?: string } = {}) {
  const c = useColors()
  return (
    <View
      pointerEvents="none"
      style={[FILL, { backgroundColor: color ?? c.background }]}
    >
      <View
        className="absolute inset-x-0 bottom-0 bg-border"
        style={{ height: StyleSheet.hairlineWidth }}
      />
    </View>
  )
}
