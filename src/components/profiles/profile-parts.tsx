import { Image } from 'expo-image'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Glyph } from '@/components/icons/glyph'
import { GroupLabel } from '@/components/jobs/job-details'
import { Avatar } from '@/components/ui/avatar'
import { Bone, SectionSkeleton, Skeleton } from '@/components/ui/skeleton'
import { SQUIRCLE } from '@/components/ui/tile'
import { useColors } from '@/lib/theme'
import { pluralUk } from '@/shared/format'
import { memberSince } from '@/shared/jobs'
import { formatRating, type ProfileReview } from '@/shared/profiles'

// Шматки профілю другої сторони (майстра — клієнтові, клієнта —
// майстрові) — у згрупованій подачі заявки й замовлення: шапка по центру
// (фото, імʼя, хто й звідки), три цифри, розділи з підписами, відгуки
// картками. Та сама будова, що на сторінках сайту.

/** Жовта зірка рейтингу — як у картках заявок і замовлень. */
export const STAR = '#fbbf24'

/** «Одеса · на Zunor з лист. 2025 р.» — підпис під імʼям. */
export function placeLine(city: string | null | undefined, createdAt: string) {
  return [city, `на Zunor з ${memberSince(createdAt)}`].filter(Boolean).join(' · ')
}

/**
 * Шапка: фото, імʼя (з галочкою перевірки), пігулка «хто це» кольору
 * акценту й сірий підпис — місто та відколи на Zunor.
 */
export function ProfileHero({
  avatar,
  name,
  verified = false,
  kind,
  line,
}: {
  avatar: string | null | undefined
  name: string
  verified?: boolean
  kind?: string | null
  line: string
}) {
  const c = useColors()
  return (
    <View className="items-center gap-2 px-2 pt-2">
      <Avatar uri={avatar} name={name} size={96} />
      <View className="mt-1.5 flex-row items-center justify-center gap-1.5">
        <Text
          accessibilityRole="header"
          className="shrink text-center text-[24px] font-semibold tracking-[-0.4px] text-foreground"
        >
          {name}
        </Text>
        {verified ? (
          <View accessible accessibilityLabel="Перевірений">
            <Glyph name="verified" size={19} color={c.primary} />
          </View>
        ) : null}
      </View>
      {kind ? (
        <View
          className="h-[26px] flex-row items-center rounded-full px-2.5"
          style={{ backgroundColor: `${c.primary}1f` }}
        >
          <Text
            className="text-[12.5px] font-semibold"
            style={{ color: c.primary }}
          >
            {kind}
          </Text>
        </View>
      ) : null}
      <Text className="text-center text-[15px] leading-[20px] text-muted-foreground">
        {line}
      </Text>
    </View>
  )
}

/** Висота банера: на ширині телефона картинка категорії ледь обрізана з боків. */
const BANNER_H = 132
/** Аватар і кільце кольору фону навколо — як `ring-4 ring-background` сайту. */
const BANNER_AVATAR = 84
const RING = 4

/**
 * Шапка майстра — як у його профілі на сайті (dashboard/master/[id]): угорі
 * банер категорії, аватар ліворуч наполовину на банері (кільцем кольору
 * фону відрізаний від картинки), під ним — імʼя з галочкою і рядок «хто ·
 * місто · відколи». Як профіль у Twitter: по центру шапка займала б пів
 * екрана. Нікнейма немає: клієнти бачать імʼя.
 */
export function BannerHero({
  banner,
  avatar,
  name,
  verified = false,
  kind,
  line,
}: {
  /** Картинка з assets (profiles/banner); null — без банера. */
  banner: number | null
  avatar: string | null | undefined
  name: string
  verified?: boolean
  kind?: string | null
  line: string
}) {
  const c = useColors()
  return (
    <View>
      {banner ? (
        <View
          className="overflow-hidden rounded-[20px] bg-secondary"
          style={[SQUIRCLE, { height: BANNER_H }]}
        >
          <Image
            source={banner}
            contentFit="cover"
            accessible={false}
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      ) : null}
      <View
        className="ml-3 self-start rounded-full bg-background"
        style={{
          padding: RING,
          marginTop: banner ? -(BANNER_AVATAR / 2 + RING) : 0,
        }}
      >
        <Avatar uri={avatar} name={name} size={BANNER_AVATAR} />
      </View>
      <View className="mt-2 gap-1 px-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            accessibilityRole="header"
            className="shrink text-[24px] font-semibold tracking-[-0.4px] text-foreground"
          >
            {name}
          </Text>
          {verified ? (
            <View accessible accessibilityLabel="Перевірений">
              <Glyph name="verified" size={19} color={c.primary} />
            </View>
          ) : null}
        </View>
        <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {kind ? (
            <View
              className="h-[26px] justify-center rounded-full px-2.5"
              style={{ backgroundColor: `${c.primary}1f` }}
            >
              <Text
                className="text-[12.5px] font-semibold"
                style={{ color: c.primary }}
              >
                {kind}
              </Text>
            </View>
          ) : null}
          <Text className="text-[15px] leading-[20px] text-muted-foreground">
            {line}
          </Text>
        </View>
      </View>
    </View>
  )
}

/** Одна цифра в рядку: велике значення й підпис під ним. */
export interface Stat {
  value: string
  label: string
  /** Зірка перед значенням — для рейтингу. */
  star?: boolean
  /** Значення сіре — «ще без оцінок». */
  muted?: boolean
}

/** Три цифри в одній картці, розділені тонкими лініями — як на сайті. */
export function StatsCard({ items }: { items: Stat[] }) {
  return (
    <View
      className="flex-row rounded-[24px] bg-card py-4"
      style={SQUIRCLE}
      accessible
      accessibilityLabel={items.map((s) => `${s.value} ${s.label}`).join(', ')}
    >
      {items.map((s, i) => (
        <View key={s.label} className="flex-1 flex-row">
          {i > 0 ? (
            <View
              className="my-1 bg-input"
              style={{ width: StyleSheet.hairlineWidth }}
            />
          ) : null}
          <View className="flex-1 items-center gap-0.5 px-1">
            <View className="flex-row items-center gap-1.5">
              {s.star ? <Glyph name="star" size={15} color={STAR} /> : null}
              <Text
                className={`text-[21px] font-semibold tracking-[-0.3px] ${
                  s.muted ? 'text-muted-foreground' : 'text-foreground'
                }`}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {s.value}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              className="text-[13px] text-muted-foreground"
            >
              {s.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}

/** Рейтинг цифрою, а без відгуків — «Новий» (0.0 читалось би як погано). */
export function ratingStat(
  avg: number,
  count: number,
  fresh: string = 'Новий',
): Stat {
  return count > 0
    ? { value: formatRating(avg), label: 'рейтинг', star: true }
    : { value: fresh, label: 'ще без оцінок', star: true, muted: true }
}

export function reviewsWord(n: number): string {
  return pluralUk(n, 'відгук', 'відгуки', 'відгуків')
}

/** Розділ із підписом і карткою тексту — «Про себе». */
export function TextBlock({
  title,
  children,
  muted = false,
}: {
  title: string
  children: string
  muted?: boolean
}) {
  return (
    <View className="gap-2">
      <GroupLabel>{title}</GroupLabel>
      <View className="rounded-[24px] bg-card p-4" style={SQUIRCLE}>
        <Text
          selectable={!muted}
          className={`text-[17px] leading-[25px] ${
            muted ? 'text-muted-foreground' : 'text-foreground'
          }`}
        >
          {children}
        </Text>
      </View>
    </View>
  )
}

/** Розділ із підписом і довільним змістом у картці. */
export function CardBlock({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <View className="gap-2">
      <GroupLabel>{title}</GroupLabel>
      <View className="gap-3 rounded-[24px] bg-card p-4" style={SQUIRCLE}>
        {children}
      </View>
    </View>
  )
}

function Stars({ value }: { value: number }) {
  const c = useColors()
  const n = Math.max(0, Math.min(5, Math.round(value)))
  return (
    <View
      className="flex-row items-center gap-[3px]"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Оцінка ${n} з 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Glyph key={i} name="star" size={13} color={i <= n ? STAR : c.input} />
      ))}
    </View>
  )
}

const reviewDate = (iso: string) =>
  new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

/**
 * Відгуки картками: кружечок із першою літерою автора, імʼя, зірки, дата
 * й текст. Порожньо — тиха картка з поясненням.
 */
export function ReviewList({
  title,
  reviews,
  total,
  empty,
}: {
  title: string
  reviews: ProfileReview[]
  /** Скільки всього (сервер віддає останні 30). */
  total: number
  empty: string
}) {
  const c = useColors()
  return (
    <View className="gap-2.5">
      <GroupLabel>{total > 0 ? `${title} · ${total}` : title}</GroupLabel>
      {reviews.length === 0 ? (
        <View
          className="flex-row items-center gap-3 rounded-[20px] bg-card p-4"
          style={SQUIRCLE}
        >
          <Glyph name="star" size={20} color={c.mutedForeground} />
          <Text className="flex-1 text-[15px] leading-[21px] text-muted-foreground">
            {empty}
          </Text>
        </View>
      ) : (
        reviews.map((r) => (
          <View
            key={r.id}
            className="gap-2.5 rounded-[24px] bg-card p-4"
            style={SQUIRCLE}
          >
            <View className="flex-row items-center gap-3">
              <View className="size-9 items-center justify-center rounded-full bg-secondary">
                <Text className="text-[14px] font-semibold text-muted-foreground">
                  {r.authorInitials}
                </Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text
                  numberOfLines={1}
                  className="text-[15px] font-semibold text-foreground"
                >
                  {r.authorName}
                </Text>
                <Text className="text-[13px] text-muted-foreground">
                  {reviewDate(r.createdAt)}
                </Text>
              </View>
              <Stars value={r.rating} />
            </View>
            {r.text ? (
              <Text
                selectable
                className="text-[16px] leading-[23px] text-foreground"
              >
                {r.text}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  )
}

/**
 * Поки вантажиться — будова профілю сірими брусками. `banner` — шапка
 * майстра (банер, аватар ліворуч на ньому), інакше — по центру, як у
 * клієнта.
 */
export function ProfileSkeleton({
  top,
  banner = false,
}: {
  top: number
  banner?: boolean
}) {
  return (
    <View className="flex-1 bg-background">
      <Skeleton className="gap-7 px-4" style={{ paddingTop: top + 8 }}>
        {banner ? (
          <View>
            <Bone width="100%" height={BANNER_H} radius={20} />
            <View
              className="ml-3 self-start rounded-full bg-background"
              style={{ padding: RING, marginTop: -(BANNER_AVATAR / 2 + RING) }}
            >
              <Bone
                width={BANNER_AVATAR}
                height={BANNER_AVATAR}
                radius={BANNER_AVATAR / 2}
              />
            </View>
            <View className="mt-3 gap-2.5 px-1">
              <Bone width={180} height={22} radius={7} />
              <Bone width={220} height={13} />
            </View>
          </View>
        ) : (
          <View className="items-center gap-3 pt-2">
            <Bone width={96} height={96} radius={48} />
            <Bone width={180} height={22} radius={7} />
            <Bone width={220} height={13} />
          </View>
        )}
        <Bone width="100%" height={84} radius={24} />
        <SectionSkeleton rows={2} tiles={false} />
        <SectionSkeleton rows={3} tiles={false} />
      </Skeleton>
    </View>
  )
}
