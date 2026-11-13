import { Image } from 'expo-image'
import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native'

import { Glyph } from '@/components/icons/glyph'
import { PhotoViewer } from '@/components/photo-grid'
import { SQUIRCLE } from '@/components/ui/tile'
import { errorText } from '@/lib/api'
import { useColors } from '@/lib/theme'
import {
  pickPhotos,
  uploadPortfolioPhoto,
  UploadError,
  type Photo,
} from '@/lib/upload'

const GAP = 8
const COLUMNS = 3

/**
 * Приклади робіт у формі майстра: сітка квадратів, хрестик на кожному,
 * плитка «+ Додати», поки не набралось `max`. Фото одразу летить у
 * хмару (видно прев'ю з крутилкою), а в профіль потрапляє лише разом із
 * «Зберегти» форми — як на сайті (portfolio-uploader з deferRemove).
 * Дотик по фото — на весь екран.
 */
export function PortfolioEditor({
  photos,
  setPhotos,
  max,
  onBusy,
}: {
  photos: Photo[]
  setPhotos: (update: (prev: Photo[]) => Photo[]) => void
  max: number
  /** Іде завантаження — форма не має зберігатись без цих фото. */
  onBusy: (busy: boolean) => void
}) {
  const c = useColors()
  const [width, setWidth] = useState(0)
  const [pending, setPending] = useState<{ key: string; uri: string }[]>([])
  const [open, setOpen] = useState<number | null>(null)
  const seq = useRef(0)
  const size = width ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0
  const room = max - photos.length - pending.length

  async function add() {
    const assets = await pickPhotos(room).catch(() => [])
    if (!assets.length) return
    const jobs = assets.map((a) => ({ key: `p${seq.current++}`, uri: a.uri, a }))
    setPending((p) => [...p, ...jobs.map(({ key, uri }) => ({ key, uri }))])
    onBusy(true)
    let failed: unknown = null
    // По одному — у порядку вибору: так і стануть у сітці.
    for (const job of jobs) {
      try {
        const photo = await uploadPortfolioPhoto(job.a)
        setPhotos((prev) => [...prev, photo].slice(0, max))
      } catch (err) {
        failed = err
      }
      setPending((p) => p.filter((x) => x.key !== job.key))
    }
    onBusy(false)
    if (failed) {
      Alert.alert(
        'Не всі фото завантажились',
        failed instanceof UploadError ? failed.message : errorText(failed),
      )
    }
  }

  const remove = (i: number) =>
    setPhotos((prev) => prev.filter((_, idx) => idx !== i))

  return (
    <View
      className="flex-row flex-wrap p-3"
      style={{ gap: GAP }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 24)}
    >
      {size > 0 ? (
        <>
          {photos.map((p, i) => (
            <View key={p.publicId} style={{ width: size, height: size }}>
              <Pressable
                onPress={() => setOpen(i)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Фото ${i + 1} з ${photos.length}`}
                className="flex-1 overflow-hidden rounded-[14px] bg-secondary active:opacity-80"
                style={SQUIRCLE}
              >
                <Image
                  source={p.url}
                  contentFit="cover"
                  transition={150}
                  style={{ width: '100%', height: '100%' }}
                />
              </Pressable>
              <Pressable
                onPress={() => remove(i)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Прибрати фото ${i + 1}`}
                className="absolute right-1.5 top-1.5 size-6 items-center justify-center rounded-full active:opacity-70"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
              >
                <Glyph name="close" size={11} color="#ffffff" weight="bold" />
              </Pressable>
            </View>
          ))}

          {pending.map((p) => (
            <View
              key={p.key}
              className="items-center justify-center overflow-hidden rounded-[14px] bg-secondary"
              style={[SQUIRCLE, { width: size, height: size }]}
            >
              <Image
                source={p.uri}
                contentFit="cover"
                style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.5 }}
              />
              <ActivityIndicator color="#ffffff" />
            </View>
          ))}

          {room > 0 ? (
            <Pressable
              onPress={() => void add()}
              accessibilityRole="button"
              accessibilityLabel="Додати фото"
              className="items-center justify-center gap-1 rounded-[14px] bg-secondary active:opacity-70"
              style={[SQUIRCLE, { width: size, height: size }]}
            >
              <Glyph name="plus" size={22} color={c.primary} weight="semibold" />
              <Text className="text-[13px] font-medium text-primary">
                Додати
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {open !== null ? (
        <PhotoViewer
          urls={photos.map((p) => p.url)}
          start={open}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </View>
  )
}
