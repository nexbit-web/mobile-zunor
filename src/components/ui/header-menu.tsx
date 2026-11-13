import { BlurView } from 'expo-blur'
import { useEffect, useState, type ReactNode } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'

import { HEADER_BAR } from '@/lib/large-title'

const RADIUS = 20
/** Кнопка шапки (RoundButton) — коло 44, стоїть на px-4 від правого краю. */
const BUTTON = 44
const EDGE = 16
/** Проміжок між кнопками шапки (gap-2). */
const BETWEEN = 8
/** Меню — під шапкою, на 2 pt нижче її низу. */
const GAP = 2

const OPEN = { duration: 260, easing: Easing.out(Easing.cubic) }
const CLOSE = { duration: 200, easing: Easing.in(Easing.cubic) }

/**
 * Матеріал — те саме скло, що в банера «вам написали» (message-banner):
 * системне розмиття iOS і поверх щільніша підкладка — у меню читають
 * пункти, тож воно щільніше за банер. Край тримає тонка грань тінню по
 * всьому периметру: у світлій темі верх меню зливався з білою шапкою
 * (власник), бо тінь була лише знизу. Android — суцільна заливка.
 */
const LOOK = {
  light: {
    tint: 'systemMaterialLight',
    veil:
      Platform.OS === 'ios'
        ? 'rgba(255, 255, 255, 0.6)'
        : 'rgba(255, 255, 255, 0.98)',
    shadow:
      '0 0 0 1px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.06), 0 12px 40px rgba(0, 0, 0, 0.14)',
  },
  dark: {
    tint: 'systemMaterialDark',
    veil:
      Platform.OS === 'ios'
        ? 'rgba(44, 44, 46, 0.55)'
        : 'rgba(46, 46, 46, 0.98)',
    shadow:
      '0 0 0 1px rgba(255, 255, 255, 0.07), 0 12px 40px rgba(0, 0, 0, 0.5)',
  },
} as const

/**
 * Меню з круглої кнопки праворуч у шапці («⋯» розмови з Zunor, фільтр
 * стрічки майстра). Як меню iOS: виростає з самої кнопки — з точки в її
 * центрі — і при закритті так само стягується назад у неї (власник:
 * «з точки бац зʼявилось, і хоп — у точку поїхало»). Рівно, без пружини:
 * 260 мс туди, 200 мс назад. Із «Зменшити рух» — лише проява.
 *
 * Кнопку малює сам екран; `open` — відкрите, `onClose` — дотик повз меню
 * чи «назад» Android. Пункт меню закриває його сам (onClose) — анімація
 * закриття догравить і після цього.
 */
export function HeaderMenu({
  open,
  onClose,
  width,
  slot = 0,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  width: number
  /**
   * Котра кнопка шапки, рахуючи справа: 0 — крайня (≡ «⋯» Zunor), 1 —
   * ліворуч від неї (фільтр поруч із дзвіночком). З її центру меню росте.
   */
  slot?: number
  /** Для читача екрана: що закриває дотик повз меню. */
  label: string
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const look = useColorScheme() === 'dark' ? LOOK.dark : LOOK.light
  const still = useReducedMotion()
  // Modal живе, поки дограє закриття, — довше за сам `open`.
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const p = useSharedValue(0)

  useEffect(() => {
    if (open) {
      p.set(withTiming(1, OPEN))
    } else {
      p.set(
        withTiming(0, CLOSE, (done) => {
          if (done) scheduleOnRN(setMounted, false)
        }),
      )
    }
  }, [open, p])

  const style = useAnimatedStyle(() => ({
    // Проявляється швидше, ніж росте: уже на третині шляху — повністю.
    opacity: Math.min(1, p.get() * 3),
    transform: [{ scale: still ? 1 : 0.08 + p.get() * 0.92 }],
  }))

  // Центр кнопки — точка, з якої меню росте, від лівого верхнього кута
  // меню (воно стоїть правим краєм на px-4): по горизонталі — де кнопка
  // `slot`, по вертикалі — угору до середини шапки.
  const fromRight = slot * (BUTTON + BETWEEN) + BUTTON / 2
  const origin = [width - fromRight, -(HEADER_BAR / 2 + GAP), 0]

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel={label}
      />
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          {
            position: 'absolute',
            top: insets.top + HEADER_BAR + GAP,
            right: EDGE,
            width,
            borderRadius: RADIUS,
            borderCurve: 'continuous',
            boxShadow: look.shadow,
            transformOrigin: origin,
          },
          style,
        ]}
      >
        {/* Скло — окремим шаром з обрізанням: тінь лишається зовні. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: RADIUS,
              borderCurve: 'continuous',
              overflow: 'hidden',
            },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView
              tint={look.tint}
              intensity={100}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: look.veil }]}
          />
        </View>
        <View className="p-1.5">{children}</View>
      </Animated.View>
    </Modal>
  )
}
