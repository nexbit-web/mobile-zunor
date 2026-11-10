import * as Haptics from 'expo-haptics'
import { useState, type ReactNode } from 'react'
import {
  Platform,
  Pressable,
  useColorScheme,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Animated, {
  interpolateColor,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnUI } from 'react-native-worklets'

import { Backdrop } from '@/components/ui/backdrop'
import {
  LARGE_TITLE,
  scrollInset,
  useContentTop,
  useHeaderScroll,
} from '@/lib/large-title'
import { useColors } from '@/lib/theme'

export interface SwipeTab<T extends string> {
  key: T
  label: string
  /** Скільки там зараз; 0 чи невідомо — без числа. */
  count?: number
  /** Крапка акценту — там чекають на рішення людини. */
  dot?: boolean
}

/**
 * Що сторінка отримує, щоб лягти під шапку й перемикач: пропси для
 * Animated.FlatList (прокрутка + відступ), `padTop` — у
 * contentContainerStyle, `top` — у progressViewOffset RefreshControl.
 */
export interface PageScroll {
  props: ReturnType<typeof scrollInset>['props'] & {
    onScroll: ReturnType<typeof useAnimatedScrollHandler>
  }
  padTop: number
  top: number
}

// Висота смуги з перемикачем: відступ згори + доріжка + відступ знизу.
const TRACK = 44
const BAR = 4 + TRACK + 10

/** Легке «клацання» — лише на натискання пальцем, не на свайп. */
const tick = () => {
  if (Platform.OS !== 'web') void Haptics.selectionAsync()
}

const clamp = (v: number, max: number) => {
  'worklet'
  return Math.min(Math.max(v, 0), max)
}

/**
 * Розділи екрана, як папки в Telegram: перемикач-доріжка з «повзунком»,
 * під ним сторінки, які гортаються пальцем будь-де на екрані. Повзунок і
 * колір підписів ідуть за пальцем просто під час свайпу (одне значення
 * `progress` на UI-потоці), а не стрибають після нього.
 *
 * Разом із великим заголовком (lib/large-title): перемикач стоїть під
 * назвою екрана, гортаєш сторінку — назва ховається під шапку, а
 * перемикач підіймається й «прилипає» під нею. Фон перемикача —
 * напівпрозорий, як у шапки: разом це один блок, під який заходить список.
 * У кожної сторінки своя прокрутка; під час свайпу між сторінками заголовок
 * плавно переходить від однієї до другої.
 *
 * Свайп від самого лівого краю (48 pt) лишається за бічною панеллю — так
 * само, як у Telegram край екрана повертає назад.
 */
export function SwipeTabs<T extends string>({
  tabs,
  renderPage,
}: {
  tabs: SwipeTab<T>[]
  /** Сторінка розділу; `active` — чи вона зараз на екрані. */
  renderPage: (key: T, active: boolean, scroll: PageScroll) => ReactNode
}) {
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)
  // Дробовий номер сторінки: 0 → 1 → 2, плавно під пальцем.
  const progress = useSharedValue(0)
  const pageWidth = useSharedValue(0)
  const pager = useAnimatedRef<Animated.ScrollView>()

  // Скільки прокручена кожна сторінка — і що з цього бачить шапка.
  const pageY = useSharedValue<number[]>(tabs.map(() => 0))
  const headerY = useHeaderScroll()
  const contentTop = useContentTop()
  const last = tabs.length - 1

  useAnimatedReaction(
    () => {
      const p = clamp(progress.get(), last)
      const i0 = Math.floor(p)
      const i1 = Math.min(i0 + 1, last)
      const ys = pageY.get()
      const a = clamp(ys[i0] ?? 0, LARGE_TITLE)
      const b = clamp(ys[i1] ?? 0, LARGE_TITLE)
      return a + (b - a) * (p - i0)
    },
    (y) => headerY.set(y),
  )

  const setPageY = (i: number, y: number) => {
    'worklet'
    const next = pageY.get().slice()
    next[i] = y
    pageY.set(next)
  }

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const w = pageWidth.get()
      if (w > 0) progress.set(e.contentOffset.x / w)
    },
  })

  // Перемикач їде вгору разом із назвою екрана й зупиняється під шапкою.
  const bar = useAnimatedStyle(() => ({
    transform: [{ translateY: -headerY.get() }],
  }))

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    setWidth(w)
    pageWidth.set(w)
    // Поворот екрана — лишаємось на тій самій сторінці (на першій і так).
    if (index > 0) {
      scheduleOnUI((x: number) => {
        'worklet'
        scrollTo(pager, x, 0, false)
      }, index * w)
    }
  }

  const select = (i: number) => {
    if (i === index) return
    tick()
    setIndex(i)
    scheduleOnUI((x: number) => {
      'worklet'
      scrollTo(pager, x, 0, true)
    }, i * width)
  }

  // Сторінку довели пальцем — лише фіксуємо її. Без «клацання»: рука й
  // так відчуває свайп, вібрація тут зайва.
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    if (i !== index && i >= 0 && i < tabs.length) setIndex(i)
  }

  return (
    <View className="flex-1" onLayout={onLayout}>
      {width > 0 ? (
        <Animated.ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          directionalLockEnabled
          nestedScrollEnabled
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={settle}
          className="flex-1"
        >
          {tabs.map((t, i) => (
            <PageSlot
              key={t.key}
              i={i}
              width={width}
              top={contentTop + BAR}
              setPageY={setPageY}
              render={(scroll) => renderPage(t.key, i === index, scroll)}
            />
          ))}
        </Animated.ScrollView>
      ) : null}

      {/* Поверх сторінок, одразу під великим заголовком: перемикач на
          напівпрозорому фоні. Дотики повз нього проходять до списку. */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          { position: 'absolute', top: contentTop, left: 0, right: 0 },
          bar,
        ]}
      >
        <Backdrop />
        <View className="px-4 pb-2.5 pt-1">
          <Segmented
            tabs={tabs}
            index={index}
            progress={progress}
            onSelect={select}
          />
        </View>
      </Animated.View>
    </View>
  )
}

/** Сторінка: своя прокрутка, що повідомляє, наскільки її прокручено. */
function PageSlot({
  i,
  width,
  top,
  setPageY,
  render,
}: {
  i: number
  width: number
  top: number
  setPageY: (i: number, y: number) => void
  render: (scroll: PageScroll) => ReactNode
}) {
  const inset = scrollInset(top, true)
  const shift = inset.shift
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      setPageY(i, e.contentOffset.y + shift)
    },
  })
  return (
    <View style={{ width }}>
      {render({
        props: { ...inset.props, onScroll },
        padTop: inset.padTop,
        top,
      })}
    </View>
  )
}

/**
 * Доріжка з повзунком, як системний перемикач iOS: без обводки, доріжка —
 * шар вище за фон, повзунок — ще світліший (у світлій темі — білий із
 * легкою тінню).
 */
function Segmented<T extends string>({
  tabs,
  index,
  progress,
  onSelect,
}: {
  tabs: SwipeTab<T>[]
  index: number
  progress: SharedValue<number>
  onSelect: (i: number) => void
}) {
  const dark = useColorScheme() === 'dark'
  const [trackWidth, setTrackWidth] = useState(0)
  const PAD = 3
  const segment = trackWidth ? (trackWidth - PAD * 2) / tabs.length : 0

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * segment }],
  }))

  return (
    <View
      role="tablist"
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      className={`flex-row rounded-full ${dark ? 'bg-card' : 'bg-secondary'}`}
      style={{ height: TRACK, padding: PAD, borderCurve: 'continuous' }}
    >
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: PAD,
              bottom: PAD,
              left: PAD,
              width: segment,
              borderRadius: 999,
              backgroundColor: dark ? '#3a3a3c' : '#ffffff',
              boxShadow: dark
                ? undefined
                : '0 1px 4px rgba(0, 0, 0, 0.10), 0 1px 1px rgba(0, 0, 0, 0.04)',
            },
            thumb,
          ]}
        />
      ) : null}
      {tabs.map((t, i) => (
        <Pressable
          key={t.key}
          role="tab"
          aria-selected={i === index}
          accessibilityLabel={[
            t.label,
            t.count ? String(t.count) : '',
            t.dot ? 'є нові пропозиції' : '',
          ]
            .filter(Boolean)
            .join(', ')}
          onPress={() => onSelect(i)}
          className="flex-1 flex-row items-center justify-center gap-1.5"
        >
          <Label text={t.label} i={i} progress={progress} />
          {t.count ? (
            <Label text={String(t.count)} i={i} progress={progress} faint />
          ) : null}
          {t.dot ? <Dot /> : null}
        </Pressable>
      ))}
    </View>
  )
}

/**
 * Підпис: яскравий над повзунком, сірий осторонь — плавно, за пальцем.
 * `faint` — число поруч із назвою: той самий колір, але тихіше.
 */
function Label({
  text,
  i,
  progress,
  faint = false,
}: {
  text: string
  i: number
  progress: SharedValue<number>
  faint?: boolean
}) {
  const c = useColors()
  const fg = c.foreground
  const muted = c.mutedForeground
  const style = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.get(),
      [i - 1, i, i + 1],
      [muted, fg, muted],
    ),
  }))
  return (
    <Animated.Text
      numberOfLines={1}
      className={faint ? 'text-[14px] font-medium' : 'text-[15px] font-semibold'}
      style={[
        style,
        faint ? { opacity: 0.6, fontVariant: ['tabular-nums'] } : null,
      ]}
    >
      {text}
    </Animated.Text>
  )
}

function Dot() {
  const c = useColors()
  return (
    <View
      className="size-1.75 rounded-full"
      style={{ backgroundColor: c.primary }}
    />
  )
}
