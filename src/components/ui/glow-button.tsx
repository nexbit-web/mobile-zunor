import { useId, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { useColors } from '@/lib/theme'

/** Висота й текст за розміром: lg — дія екрана внизу, md — у порожньому стані. */
const SIZES = {
  lg: { height: 56, text: 'text-[18px]', icon: 20, pad: 'px-6' },
  md: { height: 48, text: 'text-[16px]', icon: 18, pad: 'px-7' },
} as const

/**
 * Сила ефекту. `lg` — як у «Подати пропозицію» (56 pt). На малих кнопках
 * (коло «+» 58, «Зберегти» 44) той самий ободок і відблиск займають
 * більшу частку кнопки й виглядали надто виразно — власник попросив
 * «як у майстра», тож там тонший ободок і слабший відблиск: на око —
 * той самий ефект.
 */
const STRENGTH = {
  lg: {
    rim: 'rgba(255, 255, 255, 0.3)',
    rimWidth: 1.5,
    top: 0.24,
    mid: 0.04,
    bottom: 0.08,
  },
  sm: {
    rim: 'rgba(255, 255, 255, 0.18)',
    rimWidth: 1,
    top: 0.13,
    mid: 0.02,
    bottom: 0.05,
  },
} as const

/**
 * Поверхня «світної» кнопки — головних дій застосунку: суцільний акцент,
 * світлий ободок (біле ~30%) і відблиск згори — м'який градієнт,
 * світліше вгорі, ледь темніше внизу, як кнопки в системних екранах iOS.
 * Без кольорової тіні-«світіння» під кнопкою (так попросив власник).
 *
 * Нею вбрані: «Подати пропозицію» (GlowButton), «Змінити пароль», «+»
 * нової розмови в бічній панелі, «Зберегти» в шапці (HeaderPill).
 * `radius` — половина висоти (капсула чи коло); `strength` — `sm` для
 * малих кнопок (STRENGTH).
 */
export function GlowSurface({
  radius,
  strength = 'lg',
  className,
  style,
  children,
}: {
  radius: number
  strength?: keyof typeof STRENGTH
  className?: string
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const c = useColors()
  const k = STRENGTH[strength]
  // Кілька таких кнопок на екрані — id градієнтів не мають збігатися.
  const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <View
      className={className}
      style={[
        {
          borderRadius: radius,
          backgroundColor: c.primary,
          borderWidth: k.rimWidth,
          borderColor: k.rim,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* Відблиск: світліше згори, ледь темніше знизу — об'єм. */}
      <Svg
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={k.top} />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity={k.mid} />
            <Stop offset="1" stopColor="#000000" stopOpacity={k.bottom} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  )
}

/**
 * Головна дія екрана — капсула GlowSurface з написом (і іконкою).
 * Натиснута — ледь стискається.
 *
 * `lg` — «Подати пропозицію» внизу заявки, «Змінити пароль»; `md` — дія
 * порожнього стану («Показати всі», «Спробувати ще»): та сама капсула,
 * лише нижча.
 */
export function GlowButton({
  label,
  icon,
  onPress,
  loading = false,
  disabled = false,
  size = 'lg',
}: {
  label: string
  icon?: GlyphName
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  size?: keyof typeof SIZES
}) {
  const c = useColors()
  const s = SIZES[size]
  const off = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => ({
        borderRadius: s.height / 2,
        opacity: disabled ? 0.55 : 1,
        transform: [{ scale: pressed ? 0.975 : 1 }],
      })}
    >
      <GlowSurface
        radius={s.height / 2}
        style={{ height: s.height }}
        className={`flex-row items-center justify-center gap-2.5 ${s.pad}`}
      >
        {loading ? (
          <ActivityIndicator color={c.primaryForeground} />
        ) : icon ? (
          <Glyph
            name={icon}
            size={s.icon}
            color={c.primaryForeground}
            weight="semibold"
          />
        ) : null}
        <Text
          numberOfLines={1}
          className={`${s.text} font-bold tracking-[-0.3px]`}
          style={{ color: c.primaryForeground }}
        >
          {label}
        </Text>
      </GlowSurface>
    </Pressable>
  )
}
