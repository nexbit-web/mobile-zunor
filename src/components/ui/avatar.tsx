import { Image } from 'expo-image'
import { Text, View } from 'react-native'

/** Перші літери двох слів імені: «Олена Коваленко» → «ОК». */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase())
  return letters.join('') || '?'
}

/** Фото людини або, поки його немає, ініціали на колі кольору акценту. */
export function Avatar({
  uri,
  name,
  size,
}: {
  uri?: string | null
  name: string
  size: number
}) {
  if (uri) {
    return (
      <Image
        source={uri}
        contentFit="cover"
        transition={150}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    )
  }
  return (
    <View
      className="items-center justify-center rounded-full bg-primary"
      style={{ width: size, height: size }}
    >
      <Text
        className="font-semibold text-primary-foreground"
        style={{ fontSize: Math.round(size * 0.38) }}
      >
        {initials(name)}
      </Text>
    </View>
  )
}
