import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import { Platform, Pressable, Text, useColorScheme, View } from 'react-native'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { EditableAvatar } from '@/components/settings/editable-avatar'
import { useColors } from '@/lib/theme'

const RADIUS = 16

/** Червоний рядок під полем чи списком — як у TextField. */
export function FieldError({ text }: { text?: string | null }) {
  const c = useColors()
  if (!text) return null
  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-1.5 pl-0.5"
    >
      <Glyph name="alert" size={15} color={c.destructive} />
      <Text className="flex-1 text-[13px] leading-[17px] text-destructive">
        {text}
      </Text>
    </View>
  )
}

/** Тло й тінь поля — як у TextField (біле у світлій, `field` у темній). */
function useFieldSurface() {
  const c = useColors()
  const dark = useColorScheme() === 'dark'
  return {
    backgroundColor: dark ? c.field : c.background,
    boxShadow: dark ? undefined : '0 1px 2px rgba(0, 0, 0, 0.05)',
  }
}

export interface Choice<T> {
  value: T
  label: string
  hint?: string
  /** Системна іконка в плитці ліворуч. */
  icon?: GlyphName
  /** Свій знак ліворуч замість іконки (напр. іконка послуги). */
  leading?: ReactNode
}

/**
 * Варіанти відповіді картками — як ChoiceTiles на сайті: рамка поля
 * (`field-edge`, скруглення 16, як у полів входу), іконка в плитці,
 * назва й пояснення, кружечок праворуч. Обрана — рамка акценту (як поле
 * у фокусі) і заповнений кружечок із галочкою. Один чи кілька — вирішує
 * батько (`selected` + `onPress`).
 */
export function ChoiceList<T>({
  options,
  selected,
  onPress,
  error,
}: {
  options: readonly Choice<T>[]
  selected: (value: T) => boolean
  onPress: (value: T) => void
  error?: string | null
}) {
  return (
    <View className="gap-3">
      {options.map((o) => (
        <ChoiceCard
          key={String(o.value)}
          option={o}
          on={selected(o.value)}
          invalid={!!error}
          onPress={() => {
            if (Platform.OS !== 'web') void Haptics.selectionAsync()
            onPress(o.value)
          }}
        />
      ))}
      <FieldError text={error} />
    </View>
  )
}

function ChoiceCard<T>({
  option,
  on,
  invalid,
  onPress,
}: {
  option: Choice<T>
  on: boolean
  invalid: boolean
  onPress: () => void
}) {
  const c = useColors()
  const surface = useFieldSurface()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={
        option.hint ? `${option.label}. ${option.hint}` : option.label
      }
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
    >
      <View
        className={`min-h-[64px] flex-row items-center gap-3 border px-3.5 py-3 ${
          invalid && !on ? 'border-destructive' : 'border-field-edge'
        }`}
        style={[{ borderRadius: RADIUS, borderCurve: 'continuous' }, surface]}
      >
        {option.leading ??
          (option.icon ? (
            <View
              className="size-10 items-center justify-center rounded-xl bg-secondary"
              style={{ borderCurve: 'continuous' }}
            >
              <Glyph
                name={option.icon}
                size={21}
                color={on ? c.primary : c.foreground}
              />
            </View>
          ) : null)}
        <View className="flex-1 gap-0.5">
          <Text className="text-[17px] font-semibold leading-[22px] text-foreground">
            {option.label}
          </Text>
          {option.hint ? (
            <Text className="text-[14px] leading-[19px] text-muted-foreground">
              {option.hint}
            </Text>
          ) : null}
        </View>
        <View
          className={`size-6 items-center justify-center rounded-full ${
            on ? 'bg-primary' : 'border-[1.5px] border-field-edge'
          }`}
        >
          {on ? (
            <Glyph
              name="check"
              size={13}
              color={c.primaryForeground}
              weight="bold"
            />
          ) : null}
        </View>

        {/* Обрана — рамка акценту, як поле у фокусі (текст не зсувається). */}
        {on ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -1,
              left: -1,
              right: -1,
              bottom: -1,
              borderRadius: RADIUS + 1,
              borderCurve: 'continuous',
              borderWidth: 2,
              borderColor: c.primary,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  )
}

/**
 * Фото профілю (чи логотип) у кроці анкети: велике коло з камерою й
 * напис під ним. Зберігається одразу (useAvatarEditor), як на сайті.
 */
export function AvatarPicker({
  uri,
  name,
  busy,
  onChange,
  noun = 'фото',
}: {
  uri: string
  name: string
  busy: boolean
  onChange: () => void
  /** «фото» чи «логотип». */
  noun?: string
}) {
  return (
    <View className="items-center gap-3 py-2">
      <EditableAvatar
        uri={uri || null}
        name={name}
        size={120}
        busy={busy}
        onPress={onChange}
        onCamera={onChange}
      />
      <Pressable onPress={onChange} disabled={busy} hitSlop={8}>
        <Text className="text-[16px] font-semibold text-foreground">
          {uri ? `Змінити ${noun}` : `Додати ${noun}`}
        </Text>
      </Pressable>
    </View>
  )
}

/**
 * Поле-вибір (місто, район) — виглядає як поле вводу, а відкриває список
 * аркушем (PickerSheet). Порожнє — назва сірим, як плейсхолдер.
 */
export function SelectField({
  label,
  value,
  onPress,
  error,
}: {
  label: string
  /** Обране — назвою; порожньо — видно `label`. */
  value: string
  onPress: () => void
  error?: string | null
}) {
  const c = useColors()
  const surface = useFieldSurface()
  return (
    <View className="gap-[5px]">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${value}` : label}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View
          className={`h-[50px] flex-row items-center gap-2 border pl-3.5 pr-3 ${
            error ? 'border-destructive' : 'border-field-edge'
          }`}
          style={[{ borderRadius: RADIUS, borderCurve: 'continuous' }, surface]}
        >
          <Text
            numberOfLines={1}
            className={`flex-1 text-[16px] ${
              value ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {value || label}
          </Text>
          <Glyph name="down" size={16} color={c.mutedForeground} />
        </View>
      </Pressable>
      <FieldError text={error} />
    </View>
  )
}
