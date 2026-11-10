import Animated from 'react-native-reanimated'

import type { GlyphName } from '@/components/icons/glyph'
import { useLargeTitleScroll } from '@/lib/large-title'

import { EmptyState } from './empty-state'

/**
 * Вкладка, екрани якої ще в роботі. Каже людині, де це є зараз, — а не
 * порожній екран, схожий на збій. Під напівпрозорою шапкою з великим
 * заголовком (lib/large-title).
 */
export function ComingSoon({
  icon,
  title,
  text,
}: {
  icon: GlyphName
  title: string
  text: string
}) {
  const { padTop, scrollProps } = useLargeTitleScroll()
  return (
    <Animated.ScrollView
      {...scrollProps}
      className="bg-background"
      contentContainerClassName="grow"
      contentContainerStyle={{ paddingTop: padTop }}
    >
      <EmptyState icon={icon} title={title} text={text} />
    </Animated.ScrollView>
  )
}
