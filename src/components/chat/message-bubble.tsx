import { Image } from 'expo-image'
import * as WebBrowser from 'expo-web-browser'
import { memo, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { Glyph } from '@/components/icons/glyph'
import { useColors, withAlpha } from '@/lib/theme'
import {
  linkify,
  messageSummary,
  messageTime,
  type ChatMessage,
} from '@/shared/chat'

import { Ticks } from './ticks'

/** Стан свого повідомлення: на сервері, ще йде чи не дійшло. */
export type DeliveryState = 'sent' | 'sending' | 'failed'

/** Пропорції фото за адресою — щоб бульбашка не стрибала при повторі. */
const RATIOS = new Map<string, number>()

/**
 * Мініатюра з Cloudinary: не оригінал на 5 МБ, а до 720 px по ширині.
 * Локальне фото (ще вантажиться) — як є.
 */
function thumb(url: string): string {
  return url.includes('/image/upload/')
    ? url.replace('/image/upload/', '/image/upload/c_limit,w_720,q_auto,f_auto/')
    : url
}

function fileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
}

/**
 * Бульбашка повідомлення, як у Telegram: свої — праворуч кольору
 * акценту, співрозмовника — ліворуч білі на шпалерах світлої теми (як
 * `--bubble-in` на сайті), сірі — у темній. Час, «ред.» і галочки — у
 * нижньому правому куті останнього рядка (під них у тексті лишаємо
 * невидиме місце). Цитата відповіді, фото, файл, картка посилання й
 * реакції — усередині бульбашки. Довгий дотик — меню повідомлення.
 *
 * `first` / `last` — повідомлення в серії одного автора: між ними
 * менший відступ, а кут з боку автора — гостріший.
 */
export const MessageBubble = memo(function MessageBubble({
  m,
  mine,
  read,
  state = 'sent',
  first,
  last,
  peerName,
  me,
  onLongPress,
  onOpenPhoto,
  onQuote,
  onReact,
  onFailedPress,
}: {
  m: ChatMessage
  mine: boolean
  /** Співрозмовник уже прочитав (✓✓). */
  read: boolean
  state?: DeliveryState
  first: boolean
  last: boolean
  peerName: string
  me: string
  onLongPress: (m: ChatMessage) => void
  onOpenPhoto: (url: string) => void
  onQuote: (id: string) => void
  onReact: (m: ChatMessage, emoji: string) => void
  onFailedPress: (m: ChatMessage) => void
}) {
  const c = useColors()
  const dark = useColorScheme() === 'dark'
  const { width } = useWindowDimensions()
  const deleted = Boolean(m.deletedAt)
  const fg = mine ? c.primaryForeground : c.foreground
  const meta = mine ? withAlpha(c.primaryForeground, 0.72) : c.mutedForeground
  const reactions = deleted ? [] : (m.reactions ?? [])
  const photo = !deleted && m.type === 'PHOTO' && m.attachmentUrl
  const photoOnly = Boolean(photo) && !m.text && !m.replyTo
  const time = messageTime(m.createdAt)
  const edited = Boolean(m.editedAt) && !deleted

  // Кут з боку автора — гостріший усередині серії (як у Telegram).
  const R = 18
  const r = 6
  const radius = mine
    ? {
        borderTopLeftRadius: R,
        borderBottomLeftRadius: R,
        borderTopRightRadius: first ? R : r,
        borderBottomRightRadius: last ? R : r,
      }
    : {
        borderTopRightRadius: R,
        borderBottomRightRadius: R,
        borderTopLeftRadius: first ? R : r,
        borderBottomLeftRadius: last ? R : r,
      }

  const metaFor = (color: string) => (
    <View className="flex-row items-center gap-1">
      {edited ? (
        <Text className="text-[12px]" style={{ color }}>
          ред.
        </Text>
      ) : null}
      <Text
        className="text-[12px]"
        style={{ color, fontVariant: ['tabular-nums'] }}
      >
        {time}
      </Text>
      {mine ? (
        state === 'sending' ? (
          <Glyph name="clock" size={11} color={color} />
        ) : state === 'sent' ? (
          // key — щоб ✓ → ✓✓ теж проявлялись, а не перемикались.
          <Animated.View key={read ? 'read' : 'sent'} entering={FadeIn.duration(200)}>
            <Ticks read={read} color={color} size={15} />
          </Animated.View>
        ) : null
      ) : null}
    </View>
  )
  const metaRow = metaFor(meta)

  // Невидимий «хвіст» тексту завширшки з час і галочки: під них
  // переноситься останній рядок, і час не налазить на слова.
  const spacer = (
    <Text style={{ fontSize: 12, color: 'transparent' }}>
      {` ${edited ? 'ред. ' : ''}${time}${mine ? '  ' : ''}`}
    </Text>
  )
  const inlineMeta = reactions.length === 0

  const bubbleMax = Math.min(width * 0.78, 420)
  const photoW = Math.min(width * 0.68, 300)

  return (
    <View
      className={`flex-row items-center ${mine ? 'justify-end' : 'justify-start'}`}
      style={{ marginTop: first ? 8 : 2 }}
    >
      {mine && state === 'failed' ? (
        <Pressable
          onPress={() => onFailedPress(m)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Не надіслано. Дії"
          className="mr-2"
        >
          <Glyph name="failed" size={22} color={c.destructive} />
        </Pressable>
      ) : null}

      <Pressable
        onLongPress={() => !deleted && state === 'sent' && onLongPress(m)}
        delayLongPress={280}
        accessibilityHint="Довгий дотик — дії з повідомленням"
        style={[
          radius,
          {
            maxWidth: bubbleMax,
            backgroundColor: mine ? c.primary : dark ? c.secondary : '#ffffff',
            overflow: 'hidden',
            borderCurve: 'continuous',
          },
        ]}
      >
        {/* ─── Цитата ─── */}
        {m.replyTo && !deleted ? (
          <Pressable
            onPress={() => onQuote(m.replyTo!.id)}
            className="mx-1.5 mt-1.5 flex-row overflow-hidden rounded-[10px]"
            style={{
              backgroundColor: withAlpha(mine ? c.primaryForeground : c.primary, 0.14),
            }}
          >
            <View
              style={{
                width: 3,
                backgroundColor: mine ? c.primaryForeground : c.primary,
              }}
            />
            <View className="flex-1 px-2 py-1">
              <Text
                numberOfLines={1}
                className="text-[13px] font-semibold"
                style={{ color: mine ? c.primaryForeground : c.primary }}
              >
                {m.replyTo.senderId === me ? 'Ви' : peerName}
              </Text>
              <Text numberOfLines={1} className="text-[14.5px]" style={{ color: fg }}>
                {m.replyTo.text ? messageSummary(m.replyTo) : 'Повідомлення видалено'}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* ─── Фото ─── */}
        {photo ? (
          <BubblePhoto
            url={m.attachmentUrl as string}
            width={photoW}
            uploading={state === 'sending'}
            onPress={() => onOpenPhoto(m.attachmentUrl as string)}
            onLongPress={() => !deleted && state === 'sent' && onLongPress(m)}
            inset={!photoOnly}
            // Час поверх фото — білий на темній плашці.
            meta={photoOnly ? metaFor('#ffffff') : null}
          />
        ) : null}

        {/* ─── Файл ─── */}
        {!deleted && m.type === 'FILE' && m.attachmentUrl ? (
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync(m.attachmentUrl as string)}
            className="flex-row items-center gap-2.5 px-3 pt-2.5"
          >
            <View
              className="size-11 items-center justify-center rounded-full"
              style={{ backgroundColor: mine ? withAlpha(c.primaryForeground, 0.2) : c.primary }}
            >
              <Glyph name="file" size={19} color="#ffffff" />
            </View>
            <View className="shrink">
              <Text numberOfLines={1} className="text-[15px] font-medium" style={{ color: fg }}>
                {m.attachmentName || 'Файл'}
              </Text>
              <Text className="text-[12.5px]" style={{ color: meta }}>
                {fileSize(m.attachmentSize) || 'Відкрити'}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* ─── Текст ─── 17,5 pt, як у Telegram (16 було замало — власник). */}
        {deleted ? (
          <Text className="px-3 pb-1.5 pt-1.5 text-[17px] italic" style={{ color: meta }}>
            Повідомлення видалено{spacer}
          </Text>
        ) : m.text ? (
          <Text
            className="px-3 pb-1.5 pt-1.5 text-[17.5px] leading-[23px]"
            style={{ color: fg }}
          >
            {linkify(m.text).map((part, i) =>
              part.kind === 'link' ? (
                <Text
                  key={i}
                  onPress={() => void WebBrowser.openBrowserAsync(part.href)}
                  style={{
                    color: mine ? c.primaryForeground : c.primary,
                    textDecorationLine: 'underline',
                  }}
                >
                  {part.value}
                </Text>
              ) : (
                part.value
              ),
            )}
            {inlineMeta ? spacer : null}
          </Text>
        ) : !photoOnly ? (
          <View className="h-6" />
        ) : null}

        {/* ─── Картка посилання ─── */}
        {!deleted && m.linkPreview ? (
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync(m.linkPreview!.url)}
            className="mx-2 mb-1.5 flex-row overflow-hidden rounded-[10px]"
            style={{
              backgroundColor: withAlpha(mine ? c.primaryForeground : c.primary, 0.12),
            }}
          >
            <View
              style={{ width: 3, backgroundColor: mine ? c.primaryForeground : c.primary }}
            />
            <View className="flex-1 gap-0.5 px-2 py-1.5">
              <Text
                numberOfLines={1}
                className="text-[13px] font-semibold"
                style={{ color: mine ? c.primaryForeground : c.primary }}
              >
                {m.linkPreview.siteName}
              </Text>
              <Text numberOfLines={2} className="text-[15px] font-semibold" style={{ color: fg }}>
                {m.linkPreview.title}
              </Text>
              {m.linkPreview.description ? (
                <Text numberOfLines={3} className="text-[14.5px]" style={{ color: fg }}>
                  {m.linkPreview.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ) : null}

        {/* ─── Реакції ─── */}
        {reactions.length > 0 ? (
          <View className="flex-row flex-wrap items-center gap-1.5 px-2 pb-2 pt-0.5">
            {reactions.map((g) => {
              const minePick = g.userIds.includes(me)
              return (
                <Pressable
                  key={g.emoji}
                  onPress={() => onReact(m, g.emoji)}
                  accessibilityRole="button"
                  accessibilityLabel={`Реакція ${g.emoji}`}
                  className="h-7 flex-row items-center gap-1 rounded-full px-2"
                  style={{
                    backgroundColor: minePick
                      ? mine
                        ? withAlpha(c.primaryForeground, 0.9)
                        : c.primary
                      : withAlpha(mine ? c.primaryForeground : c.foreground, mine ? 0.2 : 0.08),
                  }}
                >
                  <Text className="text-[15px]">{g.emoji}</Text>
                  {g.userIds.length > 1 ? (
                    <Text
                      className="text-[13px] font-semibold"
                      style={{
                        color: minePick ? (mine ? c.primary : c.primaryForeground) : fg,
                      }}
                    >
                      {g.userIds.length}
                    </Text>
                  ) : null}
                </Pressable>
              )
            })}
            <View className="ml-auto pl-2">{metaRow}</View>
          </View>
        ) : null}

        {/* Час — у кутку останнього рядка (місце під нього — spacer). */}
        {inlineMeta && !photoOnly ? (
          <View className="absolute bottom-1.5 right-2.5">{metaRow}</View>
        ) : null}
      </Pressable>
    </View>
  )
})

/** Фото в бульбашці: пропорції — від самого знімка, у межах 0,6…1,6. */
function BubblePhoto({
  url,
  width,
  uploading,
  onPress,
  onLongPress,
  inset,
  meta,
}: {
  url: string
  width: number
  uploading: boolean
  onPress: () => void
  onLongPress: () => void
  /** З підписом чи цитатою — з полями всередині бульбашки. */
  inset: boolean
  /** Фото без підпису — час поверх нього, на темній плашці. */
  meta: ReactNode
}) {
  const [ratio, setRatio] = useState(RATIOS.get(url) ?? 1)
  const w = inset ? width - 6 : width
  const h = w / Math.min(1.6, Math.max(0.6, ratio))
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      accessibilityRole="imagebutton"
      accessibilityLabel="Фото"
      style={inset ? { margin: 3, marginBottom: 0 } : undefined}
    >
      <Image
        source={thumb(url)}
        contentFit="cover"
        transition={150}
        onLoad={(e) => {
          const next = e.source.width / e.source.height
          if (next > 0 && Number.isFinite(next)) {
            RATIOS.set(url, next)
            setRatio(next)
          }
        }}
        style={{
          width: w,
          height: h,
          borderRadius: inset ? 15 : 0,
          backgroundColor: 'rgba(127, 127, 127, 0.15)',
        }}
      />
      {uploading ? (
        <View className="absolute inset-0 items-center justify-center">
          <View
            className="size-12 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          >
            <ActivityIndicator color="#ffffff" />
          </View>
        </View>
      ) : null}
      {meta ? (
        <View
          className="absolute bottom-2 right-2 rounded-full px-2 py-0.5"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
        >
          {meta}
        </View>
      ) : null}
    </Pressable>
  )
}
