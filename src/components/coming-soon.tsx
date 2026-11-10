import type { IconSvgElement } from '@hugeicons/react-native'
import { ScrollView } from 'react-native'

import { EmptyState } from './empty-state'

/**
 * Вкладка, екрани якої ще в роботі. Каже людині, де це є зараз, — а не
 * порожній екран, схожий на збій.
 */
export function ComingSoon({
  icon,
  title,
  text,
}: {
  icon: IconSvgElement
  title: string
  text: string
}) {
  return (
    <ScrollView
      className="bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="grow"
    >
      <EmptyState icon={icon} title={title} text={text} />
    </ScrollView>
  )
}
