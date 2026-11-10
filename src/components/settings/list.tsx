import type { UseQueryResult } from '@tanstack/react-query'
import {
  Children,
  Fragment,
  isValidElement,
  type ComponentRef,
  type ReactNode,
  type Ref,
} from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { Button } from '@/components/ui/button'
import { SQUIRCLE, Tile } from '@/components/ui/tile'
import { errorText } from '@/lib/api'
import { useLargeTitleScroll } from '@/lib/large-title'
import { useColors } from '@/lib/theme'

export { TINT, Tile } from '@/components/ui/tile'

// Налаштування — у подачі Telegram / iOS: картки-групи на фоні, у рядку
// кольорова плитка із суцільною системною іконкою (SF Symbols), назва,
// значення сірим і тонкий шеврон. Колір плитки — лише впізнаваність
// розділу (як у системних налаштуваннях), тому він не залежить ні від
// теми, ні від обраного акценту.

/** Плитка 30 pt, відступ 16 + проміжок 14: лінія — під текстом, не під плиткою. */
const TILE = 30
const INSET_TILE = 16 + TILE + 14
const INSET_TEXT = 16

/** Прокрутка екрана налаштувань: відступи, клавіатура, низ під «чубчик». */
export function SettingsScroll({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  // Під напівпрозорою шапкою з великим заголовком (lib/large-title).
  const { padTop, scrollProps } = useLargeTitleScroll()
  return (
    <Animated.ScrollView
      {...scrollProps}
      className="flex-1 bg-background"
      contentContainerClassName="gap-7 px-4"
      contentContainerStyle={{
        paddingTop: padTop + 12,
        paddingBottom: insets.bottom + 40,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      // iOS сам піднімає вміст над клавіатурою; Android — adjustResize.
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </Animated.ScrollView>
  )
}

/**
 * Група рядків — картка. Лінії між рядками ставить сама група, тож
 * рядок не мусить знати, перший він чи ні. Порожні (null) діти —
 * пропускаються: рядки можна вмикати умовою.
 */
export function Section({
  title,
  footer,
  inset = 'tile',
  children,
}: {
  title?: string
  /** Підпис під карткою: рядок тексту або свій вузол (помилка, лічильник). */
  footer?: ReactNode
  /** Звідки починається лінія: від тексту після плитки чи від краю. */
  inset?: 'tile' | 'text'
  children: ReactNode
}) {
  const rows = Children.toArray(children).filter(isValidElement)
  const left = inset === 'tile' ? INSET_TILE : INSET_TEXT

  return (
    <View className="gap-2">
      {title ? (
        <Text className="px-4 text-[13px] font-medium uppercase tracking-[0.4px] text-muted-foreground">
          {title}
        </Text>
      ) : null}
      <View
        className="overflow-hidden rounded-[24px] bg-shell"
        style={SQUIRCLE}
      >
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? (
              <View
                className="bg-input"
                style={{ marginLeft: left, height: StyleSheet.hairlineWidth }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
      {typeof footer === 'string' ? <Footnote>{footer}</Footnote> : footer}
    </View>
  )
}

export function Footnote({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: 'muted' | 'error'
}) {
  return (
    <Text
      className={`px-4 text-[13px] leading-[18px] ${
        tone === 'error' ? 'text-destructive' : 'text-muted-foreground'
      }`}
    >
      {children}
    </Text>
  )
}

/**
 * Рядок: плитка, назва (з описом під нею), значення сірим, шеврон.
 * Без `onPress` — просто показує значення (не натискається).
 */
export function Row({
  icon,
  tint,
  leading,
  label,
  description,
  value,
  right,
  onPress,
  chevron = true,
  external = false,
  loading = false,
  disabled = false,
}: {
  icon?: GlyphName
  tint?: string
  /** Своя плитка замість іконки (напр. «G» для Google). */
  leading?: ReactNode
  label: string
  description?: string
  value?: string
  right?: ReactNode
  onPress?: () => void
  chevron?: boolean
  /** Веде назовні (сайт): стрілка ↗ замість шеврона. */
  external?: boolean
  loading?: boolean
  disabled?: boolean
}) {
  const c = useColors()
  const content = (
    <>
      {leading ?? (icon && tint ? <Tile icon={icon} tint={tint} /> : null)}
      <View className="flex-1 gap-0.5 py-[13px]">
        <Text className="text-[17px] tracking-[-0.2px] text-foreground">
          {label}
        </Text>
        {description ? (
          <Text className="text-[13.5px] leading-[18px] text-muted-foreground">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          numberOfLines={1}
          className="max-w-[55%] text-[17px] tracking-[-0.2px] text-muted-foreground"
        >
          {value}
        </Text>
      ) : null}
      {right}
      {loading ? (
        <ActivityIndicator size="small" color={c.mutedForeground} />
      ) : onPress && chevron ? (
        // Шеврон iOS — дрібний і жирний, кольору «третинного» тексту.
        <View style={{ opacity: 0.5 }}>
          <Glyph
            name={external ? 'external' : 'chevron'}
            size={external ? 12 : 13}
            color={c.mutedForeground}
            weight="semibold"
          />
        </View>
      ) : null}
    </>
  )

  const box = 'min-h-[50px] flex-row items-center gap-3.5 px-4'
  if (!onPress) return <View className={box}>{content}</View>
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={`${box} active:bg-secondary ${disabled ? 'opacity-45' : ''}`}
    >
      {content}
    </Pressable>
  )
}

/**
 * Дія без переходу — як «Вийти» чи «Змінити фото» в Telegram: лише
 * кольоровий напис, без плитки й шеврона.
 */
export function ActionRow({
  label,
  onPress,
  tone = 'primary',
  icon,
  align = 'center',
  loading = false,
  disabled = false,
}: {
  label: string
  onPress: () => void
  tone?: 'primary' | 'destructive'
  icon?: GlyphName
  align?: 'center' | 'left'
  loading?: boolean
  disabled?: boolean
}) {
  const c = useColors()
  const color = tone === 'destructive' ? c.destructive : c.primary
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={`min-h-[50px] flex-row items-center gap-3 px-4 active:bg-secondary ${
        align === 'center' ? 'justify-center' : ''
      } ${disabled ? 'opacity-45' : ''}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : icon ? (
        <Glyph name={icon} size={18} color={color} weight="medium" />
      ) : null}
      <Text className="text-[17px] tracking-[-0.2px]" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  )
}

/** Поле прямо в рядку картки: підпис ліворуч, текст праворуч від нього. */
export function FieldRow({
  ref,
  label,
  labelWidth = 92,
  prefix,
  right,
  ...props
}: TextInputProps & {
  ref?: Ref<ComponentRef<typeof TextInput>>
  label?: string
  labelWidth?: number
  /** Незмінна частина перед текстом (напр. «+380» телефону). */
  prefix?: string
  right?: ReactNode
}) {
  const c = useColors()
  return (
    <View className="min-h-[50px] flex-row items-center gap-3 px-4">
      {label ? (
        <Text
          className="text-[17px] tracking-[-0.2px] text-foreground"
          style={{ width: labelWidth }}
        >
          {label}
        </Text>
      ) : null}
      {prefix ? (
        <Text className="-mr-1.5 text-[17px] text-muted-foreground">
          {prefix}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={c.mutedForeground}
        className="flex-1 py-3.5 text-[17px] text-foreground"
        {...props}
      />
      {right}
    </View>
  )
}

/** Багаторядкове поле на всю ширину картки (опис, «про себе»). */
export function AreaField(props: TextInputProps) {
  const c = useColors()
  return (
    <TextInput
      multiline
      textAlignVertical="top"
      placeholderTextColor={c.mutedForeground}
      className="min-h-[104px] px-4 pb-3.5 pt-3.5 text-[17px] leading-[22px] text-foreground"
      {...props}
    />
  )
}

/** Кнопка шапки «Зберегти»: пігулка в колір акценту, сіра — поки нічого. */
export function HeaderSave(props: {
  onPress: () => void
  disabled: boolean
  loading: boolean
}) {
  return <HeaderPill label="Зберегти" {...props} />
}

/**
 * Пігулка в шапці: «Змінити» (сіра — дія без наслідків) і «Зберегти»
 * (у колір акценту, сіра — поки нічого зберігати). Одне місце, одна
 * форма — «Змінити» перетворюється на «Зберегти», а не стрибає.
 */
export function HeaderPill({
  label,
  onPress,
  disabled = false,
  loading = false,
  tone = 'primary',
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  tone?: 'primary' | 'secondary'
}) {
  const c = useColors()
  const off = disabled || loading
  const filled = tone === 'primary' && !off
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      className={`h-9 shrink-0 items-center justify-center rounded-full px-3.5 active:opacity-80 ${
        filled ? 'bg-primary' : 'bg-secondary'
      }`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c.mutedForeground} />
      ) : (
        // Одним рядком: перенесена остання літера («Зберегт/и») — це бите.
        <Text
          numberOfLines={1}
          className={`text-[15px] font-semibold ${
            filled
              ? 'text-primary-foreground'
              : off
                ? 'text-muted-foreground'
                : 'text-foreground'
          }`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

/**
 * Поки дані розділу вантажаться — спінер; не вийшло — причина й
 * «Спробувати ще раз». Готово — сам екран.
 */
export function QueryGate<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
}) {
  const c = useColors()
  if (query.data !== undefined) return children(query.data)

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-8">
      {query.isError ? (
        <>
          <Text className="text-center text-[15px] leading-[21px] text-muted-foreground">
            {errorText(query.error)}
          </Text>
          <Button variant="secondary" onPress={() => query.refetch()}>
            Спробувати ще раз
          </Button>
        </>
      ) : (
        <ActivityIndicator color={c.mutedForeground} />
      )}
    </View>
  )
}
