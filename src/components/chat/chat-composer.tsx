import { Image } from 'expo-image'
import { useEffect, type ComponentRef, type RefObject } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { Glyph } from '@/components/icons/glyph'
import { Icon } from '@/components/icons/icon'
import { useColors } from '@/lib/theme'
import { MAX_TEXT_LENGTH } from '@/shared/chat'

/** Що висить над полем: відповідь на повідомлення чи його правка. */
export interface ComposerContext {
  kind: 'reply' | 'edit'
  /** «Відповідь: Олена» / «Редагування». */
  title: string
  text: string
}

/**
 * Поле вводу розмови — смуга внизу, як на сайті: скріпка (фото) ліворуч,
 * капсула з текстом і кнопкою емодзі всередині, «Надіслати» праворуч.
 * Скріпка й капсула — на одному тлі (`shell`), «Надіслати» — коло кольору
 * акценту (так попросив власник). Над полем — смужка відповіді чи правки
 * (з хрестиком) і вибране фото, до якого текст стає підписом.
 */
export function ChatComposer({
  inputRef,
  value,
  onChange,
  onSelectionChange,
  onSend,
  canSend,
  context,
  onCancelContext,
  photoUri,
  onRemovePhoto,
  onAttach,
  emojiOpen,
  onToggleEmoji,
  onFocus,
}: {
  inputRef: RefObject<ComponentRef<typeof TextInput> | null>
  value: string
  onChange: (text: string) => void
  onSelectionChange: (sel: { start: number; end: number }) => void
  onSend: () => void
  canSend: boolean
  context: ComposerContext | null
  onCancelContext: () => void
  photoUri: string | null
  onRemovePhoto: () => void
  onAttach: () => void
  emojiOpen: boolean
  onToggleEmoji: () => void
  onFocus: () => void
}) {
  const c = useColors()
  const editing = context?.kind === 'edit'

  return (
    <View className="bg-background">
      <View
        className="absolute inset-x-0 top-0 bg-border"
        style={{ height: StyleSheet.hairlineWidth }}
      />

      {context ? (
        <Animated.View
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(100)}
          className="flex-row items-center gap-3 pl-4 pr-2 pt-2"
        >
          <Glyph
            name={editing ? 'edit' : 'reply'}
            size={19}
            color={c.primary}
            weight="medium"
          />
          <View className="flex-1 border-l-2 border-primary pl-2.5">
            <Text
              numberOfLines={1}
              className="text-[14px] font-semibold text-primary"
            >
              {context.title}
            </Text>
            <Text numberOfLines={1} className="text-[15px] text-foreground">
              {context.text}
            </Text>
          </View>
          <Pressable
            onPress={onCancelContext}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              editing ? 'Скасувати правку' : 'Скасувати відповідь'
            }
            className="size-9 items-center justify-center rounded-full active:opacity-50"
          >
            <Glyph
              name="close"
              size={15}
              color={c.mutedForeground}
              weight="semibold"
            />
          </Pressable>
        </Animated.View>
      ) : null}

      {photoUri ? (
        <Animated.View
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(100)}
          className="px-3 pt-2.5"
        >
          <View className="self-start">
            <Image
              source={photoUri}
              contentFit="cover"
              style={{ width: 76, height: 76, borderRadius: 14 }}
            />
            <Pressable
              onPress={onRemovePhoto}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Прибрати фото"
              className="absolute -right-1.5 -top-1.5 size-6 items-center justify-center rounded-full bg-foreground"
            >
              <Glyph
                name="close"
                size={10}
                color={c.background}
                weight="bold"
              />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      <View className="flex-row items-end gap-1.5 px-2 py-1.5">
        {/* Фото — лише в нових повідомленнях: правка міняє тільки текст. */}
        <Pressable
          onPress={onAttach}
          disabled={editing}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Додати фото"
          className="size-10 items-center justify-center rounded-full bg-shell active:opacity-70"
          style={{ opacity: editing ? 0.4 : 1 }}
        >
          {/* Більша, ніж була (20) — так попросив власник. */}
          <Glyph name="attach" size={23} color={c.foreground} />
        </Pressable>

        <View className="min-h-10 flex-1 flex-row items-end rounded-[20px] bg-shell">
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChange}
            onSelectionChange={(e) =>
              onSelectionChange(e.nativeEvent.selection)
            }
            onFocus={onFocus}
            placeholder={photoUri ? 'Підпис…' : 'Повідомлення'}
            placeholderTextColor={c.mutedForeground}
            multiline
            maxLength={MAX_TEXT_LENGTH}
            submitBehavior="newline"
            className="max-h-[132px] flex-1 pl-4 pr-1 text-foreground"
            style={{ fontSize: 17, lineHeight: 22, paddingVertical: 9 }}
          />
          <Pressable
            onPress={onToggleEmoji}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={emojiOpen ? 'Клавіатура' : 'Емодзі'}
            className="size-10 items-center justify-center rounded-full active:opacity-50"
          >
            <EmojiKeyboardIcon keyboard={emojiOpen} color={c.mutedForeground} />
          </Pressable>
        </View>

        <SendButton active={canSend} edit={editing} onPress={onSend} />
      </View>
    </View>
  )
}

/** Іконка перемикача емодзі/клавіатура — більша, ніж була (22). */
const SWAP = 25

/**
 * Смайлик ↔ клавіатура в полі: одна іконка плавно переходить в іншу
 * (гасне й трохи зменшується, друга проявляється й виростає; 200 мс, без
 * пружини), а не міняється різко — так попросив власник.
 */
function EmojiKeyboardIcon({
  keyboard,
  color,
}: {
  keyboard: boolean
  color: string
}) {
  const reduceMotion = useReducedMotion()
  const k = useSharedValue(keyboard ? 1 : 0)
  useEffect(() => {
    k.set(
      reduceMotion
        ? keyboard
          ? 1
          : 0
        : withTiming(keyboard ? 1 : 0, {
            duration: 200,
            easing: Easing.out(Easing.cubic),
          }),
    )
  }, [keyboard, reduceMotion, k])
  const emoji = useAnimatedStyle(() => ({
    opacity: 1 - k.get(),
    transform: [{ scale: 1 - 0.25 * k.get() }],
  }))
  const keys = useAnimatedStyle(() => ({
    opacity: k.get(),
    transform: [{ scale: 0.75 + 0.25 * k.get() }],
  }))
  const layer = [
    StyleSheet.absoluteFill,
    { alignItems: 'center', justifyContent: 'center' },
  ] as const
  return (
    <View style={{ width: SWAP + 4, height: SWAP + 4 }}>
      <Animated.View style={[layer, emoji]}>
        <Glyph name="emoji" size={SWAP} color={color} />
      </Animated.View>
      <Animated.View style={[layer, keys]}>
        <Glyph name="keyboard" size={SWAP} color={color} />
      </Animated.View>
    </View>
  )
}

/**
 * «Надіслати» — коло кольору акценту (саме акцент, не чорне й не біле —
 * так попросив власник) з іконкою сайту «send». Поки надсилати нічого —
 * бліде; з першою літерою спокійно проявляється. У правці — галочка.
 */
function SendButton({
  active,
  edit,
  onPress,
}: {
  active: boolean
  edit: boolean
  onPress: () => void
}) {
  const c = useColors()
  const on = useSharedValue(active ? 1 : 0)
  useEffect(() => {
    on.set(withTiming(active ? 1 : 0, { duration: 150 }))
  }, [active, on])
  const look = useAnimatedStyle(() => ({ opacity: 0.45 + on.get() * 0.55 }))

  return (
    <Pressable
      onPress={onPress}
      disabled={!active}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={edit ? 'Зберегти' : 'Надіслати'}
      accessibilityState={{ disabled: !active }}
      className="active:opacity-80"
    >
      <Animated.View
        style={[
          {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
          },
          look,
        ]}
      >
        <Icon
          name={edit ? 'check' : 'send'}
          size={18}
          color={c.primaryForeground}
          strokeWidth={2}
        />
      </Animated.View>
    </Pressable>
  )
}
