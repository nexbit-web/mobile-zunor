import { useColorScheme, View } from 'react-native'

import { Bone, Skeleton } from '@/components/ui/skeleton'
import { useColors, withAlpha } from '@/lib/theme'

/**
 * Пузирі-заглушки, поки розмова вперше вантажиться: чергуються вхідні
 * (ліворуч, кольору вхідної бульбашки) і свої (праворуч, блідий акцент),
 * різної ширини й висоти — як справжня переписка, притиснута донизу до
 * поля вводу. «Дихають» разом (ui/skeleton).
 */
const BUBBLES: { mine: boolean; width: `${number}%`; height: number }[] = [
  { mine: false, width: '58%', height: 40 },
  { mine: false, width: '72%', height: 58 },
  { mine: true, width: '46%', height: 40 },
  { mine: false, width: '40%', height: 40 },
  { mine: true, width: '66%', height: 58 },
  { mine: true, width: '34%', height: 40 },
  { mine: false, width: '62%', height: 40 },
]

export function MessagesSkeleton() {
  const c = useColors()
  const dark = useColorScheme() === 'dark'
  const incoming = dark ? c.secondary : '#ffffff'
  const mine = withAlpha(c.primary, dark ? 0.35 : 0.28)
  return (
    <Skeleton className="flex-1 justify-end gap-1.5 px-1 pb-2">
      {BUBBLES.map((b, i) => (
        <View
          key={i}
          className={b.mine ? 'items-end' : 'items-start'}
          style={i > 0 && BUBBLES[i - 1].mine !== b.mine ? { marginTop: 8 } : null}
        >
          <Bone
            width={b.width}
            height={b.height}
            radius={18}
            color={b.mine ? mine : incoming}
          />
        </View>
      ))}
    </Skeleton>
  )
}

/** Шапка розмови, поки чат вантажиться: імʼя й «у мережі» брусками. */
export function ChatTitleSkeleton() {
  return (
    <Skeleton className="items-center gap-1.5">
      <Bone width={120} height={14} />
      <Bone width={64} height={10} />
    </Skeleton>
  )
}

/** Фото співрозмовника праворуч у шапці, поки чат вантажиться. */
export function AvatarSkeleton({ size = 36 }: { size?: number }) {
  return (
    <Skeleton>
      <Bone width={size} height={size} radius={size / 2} />
    </Skeleton>
  )
}
