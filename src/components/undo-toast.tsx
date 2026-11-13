import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import {
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { DockSurface } from '@/components/dock/bottom-dock'
import { DOCK_SIDE } from '@/lib/dock'
import { mixWhite, useColors } from '@/lib/theme'
import { cancelUndo, UNDO_MS, useUndoOffer, type UndoOffer } from '@/lib/undo'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const H = 52
const RING = 26
const STROKE = 2
const R = (RING - STROKE) / 2
const LENGTH = 2 * Math.PI * R

/** Цілі секунди до `until` — 5, 4… 1 (нуля не видно: плашка вже зникла). */
function secondsTo(until: number) {
  return Math.max(1, Math.ceil((until - Date.now()) / 1000))
}

/**
 * Плашка «Видалено · Скасувати» над нижньою панеллю — як у Telegram
 * (скриншот власника): ліворуч кільце, що тане за 5 с, із секундами
 * всередині, текст, праворуч «Скасувати». Дію й відлік веде lib/undo;
 * тут — лише показ. Темна в обох темах (як підказки iOS і Telegram):
 * та сама графітова поверхня, що в нижньої панелі в темній темі.
 * Зʼявляється знизу й гасне плавно, без пружини.
 */
export function UndoToast() {
  const offer = useUndoOffer()
  // Нова дія — нова плашка (key): відлік починається заново.
  return offer ? <Toast key={offer.key} offer={offer} /> : null
}

function Toast({ offer }: { offer: UndoOffer }) {
  const c = useColors()
  const { width } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const w = width - DOCK_SIDE * 2

  const [seconds, setSeconds] = useState(() => secondsTo(offer.until))

  // Кільце тане рівно, від того, скільки лишилось, до нуля.
  const left = useSharedValue((offer.until - Date.now()) / UNDO_MS)
  useEffect(() => {
    left.set(
      withTiming(0, {
        duration: Math.max(0, offer.until - Date.now()),
        easing: Easing.linear,
      }),
    )
    const tick = setInterval(() => setSeconds(secondsTo(offer.until)), 200)
    return () => clearInterval(tick)
  }, [offer.until, left])

  const ring = useAnimatedProps(() => ({
    strokeDashoffset: LENGTH * (1 - left.get()),
  }))

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(260)}
      exiting={FadeOut.duration(180)}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: DOCK_SIDE,
        right: DOCK_SIDE,
        bottom: offer.bottom,
      }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{
          width: w,
          height: H,
          borderRadius: H / 2,
          borderCurve: 'continuous',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <DockSurface width={w} height={H} dark />

        {/* Кільце з секундами — скільки ще можна передумати. */}
        <View
          style={{
            width: RING,
            height: RING,
            marginLeft: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg
            width={RING}
            height={RING}
            style={{
              position: 'absolute',
              transform: [{ rotate: '-90deg' }],
            }}
          >
            <AnimatedCircle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke="#ffffff"
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={LENGTH}
              animatedProps={ring}
            />
          </Svg>
          <Text
            className="text-[13px] font-bold text-white"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {seconds}
          </Text>
        </View>

        <Text
          numberOfLines={1}
          className="ml-3 flex-1 text-[15.5px] font-semibold text-white"
        >
          {offer.text}
        </Text>

        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') void Haptics.selectionAsync()
            cancelUndo()
          }}
          hitSlop={8}
          accessibilityRole="button"
          className="h-full justify-center px-5 active:opacity-50"
        >
          <Text
            className="text-[16px] font-semibold"
            // Акцент, висвітлений до читабельного на темній плашці.
            style={{ color: mixWhite(c.primary, 0.42) }}
          >
            Скасувати
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}
