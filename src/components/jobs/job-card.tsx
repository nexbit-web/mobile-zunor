import { Link } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { Glyph } from '@/components/icons/glyph'
import { LiveDot, StatusPill } from '@/components/ui/status-pill'
import { useColors } from '@/lib/theme'
import { jobTags, resolveWhen } from '@/shared/cleaning'
import { formatDay, formatRelative } from '@/shared/format'
import {
  fitReasonLabels,
  formatBudget,
  formatDistance,
  isFresh,
  jobState,
  type JobListItem,
} from '@/shared/jobs'

import {
  CARD,
  CardDivider,
  Fact,
  ServiceHeader,
  SQUIRCLE,
  TagRow,
} from './card-parts'

/**
 * Картка заявки — у «Замовленнях» клієнта і в стрічці майстра. Та сама
 * мова, що job-card.svelte на сайті (як вакансія на work.ua: око йде
 * зверху вниз і порівнює дві заявки одним поглядом), у подачі iOS:
 *
 *   [плитка послуги] Послуга / день            стан (клієнт) · бюджет (майстер)
 *   Назва — великим, опис — сірим на два рядки
 *   (характеристики пігулками)
 *   ───
 *   бюджет / район і відстань / замовник ★          коли опубліковано
 *
 * Майстрові кількості чужих пропозицій немає навмисно (MANIFESTO,
 * «Справедливий маркетплейс»). «Топ для тебе» — бірюзова смуга з-під
 * картки з причинами, як на сайті.
 */
export function JobCard({
  job,
  viewer,
}: {
  job: JobListItem
  viewer: 'client' | 'master'
}) {
  const c = useColors()
  const master = viewer === 'master'
  const meta = job.metadata ?? {}
  const iso = resolveWhen(meta.when, job.createdAt)
  const day = iso ? formatDay(iso) : ''
  const tags = jobTags(meta)
  const budget = formatBudget(
    job.budgetMinCents,
    job.budgetMaxCents,
    job.currency,
  )
  const where = job.place?.district
    ? [
        job.place.district,
        job.place.distanceKm !== null ? formatDistance(job.place.distanceKm) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const state = jobState(job, viewer)
  // Скасовані й прострочені — пригашені: це вже історія.
  const dimmed = job.status === 'CANCELLED' || job.status === 'EXPIRED'
  const fresh = master && isFresh(job.createdAt)
  const reasons = master && job.match ? fitReasonLabels(job.match) : []

  const facts: ReactNode[] = []
  if (!master && budget) {
    facts.push(
      <Fact key="budget" icon="wallet" strong>
        {budget}
      </Fact>,
    )
  }
  if (where) {
    facts.push(
      <Fact key="where" icon="pin">
        {where}
      </Fact>,
    )
  }
  if (master && job.client) {
    facts.push(
      <Fact key="client" icon="person">
        {job.client.name ?? 'Замовник'}
        {job.client.reviewsCount > 0
          ? `  ★ ${job.client.avgRating.toFixed(1)}`
          : ''}
      </Fact>,
    )
  }

  const card = (
    <View className="gap-3.5 p-4" style={dimmed ? { opacity: 0.55 } : undefined}>
      <ServiceHeader
        service={meta.service}
        day={day}
        right={
          master ? (
            budget ? (
              <Text
                className="text-[17px] font-bold text-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {budget}
              </Text>
            ) : null
          ) : job.status ? (
            <StatusPill
              label={state.label}
              tone={state.tone}
              pulse={state.tone === 'live'}
            />
          ) : null
        }
      />

      <View className="gap-1.5">
        <Text
          numberOfLines={2}
          className="text-[18px] font-bold leading-[23px] tracking-[-0.3px] text-foreground"
        >
          {job.title}
        </Text>
        {job.description ? (
          <Text
            numberOfLines={2}
            className="text-[15px] leading-[21px] text-muted-foreground"
          >
            {job.description}
          </Text>
        ) : null}
      </View>

      <TagRow tags={tags} />

      <CardDivider />

      {/* Без фактів (ні бюджету, ні району) — лише час, ліворуч. */}
      <View className="flex-row items-end justify-between gap-3">
        {facts.length ? <View className="flex-1 gap-2">{facts}</View> : null}
        {/* Свіжа (майстрові) — кольором і з «пульсом»: на неї ще реально
            встигнути, і саме це майстер шукає очима. */}
        <View className="flex-row items-center gap-1.5">
          {fresh ? <LiveDot color={c.primary} /> : null}
          <Text
            className={`text-[13px] ${fresh ? 'font-semibold' : ''}`}
            style={{ color: fresh ? c.primary : c.mutedForeground }}
          >
            {formatRelative(job.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  )

  return (
    <Link href={{ pathname: '/job/[id]', params: { id: job.id } }} asChild>
      <Pressable className="active:opacity-85">
        {reasons.length ? (
          <TopForYou reasons={reasons}>{card}</TopForYou>
        ) : (
          <View className={CARD} style={SQUIRCLE}>
            {card}
          </View>
        )}
      </Pressable>
    </Link>
  )
}

/**
 * «Топ для тебе»: картка лежить на бірюзовій підкладці (як на сайті —
 * #016a71 → #0b767d), а з-під неї видно, ЧОМУ саме ця заявка. Колір
 * сталий, не від акценту: акцентом уже позначено свіжість.
 */
function TopForYou({
  reasons,
  children,
}: {
  reasons: string[]
  children: ReactNode
}) {
  return (
    <View className="overflow-hidden rounded-[24px]" style={SQUIRCLE}>
      <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Defs>
          <LinearGradient id="top" x1="0" y1="0" x2="1" y2="0.3">
            <Stop offset="0.35" stopColor="#016a71" />
            <Stop offset="1" stopColor="#339196" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#top)" />
      </Svg>
      <View className="rounded-[24px] bg-card" style={SQUIRCLE}>
        {children}
      </View>
      <View className="flex-row flex-wrap items-center justify-center gap-x-1.5 px-4 py-2.5">
        <Glyph name="assistant" size={14} color="#ffffff" weight="semibold" />
        <Text className="text-[13.5px] font-semibold text-white">
          Топ для тебе
        </Text>
        {reasons.map((r) => (
          <Text
            key={r}
            className="text-[13.5px]"
            style={{ color: 'rgba(255, 255, 255, 0.9)' }}
          >
            · {r}
          </Text>
        ))}
      </View>
    </View>
  )
}
