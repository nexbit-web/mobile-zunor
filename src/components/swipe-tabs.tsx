import * as Haptics from 'expo-haptics'
import { useNavigation } from 'expo-router'
import { useLayoutEffect, useState, type ReactNode } from 'react'
import {
  Platform,
  Pressable,
  Text,
  useColorScheme,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnUI } from 'react-native-worklets'

import { EmptyStateInset } from '@/components/empty-state'
import { HeaderFade } from '@/components/ui/header-fade'
import { PullIndicator, refreshLook } from '@/components/ui/pull-indicator'
import { YieldToDrawer } from '@/components/ui/yield-to-drawer'
import { useDrawerEdgeOnly } from '@/lib/drawer-swipe'
import {
  HEADER_BAR,
  scrollInset,
  useContentBottom,
  useContentTop,
  useHeaderScroll,
} from '@/lib/large-title'
import { useColors, withAlpha } from '@/lib/theme'

export interface SwipeTab<T extends string> {
  key: T
  label: string
  /** Скільки там зараз; 0 чи невідомо — без числа. */
  count?: number
  /**
   * Число на суцільному акценті, а не сіре: там іде справа чи чекають на
   * рішення людини (активні замовлення, заявки з пропозиціями).
   */
  accent?: boolean
}

/**
 * Що сторінка отримує, щоб лягти під шапку й перемикач: пропси для
 * Animated.FlatList (прокрутка + відступ), `padTop` — у
 * contentContainerStyle, `refresh` — у свій RefreshControl (на iOS він
 * невидимий: малює PullIndicator), `top` — де починається зміст.
 */
export interface PageScroll {
  props: ReturnType<typeof scrollInset>['props'] & {
    onScroll: ReturnType<typeof useAnimatedScrollHandler>
  }
  padTop: number
  /** Знизу — кінець списку над панеллю вкладок (lib/large-title). */
  padBottom: number
  /**
   * iOS: відступ прокрутки згори (contentInset), 0 — деінде. Ставити
   * змістові `marginBottom` на стільки ж (lib/large-title, scrollInset).
   */
  shift: number
  top: number
  refresh: ReturnType<typeof refreshLook>
}

// Висота смуги з перемикачем: відступ згори + доріжка + відступ знизу.
const TRACK = 44
const BAR = 4 + TRACK + 10
// У спокої перемикач стоїть у змісті сторінки на GAP нижче шапки;
// прокрутка спершу везе його вгору разом зі списком,
// а під шапкою він «прилипає». Тло під ним проявляється за FADE pt
// після того, як під нього почав заходити список.
const GAP = 8
const FADE = 12
/** На скільки тло (розмиття й затемнення) сягає нижче прилиплої доріжки. */
const BELOW_TRACK = 12

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
 * Перемикач — частина сторінки, а не шапки: у спокої лежить просто на
 * фоні під шапкою. Гортаєш — він їде вгору разом зі списком і «прилипає»
 * під шапкою, сам по собі, без смуги-підкладки (як «Подати пропозицію»
 * на заявці): під ним лише тло шапки (HeaderFade) від верху екрана до
 * трохи нижче доріжки — зміст заходить під перемикач і далі під шапку,
 * плавно розмиваючись і темнішаючи до краю екрана, як у Telegram.
 * Скляна смуга під ним зливалась із шапкою в один великий блок, а щільна
 * заливка не давала змістові «піти» під шапку — обидва власник попросив
 * прибрати. Один на всі сторінки (лежить поверх них),
 * тож повзунок іде за пальцем і під час свайпу.
 * У кожної сторінки своя прокрутка; під час свайпу між сторінками
 * перемикач плавно переходить від однієї до другої.
 *
 * Бічна панель клієнта: на першому розділі її відкриває свайп управо з
 * лівої чверті екрана, на інших — лише від самого лівого краю (48 pt), а
 * деінде свайп управо гортає до попереднього розділу.
 */
export function SwipeTabs<T extends string>({
  tabs,
  renderPage,
  refreshing = false,
}: {
  tabs: SwipeTab<T>[]
  /** Сторінка розділу; `active` — чи вона зараз на екрані. */
  renderPage: (key: T, active: boolean, scroll: PageScroll) => ReactNode
  /** Іде оновлення, яке людина запустила, потягнувши список. */
  refreshing?: boolean
}) {
  const c = useColors()
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)
  // Бічна панель клієнта відкривається свайпом управо з лівої чверті
  // екрана — але лише на першому розділі; на інших свайп управо гортає до
  // попереднього, а панель — лише від самого краю (lib/drawer-swipe).
  useDrawerEdgeOnly(index > 0)
  // Дробовий номер сторінки: 0 → 1 → 2, плавно під пальцем.
  const progress = useSharedValue(0)
  const pageWidth = useSharedValue(0)
  const pager = useAnimatedRef<Animated.ScrollView>()

  // Скільки прокручена кожна сторінка — і що з цього бачить шапка.
  const pageY = useSharedValue<number[]>(tabs.map(() => 0))
  const contentTop = useContentTop()
  const contentBottom = useContentBottom()
  // Низ шапки. Прокрутка відступає лише на неї, а перемикач і список —
  // одна сторінка: потягнеш — з'їжджають униз разом, і під шапкою
  // відкривається місце для індикатора оновлення.
  const headerBottom = useSafeAreaInsets().top + HEADER_BAR
  const pagePad = contentTop - headerBottom + GAP + BAR
  const last = tabs.length - 1
  // Скільки перемикач їде до «прилипання» під шапкою.
  const stick = GAP
  // Прокрутка поточної сторінки (між сторінками — плавно), обрізана
  // згори там, де далі вже нічого не змінюється. Від'ємна — сторінку
  // тягнуть униз, щоб оновити.
  const barY = useSharedValue(0)
  // Те саме — шапці: велика назва майстра стає маленькою по центру.
  const headerY = useHeaderScroll()
  // Тло шапки тут малює SwipeTabs — одне до перемикача включно; своє
  // шапка лише наклала б зверху вдруге.
  const navigation = useNavigation()
  useLayoutEffect(() => {
    navigation.setOptions({ headerShadowVisible: false })
  }, [navigation])

  useAnimatedReaction(
    () => {
      const p = clamp(progress.get(), last)
      const i0 = Math.floor(p)
      const i1 = Math.min(i0 + 1, last)
      const ys = pageY.get()
      const a = Math.min(ys[i0] ?? 0, stick + FADE)
      const b = Math.min(ys[i1] ?? 0, stick + FADE)
      return a + (b - a) * (p - i0)
    },
    (y) => {
      barY.set(y)
      headerY.set(y)
    },
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

  // Перемикач їде разом зі списком (і вниз, коли тягнуть) і зупиняється
  // під шапкою.
  const bar = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(barY.get(), stick) }],
  }))
  // Згасання під ним — лише коли під перемикач заходить список.
  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(
      barY.get(),
      [stick, stick + FADE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
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

  // Сторінку довели пальцем — лише фіксуємо її. Без «клацання»: так
  // попросив власник — вібрація тут лише на натиск.
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    if (i !== index && i >= 0 && i < tabs.length) setIndex(i)
  }

  return (
    <View className="flex-1" onLayout={onLayout}>
      {width > 0 ? (
        // Свайп управо біля лівого краю — бічній панелі, навіть на
        // перемикачі й картках (ui/yield-to-drawer).
        <YieldToDrawer>
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
                inset={headerBottom}
                pad={pagePad}
                padBottom={contentBottom}
                // iOS: системне «колесо» невидиме — малює PullIndicator.
                // Android: матеріальне коло під перемикачем (сторінка там
                // не з'їжджає).
                refresh={refreshLook(c, headerBottom + pagePad)}
                setPageY={setPageY}
                render={(scroll) => renderPage(t.key, i === index, scroll)}
              />
            ))}
          </Animated.ScrollView>
        </YieldToDrawer>
      ) : null}

      {Platform.OS === 'ios' ? (
        <PullIndicator
          y={barY}
          top={headerBottom}
          // Між шапкою й доріжкою перемикача вже є відступ.
          offset={GAP + 4}
          refreshing={refreshing}
        />
      ) : null}

      {/* Тло шапки й перемикача — одне, від верху екрана до трохи нижче
          прилиплої доріжки (шапка тут свого не малює). Лише коли під
          перемикач заходить список: у спокої й коли тягнуть оновити —
          без нього, інакше розмивався б індикатор оновлення. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: contentTop + 4 + TRACK + BELOW_TRACK,
          },
          fade,
        ]}
      >
        <HeaderFade height={contentTop + 4 + TRACK + BELOW_TRACK} />
      </Animated.View>

      {/* Поверх сторінок, але виглядає частиною сторінки: без підкладки ні
          в спокої, ні прилиплим. Дотики повз нього проходять до списку. */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          { position: 'absolute', top: contentTop + GAP, left: 0, right: 0 },
          bar,
        ]}
      >
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

/**
 * Сторінка: своя прокрутка, що повідомляє, наскільки її прокручено.
 * `inset` — відступ прокрутки (низ шапки), `pad` — ще стільки змісту
 * згори під перемикач, що їде разом зі сторінкою.
 */
function PageSlot({
  i,
  width,
  inset: top,
  pad,
  padBottom,
  refresh,
  setPageY,
  render,
}: {
  i: number
  width: number
  inset: number
  pad: number
  padBottom: number
  refresh: PageScroll['refresh']
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
      {/* Порожній стан сторінки — посередині екрана з поправкою на
          contentInset (empty-state). */}
      <EmptyStateInset value={shift}>
        {render({
          props: {
            ...inset.props,
            // Смуга прокрутки — від перемикача, а не з-під нього.
            ...(Platform.OS === 'ios'
              ? { scrollIndicatorInsets: { top: top + pad } }
              : null),
            onScroll,
          },
          padTop: inset.padTop + pad,
          padBottom,
          shift,
          top: top + pad,
          refresh,
        })}
      </EmptyStateInset>
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
          accessibilityLabel={t.count ? `${t.label}, ${t.count}` : t.label}
          onPress={() => onSelect(i)}
          className="flex-1 flex-row items-center justify-center gap-1.5"
        >
          <Label text={t.label} i={i} progress={progress} />
          {t.count ? <Count n={t.count} accent={t.accent} /> : null}
        </Pressable>
      ))}
    </View>
  )
}

/** Підпис: яскравий над повзунком, сірий осторонь — плавно, за пальцем. */
function Label({
  text,
  i,
  progress,
}: {
  text: string
  i: number
  progress: SharedValue<number>
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
      className="text-[15px] font-semibold"
      style={style}
    >
      {text}
    </Animated.Text>
  )
}

/**
 * Число біля назви — пігулкою: сіра — просто «скільки», суцільний акцент —
 * там іде справа (`accent`), як лічильник непрочитаних у Telegram.
 */
function Count({ n, accent = false }: { n: number; accent?: boolean }) {
  const c = useColors()
  const dark = useColorScheme() === 'dark'
  return (
    <View
      className="h-5 min-w-5 items-center justify-center rounded-full px-1.5"
      style={{
        backgroundColor: accent
          ? c.primary
          : withAlpha(c.mutedForeground, dark ? 0.3 : 0.16),
      }}
    >
      <Text
        className="text-[12px] font-semibold"
        style={{
          color: accent
            ? c.primaryForeground
            : dark
              ? c.foreground
              : c.mutedForeground,
          fontVariant: ['tabular-nums'],
        }}
      >
        {n > 99 ? '99+' : n}
      </Text>
    </View>
  )
}
