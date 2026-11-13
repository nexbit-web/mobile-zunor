import * as Haptics from 'expo-haptics'
import { useId, useState, type ReactNode } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { Glyph, type GlyphName } from '@/components/icons/glyph'

export interface SwipeAction {
  key: string
  icon: GlyphName
  label: string
  /** Колір пігулки (червоний — видалення). */
  color: string
  onPress: () => void
  /**
   * Дія прибирає рядок: він спершу відʼїжджає вліво за край. Перша така
   * дія ще й спрацьовує «повним свайпом» — потягнули далеко й відпустили.
   */
  removes?: boolean
}

/** Пігулка дії — як у Telegram (скриншот власника). */
const PILL_W = 68
const PILL_H = 42
const ICON = 20
const GAP = 10
/** Від пігулки до правого краю списку. */
const EDGE = 4
/** Заокруглення рядка, поки його тягнуть, — він відривається від картки. */
const RADIUS = 22
/** «Повний свайп» — далі цієї частки ширини рядка відпущений рядок видаляється. */
const FULL_AT = 0.6

const SETTLE = { duration: 260, easing: Easing.out(Easing.cubic) }

/** Відкритий зараз рядок — щоб відкритим був лише один. */
let current: { id: string; close: () => void } | null = null

/** Закрити відкритий рядок (напр. коли гортають список чи пішли з екрана). */
export function closeSwipeRows() {
  current?.close()
  current = null
}

/** Дотик почався у відкритому рядку (на ньому чи його пігулці). */
let touchedOpen = false

/**
 * На корінь екрана зі списком (`onTouchStart`): дотик будь-де поза
 * відкритим рядком закриває його. Сам рядок позначає свої дотики раніше
 * (подія спливає від нього до кореня), тож кошик під пальцем лишається.
 */
export function swipeAreaTouch() {
  if (touchedOpen) {
    touchedOpen = false
    return
  }
  closeSwipeRows()
}

/**
 * Рядок, який можна потягнути вліво: з-під нього справа виходять дії —
 * пігулки з іконкою й підписом під нею, як у Telegram (скриншоти
 * власника). Пігулки виростають і проявляються разом із рухом пальця;
 * відпустили далі за половину — рядок відкритий, ближче — повертається.
 *
 * «Повний свайп» (перша дія з `removes`): тягнуть далі — її пігулка
 * розтягується за пальцем (іконка лишається біля краю рядка, підпис
 * гасне). За `FULL_AT` ширини — легке «клацання»: відпустиш — рядок
 * їде за край і дія спрацьовує сама, без дотику. Не дотягнули й
 * відпустили — пігулка стискається назад, рядок лишається відкритим.
 *
 * Без пружин: 260 мс, крива out (так скрізь у застосунку). Відкритим
 * буває лише один рядок; дотик по відкритому — закриває його.
 * Вертикальний рух — прокрутка списку: жест вмикається лише вбік.
 */
export function SwipeRow({
  children,
  actions,
  enabled = true,
}: {
  children: ReactNode
  actions: SwipeAction[]
  /** `false` — рядок не тягнеться (напр. у режимі вибору). */
  enabled?: boolean
}) {
  const { width: screen } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  /** Ширина всіх пігулок — на стільки відкривається рядок. */
  const width = actions.length * (PILL_W + GAP) + EDGE
  const full = actions[0]?.removes ? actions[0] : null
  const id = useId()
  const tx = useSharedValue(0)
  const from = useSharedValue(0)
  const rowW = useSharedValue(screen)
  /** Потягнули за межу «повного свайпу». */
  const armed = useSharedValue(false)
  /** Рядок видаляють — пігулки гаснуть разом із ним. */
  const vanish = useSharedValue(1)
  const [open, setOpen] = useState(false)

  const to = (x: number, done?: () => void) => {
    tx.set(
      reduceMotion
        ? x
        : withTiming(x, SETTLE, (finished) => {
            if (finished && done) scheduleOnRN(done)
          }),
    )
    if (reduceMotion && done) done()
  }

  function close() {
    to(0)
    setOpen(false)
    if (current?.id === id) current = null
  }

  /** Інший відкритий рядок закривається. */
  function closeOthers() {
    if (current && current.id !== id) {
      current.close()
      current = null
    }
  }

  function opened() {
    closeOthers()
    current = { id, close }
    setOpen(true)
  }

  function closed() {
    if (current?.id === id) current = null
    setOpen(false)
  }

  /** Легке «клацання» — дія і межа «повного свайпу». */
  function tick() {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }

  function run(action: SwipeAction, haptic = true) {
    if (haptic) tick()
    if (current?.id === id) current = null
    setOpen(false)
    if (action.removes) {
      // Рядок відʼїжджає за край, пігулки гаснуть, і лише тоді він
      // зникає зі списку.
      vanish.set(reduceMotion ? 0 : withTiming(0, SETTLE))
      to(-screen, action.onPress)
    } else {
      close()
      action.onPress()
    }
  }

  function runFull() {
    // «Клацання» вже було на межі — вдруге не треба.
    if (full) run(full, false)
  }

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onStart(() => {
      from.set(tx.get())
      armed.set(false)
      scheduleOnRN(closeOthers)
    })
    .onUpdate((e) => {
      let x = from.get() + e.translationX
      if (x > 0) x = 0
      if (full) {
        // Можна тягнути до самого краю — пігулка розтягується.
        x = Math.max(x, -rowW.get())
        const arm = -x > Math.max(width + 80, rowW.get() * FULL_AT)
        if (arm !== armed.get()) {
          armed.set(arm)
          if (arm) scheduleOnRN(tick)
        }
      } else if (x < -width) {
        // Без «повного свайпу» — за відкритим краєм опір, не відскок.
        x = -width + (x + width) * 0.25
      }
      tx.set(x)
    })
    .onEnd((e) => {
      if (full && armed.get()) {
        scheduleOnRN(runFull)
        return
      }
      const show =
        tx.get() < -width / 2 || (e.velocityX < -600 && tx.get() < -8)
      const x = show ? -width : 0
      tx.set(reduceMotion ? x : withTiming(x, SETTLE))
      scheduleOnRN(show ? opened : closed)
    })

  const row = useAnimatedStyle(() => {
    const r = interpolate(-tx.get(), [0, 24], [0, RADIUS], 'clamp')
    return {
      transform: [{ translateX: tx.get() }],
      borderRadius: r,
    }
  })

  return (
    <View
      onLayout={(e) => rowW.set(e.nativeEvent.layout.width)}
      // Дотик у відкритому рядку — не «повз нього» (swipeAreaTouch).
      onTouchStart={() => {
        if (current?.id === id) touchedOpen = true
      }}
    >
      {/* Дії — під рядком, праворуч, по центру його висоти. */}
      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingRight: EDGE,
            gap: GAP,
          },
        ]}
      >
        {actions.map((a, i) => (
          <ActionPill
            key={a.key}
            action={a}
            tx={tx}
            rowW={rowW}
            vanish={vanish}
            // Дальня від краю виходить трохи пізніше — як у Telegram.
            reach={(actions.length - i) * (PILL_W + GAP)}
            width={width}
            // Розтягується перша дія «повного свайпу»; праворуч від неї —
            // решта пігулок.
            stretch={a === full ? (actions.length - 1) * (PILL_W + GAP) : null}
            onPress={() => run(a)}
          />
        ))}
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[{ overflow: 'hidden' }, row]}>
          {children}
          {/* Відкритий: дотик по рядку закриває його, а не відкриває. */}
          {open ? (
            <Pressable
              onPress={close}
              accessibilityLabel="Закрити дії"
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

function ActionPill({
  action,
  tx,
  rowW,
  vanish,
  reach,
  width,
  stretch,
  onPress,
}: {
  action: SwipeAction
  tx: SharedValue<number>
  rowW: SharedValue<number>
  vanish: SharedValue<number>
  /** На скільки треба потягнути, щоб пігулка вийшла повністю. */
  reach: number
  /** Ширина всіх дій — на стільки рядок відкритий. */
  width: number
  /**
   * Пігулка «повного свайпу»: скільки місця праворуч від неї займають
   * інші (вона тягнеться від краю рядка до них). `null` — не тягнеться.
   */
  stretch: number | null
  onPress: () => void
}) {
  const box = useAnimatedStyle(() => {
    const x = -tx.get()
    const p = interpolate(x, [reach * 0.35, reach], [0, 1], 'clamp')
    // Решта пігулок гасне, поки тягнуть «повний свайп».
    const rest =
      stretch === null
        ? interpolate(x, [width, width + 40], [1, 0], 'clamp')
        : 1
    return {
      opacity: p * rest * vanish.get(),
      transform: [{ scale: 0.6 + 0.4 * p }],
    }
  })
  // Від краю рядка (+ проміжок) до сусідніх пігулок — не менше звичайної.
  const pill = useAnimatedStyle(() => ({
    width:
      stretch === null
        ? PILL_W
        : Math.min(
            Math.max(PILL_W, -tx.get() - GAP - EDGE - stretch),
            rowW.get(),
          ),
  }))
  // Розтягнута пігулка — без підпису (як у Telegram).
  const label = useAnimatedStyle(() => ({
    opacity:
      stretch === null
        ? 1
        : interpolate(-tx.get(), [width, width + 40], [1, 0], 'clamp'),
  }))

  return (
    <Animated.View style={[{ alignItems: 'center', gap: 5 }, box]}>
      <Animated.View
        style={[
          {
            height: PILL_H,
            borderRadius: PILL_H / 2,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: action.color,
          },
          pill,
        ]}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          className="flex-1 justify-center active:opacity-80"
          // Іконка — на тому самому місці від лівого краю пігулки: у
          // звичайній вона по центру, у розтягнутій — біля краю рядка.
          style={{ paddingLeft: (PILL_W - ICON) / 2 }}
        >
          <Glyph
            name={action.icon}
            size={ICON}
            color="#ffffff"
            weight="semibold"
          />
        </Pressable>
      </Animated.View>
      <Animated.Text
        className="text-[12.5px] font-medium text-muted-foreground"
        style={label}
      >
        {action.label}
      </Animated.Text>
    </Animated.View>
  )
}
