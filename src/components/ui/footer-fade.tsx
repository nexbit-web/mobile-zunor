import { useId } from 'react'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { useColors } from '@/lib/theme'

/**
 * Згасання під нижньою панеллю, як у Telegram: зміст заходить під панель
 * і плавно тоне в колір фону (у темній темі — ледь темний) — без
 * смуги-підкладки й чіткого краю. Лягає на всього батька (absolute),
 * дотиків не ловить. Де: «Подати пропозицію» на заявці (на всю панель) і
 * поле розмови з Zunor (смуга над полем).
 */
export function FooterFade() {
  const c = useColors()
  // Свій id на кожне згасання: двоє на екрані не ділили б один градієнт.
  const id = `footer-fade-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <Svg
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.background} stopOpacity={0} />
          <Stop offset="0.45" stopColor={c.background} stopOpacity={0.75} />
          <Stop offset="1" stopColor={c.background} stopOpacity={0.95} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  )
}
