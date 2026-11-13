import { Image } from 'expo-image'
import {
  useEffect,
  useState,
  type ComponentRef,
  type RefObject,
} from 'react'
import {
  ActivityIndicator,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { Glyph } from '@/components/icons/glyph'
import { Icon } from '@/components/icons/icon'
import { YieldToDrawer } from '@/components/ui/yield-to-drawer'
import { useRowSwipeGuard } from '@/lib/drawer-swipe'
import { useColors } from '@/lib/theme'
import type { Photo } from '@/lib/upload'

/** Поле — 16/22, як на сайті; відступ тексту від країв капсули — 6 px. */
const FONT = { fontSize: 16, lineHeight: 22 }
const TEXT_PAD = 6

/**
 * Поле вводу — як на сайті (jobs/new, `.job-input-shell`): вузька капсула
 * «+ · текст · кнопка». Розкривається в картку (текст на всю ширину, «+»
 * і кнопка рядком нижче) лише тоді, коли текст перестав влазити в рядок
 * або додано фото, — не від самого фокусу. Кнопка надсилання стоїть
 * завжди: поки надсилати нічого, вона сіра й неактивна, а з першою
 * літерою плавно «загоряється». Поки Zunor відповідає — на її місці «Стоп».
 * (Голосового вводу поки немає: у Expo Go модуля розпізнавання мови нема.)
 */
export function Composer({
  inputRef,
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  canSend,
  placeholder,
  photos,
  uploading,
  onAddPhoto,
  onRemovePhoto,
}: {
  inputRef?: RefObject<ComponentRef<typeof TextInput> | null>
  value: string
  onChange: (text: string) => void
  onSend: () => void
  onStop: () => void
  streaming: boolean
  canSend: boolean
  placeholder: string
  /** Фото, що підуть із наступною реплікою. */
  photos: Photo[]
  /** Скільки фото ще вантажиться. */
  uploading: number
  onAddPhoto: () => void
  onRemovePhoto: (index: number) => void
}) {
  const c = useColors()
  // Ширина поля в капсулі — по ній невидимий двійник тексту рахує рядки.
  // Береться лише в згорнутому вигляді: розкрите поле ширше, і за ним текст
  // знову влазив би в рядок — поле смикалось би туди-сюди.
  const [lineWidth, setLineWidth] = useState(0)
  const [lines, setLines] = useState(1)

  const hasPhotos = photos.length > 0 || uploading > 0
  // Прогорнута стрічка фото — свайп управо гортає її, а бічна панель —
  // лише від краю (lib/drawer-swipe).
  const photosGuard = useRowSwipeGuard(hasPhotos)
  const expanded = hasPhotos || lines > 1 || value.includes('\n')

  const animate = () =>
    LayoutAnimation.configureNext(
      LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'),
    )

  const plus = (
    <Pressable
      onPress={onAddPhoto}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Додати фото"
      className="size-9 items-center justify-center rounded-full active:bg-secondary"
    >
      <Glyph name="plus" size={19} color={c.foreground} weight="medium" />
    </Pressable>
  )

  const action = (
    <ActionButton
      streaming={streaming}
      canSend={canSend}
      onSend={onSend}
      onStop={onStop}
    />
  )

  return (
    <View
      className={`bg-shell ${
        expanded ? 'rounded-[22px] px-2.5 pb-2 pt-2.5' : 'rounded-[26px] p-1.5'
      }`}
    >
      {/* Невидимий двійник тексту: лише рахує, скільки рядків займе текст у
          капсулі. Шрифт мусить збігатися з полем. */}
      {lineWidth > 0 ? (
        <Text
          pointerEvents="none"
          accessible={false}
          onTextLayout={(e) => {
            const n = e.nativeEvent.lines.length
            if (n !== lines) {
              animate()
              setLines(n)
            }
          }}
          style={[
            FONT,
            { position: 'absolute', opacity: 0, width: lineWidth, left: 0 },
          ]}
        >
          {value || ' '}
        </Text>
      ) : null}

      {hasPhotos ? (
        <YieldToDrawer>
          <ScrollView
            horizontal
            {...photosGuard}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-2 px-0.5 pb-2 pt-1.5"
          >
            {photos.map((p, i) => (
              <View key={p.publicId} className="size-16">
                <Image
                  source={p.url}
                  contentFit="cover"
                  style={{ width: 64, height: 64, borderRadius: 12 }}
                />
                <Pressable
                  onPress={() => onRemovePhoto(i)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Прибрати фото"
                  className="absolute -right-1.5 -top-1.5 size-6 items-center justify-center rounded-full bg-foreground"
                >
                  <Icon name="x" size={13} color={c.background} strokeWidth={2.2} />
                </Pressable>
              </View>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <View
                key={`up-${i}`}
                className="size-16 items-center justify-center rounded-[12px] bg-secondary"
              >
                <ActivityIndicator size="small" color={c.mutedForeground} />
              </View>
            ))}
          </ScrollView>
        </YieldToDrawer>
      ) : null}

      {/* Поле лишається тим самим вузлом в обох виглядах (сусіди —
          умовні слоти), інакше при розкритті воно втрачало б фокус. */}
      <View className={expanded ? 'gap-1' : 'flex-row items-center'}>
        {expanded ? null : plus}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          onLayout={(e) => {
            if (!expanded) {
              setLineWidth(
                Math.max(0, e.nativeEvent.layout.width - TEXT_PAD * 2),
              )
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={c.mutedForeground}
          multiline
          maxLength={1200}
          // Перенос рядка — Enter, надсилання — кнопка: опис буває довгим.
          submitBehavior="newline"
          textAlignVertical={expanded ? 'top' : 'center'}
          style={FONT}
          className={`text-foreground ${
            expanded
              ? 'max-h-[150px] min-h-[30px] px-1.5 py-1'
              : 'max-h-[40px] flex-1 px-1.5 py-2'
          }`}
        />
        {expanded ? (
          <View className="flex-row items-center justify-between">
            {plus}
            {action}
          </View>
        ) : null}
        {expanded ? null : action}
      </View>
    </View>
  )
}

/**
 * «Надіслати» і «Стоп» — на одному місці, ОБИДВІ завжди змонтовані: одна
 * плавно перетікає в іншу (проявлення й ледь помітне збільшення, 200 мс,
 * рівно). Раніше їх міняв монтаж із ZoomIn/ZoomOut — нова кнопка
 * «вискакувала» з нуля, а в ту ж мить над полем зʼявлялись
 * кнопки-відповіді, і вона ніби стрибала знизу вгору (власник). Тут
 * нічого не монтується й не перекладається — міняються лише прозорість і
 * масштаб; натискається лише видима.
 */
function ActionButton({
  streaming,
  canSend,
  onSend,
  onStop,
}: {
  streaming: boolean
  canSend: boolean
  onSend: () => void
  onStop: () => void
}) {
  const c = useColors()
  const stop = useSharedValue(streaming ? 1 : 0)

  useEffect(() => {
    stop.set(
      withTiming(streaming ? 1 : 0, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      }),
    )
  }, [streaming, stop])

  const stopStyle = useAnimatedStyle(() => ({
    opacity: stop.get(),
    transform: [{ scale: 0.85 + stop.get() * 0.15 }],
  }))
  const sendStyle = useAnimatedStyle(() => ({
    opacity: 1 - stop.get(),
    transform: [{ scale: 1 - stop.get() * 0.15 }],
  }))

  return (
    <View className="size-[34px]">
      <Animated.View
        style={[StyleSheet.absoluteFill, sendStyle]}
        pointerEvents={streaming ? 'none' : 'auto'}
        accessibilityElementsHidden={streaming}
        importantForAccessibility={streaming ? 'no-hide-descendants' : 'auto'}
      >
        <SendButton active={canSend} onPress={onSend} />
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, stopStyle]}
        pointerEvents={streaming ? 'auto' : 'none'}
        accessibilityElementsHidden={!streaming}
        importantForAccessibility={streaming ? 'auto' : 'no-hide-descendants'}
      >
        <Pressable
          onPress={onStop}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Зупинити відповідь"
          className="size-[34px] items-center justify-center rounded-full bg-primary active:opacity-85"
        >
          <Glyph
            name="stop"
            size={13}
            color={c.primaryForeground}
            weight="bold"
          />
        </Pressable>
      </Animated.View>
    </View>
  )
}

/**
 * «Надіслати» — наша іконка з сайту. Неактивна — сіре коло з приглушеною
 * стрілкою; активна — суцільне коло кольору акценту, як «Надіслати» в
 * чаті (раніше було кольору тексту — власник попросив акцент). Між
 * станами — плавне проявлення (а не стрибок кольору).
 */
function SendButton({
  active,
  onPress,
}: {
  active: boolean
  onPress: () => void
}) {
  const c = useColors()
  const on = useSharedValue(active ? 1 : 0)

  useEffect(() => {
    on.set(withTiming(active ? 1 : 0, { duration: 180 }))
  }, [active, on])

  const fill = useAnimatedStyle(() => ({
    opacity: on.get(),
    transform: [{ scale: 0.7 + on.get() * 0.3 }],
  }))

  return (
    <Pressable
      onPress={onPress}
      disabled={!active}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Надіслати"
      accessibilityState={{ disabled: !active }}
      className="size-[34px] items-center justify-center active:opacity-85"
    >
      <View className="absolute inset-0 rounded-full bg-secondary" />
      <Icon name="send" size={18} color={c.mutedForeground} strokeWidth={2} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 17,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
          },
          fill,
        ]}
      >
        <Icon
          name="send"
          size={18}
          color={c.primaryForeground}
          strokeWidth={2}
        />
      </Animated.View>
    </Pressable>
  )
}
