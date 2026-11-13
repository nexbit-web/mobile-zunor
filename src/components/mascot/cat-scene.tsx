import LottieView from 'lottie-react-native'
import { useEffect } from 'react'
import { Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import catDress from '@/assets/animations/cat-dress.json'
import catHello from '@/assets/animations/cat-hello.json'
import catLock from '@/assets/animations/cat-lock.json'
import catShow from '@/assets/animations/cat-show.json'
import catThink from '@/assets/animations/cat-think.json'

/**
 * Сцени кота (scripts/mascot/build.mjs): полотно `w×h` — FRAME сцени,
 * `width` — ширина на екрані (не ширша за екран мінус поля).
 */
const SCENES = {
  /** «Познайомимось»: сидить, усміхається, каже. */
  hello: { source: catHello, w: 740, h: 690, width: 250, bubble: 'speech' },
  /** «Яку роботу берете»: лапка під підборіддям, відро чи пульверизатор? */
  think: { source: catThink, w: 1070, h: 690, width: 340, bubble: 'thought' },
  /** «Покажіть себе клієнтам»: показує свій профіль на планшеті. */
  show: { source: catShow, w: 740, h: 690, width: 250, bubble: 'speech' },
  /**
   * «Безпека» в налаштуваннях: кіт-грабіжник у масці не може відімкнути
   * замок. Невелика картинка вгорі екрана, без хмаринки.
   */
  lock: { source: catLock, w: 870, h: 690, width: 210, bubble: 'speech' },
  /**
   * «Вигляд» у налаштуваннях: за котом крутяться кружечки кольорів —
   * обрав, і кіт міняє стиль (леопард, рокер, лев). Нерухомий кадр —
   * леопард із розплющеними очима (на 0 — саме зміна, очі заплющені).
   */
  dress: {
    source: catDress,
    w: 680,
    h: 804,
    width: 180,
    bubble: 'speech',
    still: 0.125,
  },
} as const satisfies Record<
  string,
  {
    source: object
    w: number
    h: number
    width: number
    bubble: 'speech' | 'thought'
    still?: number
  }
>

export type CatSceneName = keyof typeof SCENES

/**
 * Хмаринка — частина малюнка-наліпки, а не інтерфейсу: біла з контуром
 * кольору контуру кота в обох темах (тому не токени теми).
 */
const INK = '#380c1e'
const PAPER = '#ffffff'

/**
 * Рудий кіт-талісман на заставці етапу анкети: кіт по центру, над ним
 * хмаринка з `say` — заголовок екрана для читача. Кіт живий, але
 * спокійно: дихає, кліпає, хилить голову, смикає вухом, водить хвостом —
 * рівно, без пружин. Хмаринка «вилазить» трохи згодом: проявляється й
 * підростає від хвостика. `speech` — хвостик-трикутник (каже), `thought`
 * — кружечки (думає). «Зменшити рух» — кіт нерухомий, хмаринка одразу.
 * Без `say` — лише кіт, прикраса (читачу екрана його не видно).
 */
export function CatScene({
  scene,
  say,
}: {
  scene: CatSceneName
  say?: string
}) {
  const def = SCENES[scene]
  const { width: screen } = useWindowDimensions()
  const width = Math.min(def.width, screen - 48)
  const reduceMotion = useReducedMotion()
  const shown = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    if (reduceMotion) return
    shown.set(
      withDelay(
        350,
        withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }),
      ),
    )
  }, [reduceMotion, shown])

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [
      { translateY: (1 - shown.get()) * 12 },
      { scale: 0.6 + 0.4 * shown.get() },
    ],
  }))

  const lottie = (
    <LottieView
      source={def.source}
      autoPlay={!reduceMotion}
      loop
      progress={reduceMotion ? ('still' in def ? def.still : 0) : undefined}
      style={{
        width,
        height: (width * def.h) / def.w,
        marginTop: say ? -4 : 0,
      }}
    />
  )

  if (!say)
    return (
      <View
        className="items-center"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {lottie}
      </View>
    )

  return (
    <View className="items-center">
      <Animated.View
        style={[
          { transformOrigin: 'bottom', alignItems: 'center' },
          bubbleStyle,
        ]}
      >
        <View
          style={{
            backgroundColor: PAPER,
            borderColor: INK,
            borderWidth: 3,
            borderRadius: def.bubble === 'thought' ? 28 : 22,
            borderCurve: 'continuous',
            paddingHorizontal: 22,
            paddingVertical: 11,
          }}
        >
          <Text
            accessibilityRole="header"
            className="text-center text-[22px] font-bold tracking-[-0.3px]"
            style={{ color: INK }}
          >
            {say}
          </Text>
        </View>
        {def.bubble === 'speech' ? (
          // Хвостик: заливка закриває рамку хмаринки там, де він виходить.
          <Svg width={30} height={17} style={{ marginTop: -3 }}>
            <Path
              d="M2 0 L15 14 L28 0"
              fill={PAPER}
              stroke={INK}
              strokeWidth={3}
              strokeLinejoin="round"
            />
          </Svg>
        ) : (
          // Думка: два кружечки від голови до хмаринки.
          <View style={{ alignItems: 'center', height: 30 }}>
            <Dot size={15} style={{ marginTop: 4, marginLeft: -14 }} />
            <Dot size={10} style={{ marginTop: 2, marginLeft: -30 }} />
          </View>
        )}
      </Animated.View>
      {lottie}
    </View>
  )
}

function Dot({ size, style }: { size: number; style: object }) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: PAPER,
          borderColor: INK,
          borderWidth: 2.5,
        },
        style,
      ]}
    />
  )
}
