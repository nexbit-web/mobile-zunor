import { BlurView } from 'expo-blur'
import { Platform, useColorScheme, View } from 'react-native'

import { useColors, withAlpha } from '@/lib/theme'

const FILL = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const

/**
 * Напівпрозорий фон шапки й смуг під нею, як «матеріал» iOS: розмиття плюс
 * колір фону застосунку на ~70% — зміст, що заходить під шапку, ледь
 * проглядає. На Android розмиття без окремого налаштування немає — там
 * лише колір, щільніший, щоб текст під шапкою не заважав читати.
 */
export function Backdrop() {
  const c = useColors()
  const dark = useColorScheme() === 'dark'
  const android = Platform.OS === 'android'
  return (
    <View pointerEvents="none" style={FILL}>
      {android ? null : (
        <BlurView
          tint={dark ? 'dark' : 'light'}
          intensity={Platform.OS === 'ios' ? 40 : 24}
          style={FILL}
        />
      )}
      <View
        style={[
          FILL,
          { backgroundColor: withAlpha(c.background, android ? 0.92 : 0.72) },
        ]}
      />
    </View>
  )
}
