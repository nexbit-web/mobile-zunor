import { Text, View } from 'react-native'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { SQUIRCLE } from '@/components/ui/tile'
import { useColors } from '@/lib/theme'

import { Button } from './ui/button'

/**
 * Порожній стан і стан помилки: велика плитка з системною іконкою,
 * заголовок, пояснення й одна дія.
 */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: GlyphName
  title: string
  text?: string
  action?: { label: string; onPress: () => void }
}) {
  const c = useColors()
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <View
        className="mb-2 size-[72px] items-center justify-center rounded-[22px] bg-shell"
        style={SQUIRCLE}
      >
        <Glyph name={icon} size={32} color={c.mutedForeground} />
      </View>
      <Text className="text-center text-[20px] font-bold tracking-tight text-foreground">
        {title}
      </Text>
      {text ? (
        <Text className="text-center text-[15px] leading-[21px] text-muted-foreground">
          {text}
        </Text>
      ) : null}
      {action ? (
        <Button onPress={action.onPress} className="mt-3 self-stretch">
          {action.label}
        </Button>
      ) : null}
    </View>
  )
}
