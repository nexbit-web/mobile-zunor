import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { Bone } from '@/components/ui/skeleton'
import { SQUIRCLE, Tile, TINT } from '@/components/ui/tile'
import { useColors, withAlpha } from '@/lib/theme'
import {
  notificationLabel,
  notificationTime,
  type AppNotification,
} from '@/shared/notifications'

/**
 * Плитка події — системна іконка на кольоровій плитці, як у
 * налаштуваннях iPhone і в Telegram. Колір — впізнаваність події, не
 * тема: зелене — добре (обрали, завершено), червоне — скасовано,
 * помаранчеве — щось змінилось і варто глянути.
 */
const TILES: Record<string, { icon: GlyphName; tint: string }> = {
  NEW_JOB: { icon: 'nJob', tint: TINT.blue },
  NEW_PROPOSAL: { icon: 'nProposal', tint: TINT.indigo },
  PROPOSAL_ACCEPTED: { icon: 'nChosen', tint: TINT.green },
  ORDER_STARTED: { icon: 'nStarted', tint: TINT.orange },
  ORDER_COMPLETED: { icon: 'done', tint: TINT.green },
  ORDER_CANCELLED: { icon: 'nCancelled', tint: TINT.red },
  ORDER_REMINDER: { icon: 'nReminder', tint: TINT.teal },
  JOB_REOPENED: { icon: 'nReopened', tint: TINT.orange },
  JOB_UPDATED: { icon: 'nEdited', tint: TINT.purple },
  VERIFICATION_APPROVED: { icon: 'nVerified', tint: TINT.green },
  VERIFICATION_REJECTED: { icon: 'nRejected', tint: TINT.red },
  REPORT_RESOLVED: { icon: 'nReport', tint: TINT.gray },
}
const FALLBACK = { icon: 'bellFill' as const, tint: TINT.red }

const TILE = 40
const RADIUS = 22
const HAIRLINE = StyleSheet.hairlineWidth * 2
/** Кружок вибору й на скільки зсувається рядок, щоб він став ліворуч. */
const MARK = 24
const SLOT = MARK + 12

/** Режим вибору (як у Telegram): кружки ліворуч, дотик вибирає. */
export interface RowSelect {
  /** 0 — звичайний рядок, 1 — кружок на місці, зміст зсунутий управо. */
  progress: SharedValue<number>
  /** Режим увімкнено: дотик вибирає рядок, а не відкриває. */
  active: boolean
  /** Рядок вибрано. */
  on: boolean
}

/** Кути рядка в згрупованому списку: перший — згори, останній — знизу. */
function corners(first: boolean, last: boolean) {
  return {
    borderTopLeftRadius: first ? RADIUS : 0,
    borderTopRightRadius: first ? RADIUS : 0,
    borderBottomLeftRadius: last ? RADIUS : 0,
    borderBottomRightRadius: last ? RADIUS : 0,
  }
}

/**
 * Рядок сповіщення в картці-групі дня: плитка події (посередині висоти
 * тексту), ярлик і час, жирний заголовок і подробиці сірим. Непрочитане — крапка акценту біля часу й
 * заголовок жирніше; прочитане — тихіше.
 *
 * `select` — режим вибору: зміст плавно зсувається управо, а ліворуч
 * виїжджає кружок (порожній — сірий обідок, вибраний — акцент із
 * галочкою), як у Telegram (скриншот власника).
 */
export function NotificationRow({
  n,
  first,
  last,
  onPress,
  select,
}: {
  n: AppNotification
  first: boolean
  last: boolean
  onPress: () => void
  select?: RowSelect
}) {
  const c = useColors()
  const tile = TILES[n.type] ?? FALLBACK
  const unread = !n.isRead
  const picking = select?.active ?? false
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={picking ? 'checkbox' : 'button'}
      accessibilityState={picking ? { checked: select?.on } : undefined}
      accessibilityLabel={[
        unread ? 'Непрочитане' : '',
        notificationLabel(n.type),
        n.title,
        n.body ?? '',
      ]
        .filter(Boolean)
        .join('. ')}
      className="overflow-hidden bg-card active:bg-secondary"
      style={[SQUIRCLE, corners(first, last)]}
    >
      <View className="flex-row">
        {select ? <SelectSlot progress={select.progress} /> : null}
        <View className="flex-1">
          {/* Плитка — посередині висоти тексту, хоч би який він довгий (так
          попросив власник), а не біля верху. */}
          <View className="flex-row items-center gap-3 px-4 py-3.5">
            <Tile icon={tile.icon} tint={tile.tint} size={TILE} />
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-2">
                <Text
                  numberOfLines={1}
                  className="flex-1 text-[13px] text-muted-foreground"
                >
                  {notificationLabel(n.type)}
                </Text>
                <Text
                  className="text-[13px] text-muted-foreground"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {notificationTime(n.createdAt)}
                </Text>
                {unread ? (
                  <View
                    className="size-2 rounded-full"
                    style={{ backgroundColor: c.primary }}
                  />
                ) : null}
              </View>
              <Text
                numberOfLines={2}
                className={`text-[16px] leading-[21px] tracking-[-0.2px] text-foreground ${
                  unread ? 'font-semibold' : 'font-medium'
                }`}
              >
                {n.title}
              </Text>
              {n.body ? (
                <Text
                  numberOfLines={2}
                  className="text-[14.5px] leading-[20px] text-muted-foreground"
                >
                  {n.body}
                </Text>
              ) : null}
            </View>
          </View>
          {/* Лінія між рядками — від тексту, як у списках iOS. */}
          {last ? null : (
            <View
              className="bg-border"
              style={{ height: HAIRLINE, marginLeft: 16 + TILE + 12 }}
            />
          )}
        </View>
        {select ? (
          <SelectMark progress={select.progress} on={select.on} />
        ) : null}
      </View>
    </Pressable>
  )
}

/** Місце під кружок: зміст рядка плавно відʼїжджає управо. */
function SelectSlot({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ width: progress.get() * SLOT }))
  return <Animated.View style={style} />
}

/**
 * Кружок вибору біля лівого краю картки: виїжджає з-за краю разом зі
 * зсувом змісту; вибраний — заливка акценту з галочкою (проявляється).
 */
function SelectMark({
  progress,
  on,
}: {
  progress: SharedValue<number>
  on: boolean
}) {
  const c = useColors()
  const reduceMotion = useReducedMotion()
  const fill = useSharedValue(on ? 1 : 0)
  useEffect(() => {
    fill.set(
      reduceMotion
        ? on
          ? 1
          : 0
        : withTiming(on ? 1 : 0, {
            duration: 160,
            easing: Easing.out(Easing.cubic),
          }),
    )
  }, [on, reduceMotion, fill])
  const mark = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateX: (progress.get() - 1) * (16 + MARK) }],
  }))
  const filled = useAnimatedStyle(() => ({ opacity: fill.get() }))
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 16,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          {
            width: MARK,
            height: MARK,
            borderRadius: MARK / 2,
            borderWidth: 1.5,
            borderColor: withAlpha(c.mutedForeground, 0.7),
          },
          mark,
        ]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: -1.5,
              left: -1.5,
              width: MARK,
              height: MARK,
              borderRadius: MARK / 2,
              backgroundColor: c.primary,
              alignItems: 'center',
              justifyContent: 'center',
            },
            filled,
          ]}
        >
          <Glyph
            name="check"
            size={13}
            color={c.primaryForeground}
            weight="bold"
          />
        </Animated.View>
      </Animated.View>
    </View>
  )
}

/** Скелетон групи, поки стрічка вперше вантажиться. */
export function NotificationSkeleton({ rows = 4 }: { rows?: number }) {
  const reduceMotion = useReducedMotion()
  const pulse = useSharedValue(1)
  useEffect(() => {
    if (reduceMotion) return
    pulse.set(
      withRepeat(
        withTiming(0.45, { duration: 850, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    )
    return () => cancelAnimation(pulse)
  }, [reduceMotion, pulse])
  const style = useAnimatedStyle(() => ({ opacity: pulse.get() }))

  return (
    <View
      className="gap-2"
      accessibilityLabel="Завантаження"
      accessibilityRole="progressbar"
    >
      <View className="px-4 pb-1 pt-1">
        <Animated.View style={style}>
          <Bone width={74} height={11} />
        </Animated.View>
      </View>
      <View className="overflow-hidden rounded-[22px] bg-card" style={SQUIRCLE}>
        <Animated.View style={style}>
          {Array.from({ length: rows }, (_, i) => (
            <View key={i}>
              <View className="flex-row gap-3 px-4 py-3.5">
                <Bone width={TILE} height={TILE} radius={11} />
                <View className="flex-1 gap-2 pt-0.5">
                  <Bone width="34%" height={10} />
                  <Bone width={i % 2 ? '70%' : '86%'} height={14} />
                  <Bone width="58%" height={11} />
                </View>
              </View>
              {i < rows - 1 ? (
                <View
                  className="bg-border"
                  style={{ height: HAIRLINE, marginLeft: 16 + TILE + 12 }}
                />
              ) : null}
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  )
}
