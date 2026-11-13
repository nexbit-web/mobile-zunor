import { Image } from 'expo-image'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Glyph } from '@/components/icons/glyph'
import { SQUIRCLE } from '@/components/ui/tile'

const GAP = 8
const COLUMNS = 3

/**
 * Фото сіткою квадратів, як у «Фото» на iPhone; дотик — на весь екран із
 * гортанням убік і лічильником «2 з 5». Сітка бере ширину батька.
 */
export function PhotoGrid({ urls }: { urls: string[] }) {
  const [width, setWidth] = useState(0)
  const [open, setOpen] = useState<number | null>(null)
  if (!urls.length) return null
  const size = width ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0

  return (
    <>
      <View
        className="flex-row flex-wrap"
        style={{ gap: GAP }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {size > 0
          ? urls.map((url, i) => (
              <Pressable
                key={url}
                onPress={() => setOpen(i)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Фото ${i + 1} з ${urls.length}`}
                className="overflow-hidden rounded-[14px] bg-secondary active:opacity-80"
                style={[SQUIRCLE, { width: size, height: size }]}
              >
                <Image
                  source={url}
                  contentFit="cover"
                  transition={150}
                  style={{ width: '100%', height: '100%' }}
                />
              </Pressable>
            ))
          : null}
      </View>
      {open !== null ? (
        <PhotoViewer urls={urls} start={open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  )
}

/** Перегляд на весь екран: чорне тло, гортання вбік, закрити — хрестик. */
export function PhotoViewer({
  urls,
  start,
  onClose,
}: {
  urls: string[]
  start: number
  onClose: () => void
}) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(start)

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar style="light" />
      <View className="flex-1" style={{ backgroundColor: '#000000' }}>
        <FlatList
          data={urls}
          keyExtractor={(u) => u}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={start}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <Image
              source={item}
              contentFit="contain"
              transition={150}
              style={{ width, height }}
            />
          )}
        />
        <View
          className="absolute left-0 right-0 flex-row items-center justify-between px-3"
          style={{ top: insets.top + 6 }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Закрити"
            className="size-10 items-center justify-center rounded-full active:opacity-60"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.16)' }}
          >
            <Glyph name="close" size={17} color="#ffffff" weight="semibold" />
          </Pressable>
          {urls.length > 1 ? (
            <Text
              className="text-[15px] font-semibold text-white"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {index + 1} з {urls.length}
            </Text>
          ) : null}
          <View className="size-10" />
        </View>
      </View>
    </Modal>
  )
}
