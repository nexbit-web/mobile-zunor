import { ActivityIndicator, Pressable, View } from 'react-native'

import { Glyph } from '@/components/icons/glyph'
import { Avatar } from '@/components/ui/avatar'
import { useColors } from '@/lib/theme'

/**
 * Аватар із камерою в куті — як шапка налаштувань у Telegram: камера
 * міняє фото, дотик до самого фото — свою дію (у налаштуваннях —
 * відкрити профіль). Поки фото вантажиться — затемнення зі спінером.
 */
export function EditableAvatar({
  uri,
  name,
  size,
  busy,
  onPress,
  onCamera,
}: {
  uri: string | null
  name: string
  size: number
  busy: boolean
  onPress: () => void
  onCamera: () => void
}) {
  const c = useColors()
  const badge = Math.round(size * 0.33)
  return (
    <View>
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        className="active:opacity-80"
      >
        <Avatar uri={uri} name={name} size={size} />
        {busy ? (
          <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : null}
      </Pressable>
      <Pressable
        onPress={onCamera}
        disabled={busy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Змінити фото"
        className="absolute -bottom-0.5 -right-0.5 items-center justify-center rounded-full border-[3px] border-background bg-primary active:opacity-80"
        style={{ width: badge, height: badge }}
      >
        <Glyph
          name="camera"
          size={Math.round(badge * 0.45)}
          color={c.primaryForeground}
          weight="medium"
        />
      </Pressable>
    </View>
  )
}
