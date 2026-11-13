import {
  useCallback,
  useEffect,
  useRef,
  type ComponentRef,
  type ReactNode,
} from 'react'
import {
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  KEYBOARD_GAP,
  useKeyboardHeight,
} from '@/components/auth/use-keyboard-height'
import { Glyph } from '@/components/icons/glyph'
import { MonoButton } from '@/components/ui/mono-button'
import { HEADER_BAR } from '@/lib/large-title'
import { useColors } from '@/lib/theme'

/** Етап анкети: кілька кроків під однією темою (як на сайті, onboarding/types). */
export interface WizardPhase {
  id: string
  title: string
  /** Що буде на етапі й навіщо — під заголовком заставки. */
  lead: string
  /**
   * Малюнок заставки (кіт-талісман, components/mascot). Є — заставка по
   * центру: малюнок, «Етап N з M», пояснення; заголовок тоді — у малюнку
   * (хмаринка кота), окремо не повторюємо.
   */
  art?: ReactNode
}

/** Крок анкети (копія WizardStep сайту). */
export interface WizardStep {
  id: string
  /** Питання на весь екран: «Як вас звати?», а не «Імʼя». */
  title: string
  /** Навіщо ми це питаємо — одне речення під заголовком. */
  subtitle?: string
  /** Можна пропустити: угорі праворуч — «Пропустити». */
  optional?: boolean
  phase?: string
  /** step — питання; intro — заставка етапу; overview — огляд етапів. */
  kind?: 'step' | 'intro' | 'overview'
}

/** Кожен крок проявляється й ледь піднімається — як екрани входу. */
const STEP_IN = FadeInDown.duration(380)
  .easing(Easing.out(Easing.cubic))
  .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })

type ScrollViewRef = ComponentRef<typeof ScrollView>

/** Поле у фокусі показуємо з запасом: під ним бувають лічильник чи підказка. */
const REVEAL_ABOVE = 16
const REVEAL_BELOW = 32

/**
 * Покрокова анкета — рамка, спільна для замовника й майстра, як на сайті
 * (onboarding-wizard.svelte, подача Airbnb): одне питання на екран,
 * великим шрифтом, «навіщо питаємо» під ним, унизу «Далі» — чорно-біла
 * кнопка, що їде над клавіатурою, як на вході (useKeyboardHeight).
 * Угорі — шеврон «Назад» (перший крок — назад до «Хто ви?»), «Пропустити»
 * на необовʼязкових кроках і смуга прогресу: у майстра — по ЕТАПАХ
 * («другий із трьох» заспокоює краще за «крок 9 з 16»), у замовника —
 * одна. Етапу передує заставка, анкеті майстра — огляд етапів.
 *
 * Рамка нічого не знає про поля: вміст кроку малює батько (`renderStep`),
 * він же перевіряє крок (`validate`: false — лишаємось, помилки під
 * полями батько вже показав) і зберігає анкету (`onSubmit`). Android
 * «назад» — крок назад, як шеврон. Жест «назад» iOS для цих екранів
 * вимкнено (_layout): він кидав би всю анкету, а не крок.
 */
export function Wizard({
  steps,
  phases = [],
  current,
  onStep,
  validate,
  onExit,
  onSubmit,
  submitLabel,
  busy = false,
  submitting = false,
  note,
  error,
  renderStep,
}: {
  steps: readonly WizardStep[]
  phases?: readonly WizardPhase[]
  current: number
  onStep: (index: number) => void
  validate: (id: string) => boolean
  onExit: () => void
  onSubmit: () => void
  submitLabel: string
  /** Іде завантаження фото чи збереження — «Далі» чекає. */
  busy?: boolean
  submitting?: boolean
  /** Пояснення над кнопкою, поки `busy` (напр. «Фото ще завантажується…»). */
  note?: string
  /** Збій збереження — над кнопкою, червоним. */
  error?: string | null
  /** Вміст кроку; `next` — те саме, що «Далі» (для «Далі» на клавіатурі). */
  renderStep: (id: string, next: () => void) => ReactNode
}) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardHeight()

  const active = steps[Math.min(current, steps.length - 1)]
  const kind = active.kind ?? 'step'
  const isLast = current >= steps.length - 1
  const phase = phases.find((p) => p.id === active.phase)
  const phaseNumber = phase ? phases.indexOf(phase) + 1 : 0

  // Відрізок смуги на етап: частка його кроків до поточного включно.
  // Без етапів — один відрізок на всю анкету.
  const progress =
    phases.length === 0
      ? [(current + 1) / steps.length]
      : phases.map((p) => {
          const own = steps.flatMap((s, i) => (s.phase === p.id ? [i] : []))
          return own.length
            ? own.filter((i) => i <= current).length / own.length
            : 0
        })

  function next() {
    if (busy) return
    if (!validate(active.id)) return
    if (isLast) onSubmit()
    else onStep(current + 1)
  }

  // Пропуск не перевіряє крок: він необовʼязковий за визначенням.
  function skip() {
    if (busy) return
    if (isLast) onSubmit()
    else onStep(current + 1)
  }

  function back() {
    if (submitting) return
    if (current === 0) onExit()
    else onStep(current - 1)
  }

  // Android «назад» — завжди свіжий `back` (крок змінюється).
  const backRef = useRef(back)
  backRef.current = back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backRef.current()
      return true
    })
    return () => sub.remove()
  }, [])

  // Поле у фокусі — завжди над кнопкою. Клавіатура піднімає «Далі», і
  // прокрутка кроку нижчає кадр за кадром; багаторядкове поле ще й росте з
  // текстом. Сам iOS до поля не прокручує, а потягнути екран — сховати
  // клавіатуру (on-drag): «Про вас» лишалось під кнопкою (власник). Тож
  // щойно поле (з лічильником під ним) вийшло за край — підкручуємо.
  const scrollRef = useRef<ScrollViewRef | null>(null)
  const scrollY = useRef(0)
  const viewport = useRef(0)
  const contentHeight = useRef(0)
  // Новий крок — новий ScrollView (key): заміри — з нуля.
  const attachScroll = useCallback((node: ScrollViewRef | null) => {
    scrollRef.current = node
    scrollY.current = 0
    viewport.current = 0
    contentHeight.current = 0
  }, [])

  const reveal = useCallback((animated: boolean) => {
    const scroll = scrollRef.current
    const content = scroll?.getInnerViewRef()
    const input = TextInput.State.currentlyFocusedInput()
    if (!scroll || !content || !input || viewport.current <= 0) return
    input.measureLayout(
      content,
      (_x, y, _w, h) => {
        const view = viewport.current
        let to: number
        if (y + h + REVEAL_BELOW > scrollY.current + view)
          to = y + h + REVEAL_BELOW - view
        else if (y - REVEAL_ABOVE < scrollY.current) to = y - REVEAL_ABOVE
        else return
        if (contentHeight.current > 0)
          to = Math.min(to, contentHeight.current - view)
        to = Math.max(0, to)
        if (Math.abs(to - scrollY.current) < 1) return
        scrollY.current = to
        scroll.scrollTo({ y: to, animated })
      },
      () => {},
    )
  }, [])

  // Перейшли з поля на поле при відкритій клавіатурі — висота не мінялась.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => reveal(true))
    return () => sub.remove()
  }, [reveal])

  const spacerStyle = useAnimatedStyle(() => ({
    height: Math.max(keyboard.get() + KEYBOARD_GAP, insets.bottom + 12),
  }))

  const label = isLast ? submitLabel : kind === 'overview' ? 'Почати' : 'Далі'

  return (
    <View className="flex-1 bg-background">
      {/* Шапка: «Назад» і «Пропустити», під ними — смуга прогресу. */}
      <View style={{ paddingTop: insets.top }}>
        <View
          className="flex-row items-center justify-between px-2"
          style={{ height: HEADER_BAR }}
        >
          <Pressable
            onPress={back}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            hitSlop={8}
            className="size-11 items-center justify-center active:opacity-50"
          >
            <Glyph name="back" size={24} color={c.foreground} weight="medium" />
          </Pressable>
          {active.optional && kind === 'step' ? (
            <Pressable
              onPress={skip}
              disabled={busy}
              accessibilityRole="button"
              hitSlop={8}
              className="h-11 justify-center px-3 active:opacity-50"
            >
              <Text className="text-[16px] font-semibold text-muted-foreground">
                Пропустити
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Прогрес анкети"
          accessibilityValue={{ min: 1, max: steps.length, now: current + 1 }}
          className="flex-row gap-1.5 px-6 pt-1"
        >
          {progress.map((share, i) => (
            <Segment key={i} share={share} />
          ))}
        </View>
      </View>

      {/* Новий крок — нова «сторінка»: прокрутка з початку, поява. */}
      <ScrollView
        key={active.id}
        ref={attachScroll}
        onLayout={(e) => {
          viewport.current = e.nativeEvent.layout.height
          reveal(false)
        }}
        onContentSizeChange={(_w, h) => {
          contentHeight.current = h
          reveal(false)
        }}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y
        }}
        scrollEventThrottle={16}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-6"
        contentContainerStyle={{
          paddingTop: kind === 'step' ? 24 : 16,
          paddingBottom: 24,
          // Заставки й огляд — по центру екрана, питання — угорі.
          flexGrow: 1,
          justifyContent: kind === 'step' ? 'flex-start' : 'center',
        }}
      >
        <Animated.View entering={STEP_IN}>
          {kind === 'overview' ? (
            <View>
              <Text
                accessibilityRole="header"
                className="text-[34px] font-semibold leading-[37px] tracking-[-0.8px] text-foreground"
              >
                {active.title}
              </Text>
              <View className="mt-8">
                {phases.map((p, i) => (
                  <View
                    key={p.id}
                    className={`flex-row gap-4 py-5 ${
                      i > 0 ? 'border-t border-border' : ''
                    }`}
                  >
                    <Text className="w-6 text-[20px] font-semibold leading-[25px] text-foreground">
                      {i + 1}
                    </Text>
                    <View className="flex-1 gap-1.5">
                      <Text className="text-[19px] font-semibold leading-[24px] text-foreground">
                        {p.title}
                      </Text>
                      <Text className="text-[15px] leading-[21px] text-muted-foreground">
                        {p.lead}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : kind === 'intro' && phase?.art ? (
            <View className="items-center">
              {phase.art}
              <Text className="mt-7 text-[16px] font-semibold text-muted-foreground">
                Етап {phaseNumber} з {phases.length}
              </Text>
              <Text className="mt-3 text-center text-[17px] leading-[24px] text-muted-foreground">
                {phase.lead}
              </Text>
            </View>
          ) : kind === 'intro' && phase ? (
            <View>
              <Text className="text-[16px] font-semibold text-muted-foreground">
                Етап {phaseNumber} з {phases.length}
              </Text>
              <Text
                accessibilityRole="header"
                className="mt-3 text-[34px] font-semibold leading-[37px] tracking-[-0.8px] text-foreground"
              >
                {phase.title}
              </Text>
              <Text className="mt-4 text-[17px] leading-[24px] text-muted-foreground">
                {phase.lead}
              </Text>
            </View>
          ) : (
            <View>
              <Text
                accessibilityRole="header"
                className="text-[28px] font-semibold leading-[31px] tracking-[-0.6px] text-foreground"
              >
                {active.title}
              </Text>
              {active.subtitle ? (
                <Text className="mt-2.5 text-[16px] leading-[22px] text-muted-foreground">
                  {active.subtitle}
                </Text>
              ) : null}
              <View className="mt-7 gap-4">{renderStep(active.id, next)}</View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View className="gap-2.5 px-6 pt-2">
        {error ? (
          <View
            accessibilityLiveRegion="polite"
            className="flex-row items-center justify-center gap-1.5"
          >
            <Glyph name="alert" size={15} color={c.destructive} />
            <Text className="shrink text-[14px] leading-[19px] text-destructive">
              {error}
            </Text>
          </View>
        ) : busy && !submitting && note ? (
          <Text className="text-center text-[14px] text-muted-foreground">
            {note}
          </Text>
        ) : null}
        <MonoButton
          label={label}
          onPress={next}
          loading={submitting}
          disabled={busy && !submitting}
        />
      </View>
      {/* Прозора й без дотиків: розпірка висотою з клавіатуру. */}
      <Animated.View pointerEvents="none" style={spacerStyle} />
    </View>
  )
}

/** Відрізок смуги прогресу: заповнення їде рівно, без стрибка. */
function Segment({ share }: { share: number }) {
  const fill = useSharedValue(share)
  useEffect(() => {
    fill.set(
      withTiming(share, { duration: 450, easing: Easing.out(Easing.cubic) }),
    )
  }, [share, fill])
  const style = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }))
  return (
    <View className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
      <Animated.View
        className="h-full rounded-full bg-foreground"
        style={style}
      />
    </View>
  )
}
