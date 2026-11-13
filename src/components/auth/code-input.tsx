import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import type { TextFieldHandle } from '@/components/ui/text-field'
import { useColors } from '@/lib/theme'

/**
 * Курсор у клітинці — як у полі вводу: риска кольору акценту, що блимає
 * (~1 с: видно, гасне, знову видно — плавно, без стрибків). Справжнє поле
 * під клітинками прозоре, його курсор не видно, тож малюємо свій. Нова
 * цифра — курсор переходить у наступну клітинку й починає з видимого, як
 * системний, що не блимає, поки друкуєш. «Зменшити рух» його не гасить:
 * це не анімація, а знак, куди піде цифра.
 */
function Caret({ color }: { color: string }) {
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.set(
      withRepeat(
        withSequence(
          withDelay(450, withTiming(0, { duration: 150 })),
          withDelay(250, withTiming(1, { duration: 150 })),
        ),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
    )
    return () => cancelAnimation(opacity)
  }, [opacity])

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { width: 2, height: 28, borderRadius: 1, backgroundColor: color },
        style,
      ]}
    />
  )
}

/**
 * Шість клітинок коду з листа — як на сайті (verify-email, InputOTP):
 * одна група, без рисочки посередині. Під клітинками — справжнє поле
 * (прозоре, на всю їхню площу): цифрова клавіатура, підказка коду над
 * нею (iOS бере код із Пошти — `oneTimeCode`), вставка. Клітинка, куди
 * піде наступна цифра, — у рамці акценту з курсором, що блимає, як поле
 * у фокусі (власник).
 *
 * Курсор — одразу, кадром пізніше за появу (ефект дитини йде раніше за
 * батьківську підписку на клавіатуру в AuthScreen — кадр її пропускає
 * вперед), як `focusOnMount` у полях.
 */
export function CodeInput({
  value,
  onChange,
  length = 6,
  invalid = false,
  disabled = false,
}: {
  value: string
  onChange: (code: string) => void
  length?: number
  invalid?: boolean
  disabled?: boolean
}) {
  const c = useColors()
  const input = useRef<TextFieldHandle>(null)
  const [focused, setFocused] = useState(true)

  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  const next = Math.min(value.length, length - 1)
  const ring = invalid ? c.destructive : c.primary
  // Усі шість є — курсора немає (код уже перевіряється), рамка — на останній.
  const caretAt = focused && !disabled && value.length < length ? next : -1

  return (
    <Pressable
      accessible={false}
      onPress={() => input.current?.focus()}
      className="flex-row justify-center gap-2"
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      {Array.from({ length }, (_, i) => (
        <View
          key={i}
          className={`h-14 flex-1 items-center justify-center rounded-[14px] border bg-background ${
            invalid ? 'border-destructive' : 'border-field-edge'
          }`}
          style={{ maxWidth: 52, borderCurve: 'continuous' }}
        >
          {value[i] ? (
            <Text className="text-[24px] font-semibold text-foreground">
              {value[i]}
            </Text>
          ) : i === caretAt ? (
            <Caret color={ring} />
          ) : null}
          {focused && i === next && !disabled ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -1,
                left: -1,
                right: -1,
                bottom: -1,
                borderRadius: 15,
                borderCurve: 'continuous',
                borderWidth: 2,
                borderColor: ring,
              }}
            />
          ) : null}
        </View>
      ))}

      <TextInput
        ref={input}
        value={value}
        // Не `editable={false}` на час перевірки: iOS знімає фокус, ховає
        // клавіатуру, і після помилки вона не повертається.
        onChangeText={(text) => {
          if (!disabled) onChange(text.replace(/\D/g, '').slice(0, length))
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        caretHidden
        accessibilityLabel="Код підтвердження"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.02,
          color: 'transparent',
        }}
      />
    </Pressable>
  )
}
