import { View } from 'react-native'

import { Glyph } from '@/components/icons/glyph'
import { SQUIRCLE } from '@/components/ui/tile'
import { useColors } from '@/lib/theme'

// Спільне для карток заявки (JobCard) і замовлення (OrderCard): обидві
// будовані як на сайті — назва з шевроном, факти рядками з іконками
// (FactRow у job-card), унизу час і стан. Колишні шматки старої картки
// замовлення (плитка послуги, «підвал» під лінією) пішли разом із нею.

export { SQUIRCLE }

/** Шеврон iOS — дрібний і жирний, кольору «третинного» тексту. */
export function Chevron() {
  const c = useColors()
  return (
    <View style={{ opacity: 0.5 }}>
      <Glyph name="chevron" size={13} color={c.mutedForeground} weight="semibold" />
    </View>
  )
}
