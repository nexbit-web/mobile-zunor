import { View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { HeaderPill } from '@/components/ui/header-pill'
import { dockBottom, DOCK_HEIGHT, DOCK_SIDE } from '@/lib/dock'

export interface DockAction {
  label: string
  onPress: () => void
  disabled?: boolean
  /** Червоний напис — видалення. */
  destructive?: boolean
}

/** Висота пігулки — як «Змінити»/«Готово» в шапці (HeaderPill, h-11). */
const PILL = 44

/**
 * Дві дії на місці нижньої панелі — окремими пігулками, такими самими,
 * як «Змінити»/«Готово» в шапці (HeaderPill), а не однією суцільною, як
 * панель (так попросив власник): ліворуч «Прочитати всі», праворуч
 * «Видалити». Стоять по краях смуги панелі, посередині її висоти. Екран
 * ховає панель (setDockHidden у lib/dock), і вони плавно міняються
 * місцями. Де панелі немає (сповіщення поверх усього в майстра) — так
 * само лежать унизу.
 */
export function DockActions({
  left,
  right,
}: {
  left: DockAction
  right: DockAction
}) {
  const insets = useSafeAreaInsets()
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: DOCK_SIDE,
        right: DOCK_SIDE,
        bottom: dockBottom(insets.bottom) + (DOCK_HEIGHT - PILL) / 2,
      }}
    >
      <View
        pointerEvents="box-none"
        className="flex-row items-center justify-between"
      >
        <Action action={left} />
        <Action action={right} />
      </View>
    </Animated.View>
  )
}

function Action({ action }: { action: DockAction }) {
  return (
    <HeaderPill
      label={action.label}
      onPress={action.onPress}
      disabled={action.disabled}
      tone={action.destructive ? 'destructive' : 'secondary'}
    />
  )
}
