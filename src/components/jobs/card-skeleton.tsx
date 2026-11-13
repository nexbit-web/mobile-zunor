import { useEffect } from 'react'
import { View, type DimensionValue } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { Bone } from '@/components/ui/skeleton'

import { SQUIRCLE } from './card-parts'
import { JOB_CARD } from './job-card'

/**
 * Скелетон списку карток, поки вони вперше вантажаться: та сама будова,
 * що в справжньої картки, тож коли дані приходять, нічого не стрибає —
 * сірі бруски просто стають текстом. Усі картки «дихають» разом, одним
 * значенням; із «Зменшити рух» — без руху.
 *
 * `variant` — job: як JobCard (назва, факти рядками, опис, час); order:
 * як OrderCard — та сама мова, без опису, з рядком людини.
 */
export function CardSkeletonList({
  variant = 'job',
  count = 3,
}: {
  variant?: 'job' | 'order'
  count?: number
}) {
  const reduceMotion = useReducedMotion()
  const pulse = useSharedValue(1)

  useEffect(() => {
    if (reduceMotion) return
    pulse.set(
      withRepeat(
        withTiming(0.45, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    )
    return () => cancelAnimation(pulse)
  }, [reduceMotion, pulse])

  return (
    <View
      className="gap-3"
      accessibilityLabel="Завантаження"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} variant={variant} pulse={pulse} index={i} />
      ))}
    </View>
  )
}

function SkeletonCard({
  variant,
  pulse,
  index,
}: {
  variant: 'job' | 'order'
  pulse: SharedValue<number>
  index: number
}) {
  const style = useAnimatedStyle(() => ({ opacity: pulse.get() }))
  // Трохи різні довжини — щоб список не виглядав штампом.
  const title: DimensionValue = (['78%', '62%', '70%'] as const)[index % 3]

  if (variant === 'job') {
    return (
      <View className={JOB_CARD} style={SQUIRCLE}>
        <Animated.View style={style} className="px-5 py-[18px]">
          <Bone width={title} height={19} />
          <View className="mt-3.5 gap-3">
            {(['34%', '46%', '58%'] as const).map((w) => (
              <View key={w} className="flex-row items-center gap-2.5">
                <Bone width={18} height={18} radius={5} />
                <Bone width={w} height={12} />
              </View>
            ))}
          </View>
          <View className="mt-4 gap-2">
            <Bone width="94%" height={12} />
            <Bone width="56%" height={12} />
          </View>
          <View className="mt-4 flex-row items-center justify-between">
            <Bone width={62} height={11} />
            <Bone width={112} height={24} radius={12} />
          </View>
        </Animated.View>
      </View>
    )
  }

  // Замовлення — як OrderCard: назва, факти (ціна, послуга, людина з
  // фото, характеристики), унизу час і стан. Опису немає.
  return (
    <View className={JOB_CARD} style={SQUIRCLE}>
      <Animated.View style={style} className="px-5 py-[18px]">
        <Bone width={title} height={19} />
        <View className="mt-3.5 gap-3">
          {(['28%', '46%', '40%', '58%'] as const).map((w, i) => (
            <View key={w} className="flex-row items-center gap-2.5">
              <Bone width={18} height={18} radius={i === 2 ? 9 : 5} />
              <Bone width={w} height={12} />
            </View>
          ))}
        </View>
        <View className="mt-4 flex-row items-center justify-between">
          <Bone width={62} height={11} />
          <Bone width={96} height={24} radius={12} />
        </View>
      </Animated.View>
    </View>
  )
}
