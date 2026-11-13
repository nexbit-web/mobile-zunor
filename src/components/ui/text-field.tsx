import {
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type Ref,
} from 'react'
import {
  Text,
  TextInput,
  useColorScheme,
  View,
  type TextInputProps,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { Glyph } from '@/components/icons/glyph'
import { useColors } from '@/lib/theme'

/** Те, що отримує `ref` поля: для фокуса з коду (`.focus()`). */
export type TextFieldHandle = ComponentRef<typeof TextInput>

const HEIGHT = 50
const RADIUS = 16
/** Багаторядкове: рядок 22 і відступи — один рядок дає рівно HEIGHT (з рамкою). */
const LINE = 22
const LINES_PAD = (HEIGHT - 2 - LINE) / 2
const TIMING = { duration: 150, easing: Easing.out(Easing.quad) }

/**
 * Поле вводу — як на сторінці входу сайту (web/…/ui/input, скриншот
 * власника): звичайний плейсхолдер усередині («Робоча електронна пошта»),
 * рамка `field-edge` (#b3b3b3 у світлій), скруглення 16 (як у кнопок
 * входу й ClickUp; на сайті 10), ледь помітна
 * тінь; у світлій темі поле біле, у темній — `field`. Фокус — лише рамка
 * кольору акценту (рамка + ще пункт назовні, як `shadow 0 0 0 1px ring`
 * на сайті), більше нічого не міняється — так попросив власник. Рамка
 * фокуса — окремим шаром, щоб текст не зсувався. Висота 50 pt, а не 36,
 * як на сайті: під палець.
 *
 * Помилка — червона рамка (і в фокусі) і рядок з іконкою під полем (не
 * в тості — там на неї дивляться). `trailing` — кнопка праворуч
 * («показати пароль»). `label` — і плейсхолдер, і підпис для читача
 * екрана.
 *
 * `focusOnMount` — поле вже у фокусі, щойно зʼявилось: рамка акценту з
 * першого кадру (не «спалахує» потім), курсор — у наступному кадрі, коли
 * батько вже підписався на клавіатуру (ефекти дітей ідуть раніше за
 * батьківські, тож без кадру фокус випередив би підписку). Не
 * `autoFocus`: той кличе клавіатуру ще до будь-якої підписки.
 */
export function TextField({
  ref,
  label,
  error,
  trailing,
  onFocus,
  onBlur,
  editable = true,
  focusOnMount = false,
  prefix,
  maxLines = 6,
  ...props
}: TextInputProps & {
  ref?: Ref<TextFieldHandle>
  label: string
  error?: string | null
  trailing?: ReactNode
  focusOnMount?: boolean
  /** Незмінна частина перед текстом: «+380», «@». */
  prefix?: string
  /** Багаторядкове (`multiline`): до скількох рядків росте, далі — прокрутка всередині. */
  maxLines?: number
}) {
  const c = useColors()
  const dark = useColorScheme() === 'dark'
  const reduceMotion = useReducedMotion()
  const [focused, setFocused] = useState(focusOnMount)
  const invalid = !!error

  const input = useRef<TextFieldHandle>(null)
  const attach = (node: TextFieldHandle | null) => {
    input.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }
  useEffect(() => {
    if (!focusOnMount) return
    const frame = requestAnimationFrame(() => input.current?.focus())
    return () => cancelAnimationFrame(frame)
    // Лише на появі поля.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const focus = useSharedValue(focusOnMount ? 1 : 0)
  useEffect(() => {
    const to = focused ? 1 : 0
    focus.set(reduceMotion ? to : withTiming(to, TIMING))
  }, [focused, reduceMotion, focus])
  const ringStyle = useAnimatedStyle(() => ({ opacity: focus.get() }))

  const ring = invalid ? c.destructive : c.primary
  const multiline = !!props.multiline

  return (
    <View>
      <View>
        <View
          className={invalid ? 'border-destructive' : 'border-field-edge'}
          style={{
            // Рядок: префікс («+380») і поле поруч. Багаторядкове — від
            // висоти звичайного поля (один рядок) росте з текстом до
            // `maxLines` рядків: велика порожня коробка займала півекрана,
            // і клавіатура з кнопкою її перекривали (власник).
            flexDirection: 'row',
            height: multiline ? undefined : HEIGHT,
            minHeight: multiline ? HEIGHT : undefined,
            borderRadius: RADIUS,
            borderCurve: 'continuous',
            borderWidth: 1,
            backgroundColor: dark ? c.field : c.background,
            // shadow-xs сайту — лише у світлій: на темному тінь не видно.
            boxShadow: dark ? undefined : '0 1px 2px rgba(0, 0, 0, 0.05)',
            opacity: editable ? 1 : 0.55,
          }}
        >
          {prefix ? (
            <Text
              className="text-[16px] text-foreground"
              style={{
                paddingLeft: 14,
                alignSelf: multiline ? 'flex-start' : 'center',
                paddingTop: multiline ? LINES_PAD : 0,
              }}
            >
              {prefix}
            </Text>
          ) : null}
          <TextInput
            ref={attach}
            editable={editable}
            placeholder={label}
            accessibilityLabel={label}
            placeholderTextColor={c.mutedForeground}
            selectionColor={ring}
            cursorColor={ring}
            underlineColorAndroid="transparent"
            onFocus={(e) => {
              setFocused(true)
              onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              onBlur?.(e)
            }}
            className={`text-[16px] text-foreground ${multiline ? 'leading-[22px]' : ''}`}
            style={{
              flex: 1,
              paddingVertical: multiline ? LINES_PAD : 0,
              // Висоту багаторядкового задає текст (і плейсхолдер, поки
              // порожньо), стеля — `maxLines`.
              maxHeight: multiline
                ? LINES_PAD * 2 + LINE * maxLines
                : undefined,
              paddingLeft: prefix ? 5 : 14,
              paddingRight: trailing ? 48 : 14,
              textAlignVertical: multiline ? 'top' : 'center',
            }}
            {...props}
          />

          {trailing ? (
            <View
              className="absolute bottom-0 right-1 top-0 justify-center"
              pointerEvents="box-none"
            >
              {trailing}
            </View>
          ) : null}
        </View>

        {/* Рамка фокуса: рамка поля + ще пункт назовні (будь-якої висоти). */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -1,
              left: -1,
              right: -1,
              bottom: -1,
              borderRadius: RADIUS + 1,
              borderCurve: 'continuous',
              borderWidth: 2,
              borderColor: ring,
            },
            ringStyle,
          ]}
        />
      </View>

      {error ? (
        <View
          accessibilityLiveRegion="polite"
          className="mt-[5px] flex-row items-center gap-1.5 pl-0.5"
        >
          <Glyph name="alert" size={15} color={c.destructive} />
          <Text className="flex-1 text-[13px] leading-[17px] text-destructive">
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
