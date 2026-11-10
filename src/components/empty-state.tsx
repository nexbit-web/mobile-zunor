import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native'
import { Text, View } from 'react-native'

import { useColors } from '@/lib/theme'

import { Button } from './ui/button'

/**
 * Порожній стан і стан помилки: іконка в плитці, заголовок, пояснення й
 * одна дія. Іконки — Hugeicons Stroke Rounded, як на сайті.
 */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: IconSvgElement
  title: string
  text?: string
  action?: { label: string; onPress: () => void }
}) {
  const c = useColors()
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <View className="mb-1 size-14 items-center justify-center rounded-2xl bg-secondary">
        <HugeiconsIcon icon={icon} size={26} color={c.foreground} strokeWidth={1.5} />
      </View>
      <Text className="text-center text-[17px] font-semibold text-foreground">
        {title}
      </Text>
      {text ? (
        <Text className="text-center text-[15px] leading-[21px] text-muted-foreground">
          {text}
        </Text>
      ) : null}
      {action ? (
        <Button variant="secondary" onPress={action.onPress} className="mt-2">
          {action.label}
        </Button>
      ) : null}
    </View>
  )
}
