import { Link } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { Glyph } from '@/components/icons/glyph'
import { Icon, type SiteIconName } from '@/components/icons/icon'
import { ServiceIcon } from '@/components/icons/service-icon'
import { LiveDot, StatusPill } from '@/components/ui/status-pill'
import { useColors } from '@/lib/theme'
import { jobTags, resolveWhen, serviceLabel } from '@/shared/cleaning'
import { formatDay, formatRelative } from '@/shared/format'
import {
  fitReasonLabels,
  formatBudget,
  formatDistance,
  isFresh,
  jobState,
  type JobListItem,
} from '@/shared/jobs'

import { Chevron, SQUIRCLE } from './card-parts'

/** Обгортка картки заявки — як на сайті: шар «картка» з тонкою обводкою. */
export const JOB_CARD = 'rounded-[20px] border border-border bg-card'

/** Жовта зірка рейтингу замовника — та сама, що на сайті (amber-400). */
export const STAR = '#fbbf24'

/**
 * Картка заявки — у «Замовленнях» клієнта і в стрічці майстра. Будова — як
 * на сайті (web/…/jobs/job-card.svelte, так попросив власник), як
 * вакансія на work.ua: велика назва, під нею факти рядками з сірими
 * іконками сайту — бюджет жирним, послуга й день, замовник із рейтингом,
 * район і відстань, характеристики через крапку; опис сірим на два рядки;
 * унизу — коли опубліковано, а клієнтові праворуч — стан заявки. Око йде
 * зверху вниз по однакових рядках і порівнює дві заявки одним поглядом:
 * гроші, що, хто, де.
 *
 * Шеврон праворуч від назви — картка відкривається (лишили з попередньої
 * мобільної картки, так попросив власник).
 *
 * Замовник і район — лише майстрові: клієнт і так знає, чия це заявка й
 * де. Кількості чужих пропозицій майстрові немає навмисно (MANIFESTO,
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
  const service =
    typeof meta.service === 'string' ? serviceLabel(meta.service) : 'Прибирання'
  const budget = formatBudget(
    job.budgetMinCents,
    job.budgetMaxCents,
    job.currency,
  )
  const state = jobState(job, viewer)
  // Скасовані й прострочені — пригашені: це вже історія.
  const dimmed = job.status === 'CANCELLED' || job.status === 'EXPIRED'
  const fresh = master && isFresh(job.createdAt)
  const reasons = master && job.match ? fitReasonLabels(job.match) : []
  const tags = jobTags(meta)
  const where =
    master && job.place?.district
      ? [
          job.place.district,
          job.place.distanceKm !== null
            ? formatDistance(job.place.distanceKm)
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : ''
  const client = master ? job.client : null

  const card = (
    <View className="px-5 py-[18px]" style={dimmed ? { opacity: 0.6 } : undefined}>
      <View className="flex-row items-start gap-3">
        <Text
          numberOfLines={3}
          className="flex-1 text-[19px] font-semibold leading-[25px] tracking-[-0.2px] text-foreground"
        >
          {job.title}
        </Text>
        {/* По центру першого рядка назви. */}
        <View className="h-[25px] justify-center">
          <Chevron />
        </View>
      </View>

      <View className="mt-2.5 gap-1.5">
        {budget ? (
          <FactRow icon="wallet">
            <Text
              className="text-[14.5px] font-semibold leading-[20px] text-foreground"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {budget}
            </Text>
          </FactRow>
        ) : null}

        <FactRow
          icon={
            <ServiceIcon
              service={meta.service}
              size={18}
              color={c.mutedForeground}
            />
          }
        >
          <Text className="text-[14.5px] leading-[20px] text-foreground">
            {service}
            {day ? (
              <Text className="text-muted-foreground">{` · ${day}`}</Text>
            ) : null}
          </Text>
        </FactRow>

        {client ? (
          <FactRow icon="user">
            <View className="min-w-0 flex-row items-center gap-1.5">
              <Text
                numberOfLines={1}
                className="shrink text-[14.5px] font-medium leading-[20px] text-foreground"
              >
                {client.name ?? 'Замовник'}
              </Text>
              {client.reviewsCount > 0 ? (
                <>
                  <Icon name="star" size={14} color={STAR} fill={STAR} />
                  <Text
                    className="text-[14.5px] font-medium leading-[20px]"
                    style={{
                      color: c.foreground,
                      opacity: 0.8,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {client.avgRating.toFixed(1)}
                  </Text>
                </>
              ) : null}
            </View>
          </FactRow>
        ) : null}

        {where ? (
          <FactRow icon="map-pin">
            <Text className="text-[14.5px] leading-[20px] text-foreground">
              {where}
            </Text>
          </FactRow>
        ) : null}

        {tags.length ? (
          <FactRow icon="file-text">
            <Text
              numberOfLines={3}
              className="text-[14.5px] leading-[20px] text-foreground"
            >
              {tags.join(' · ')}
            </Text>
          </FactRow>
        ) : null}
      </View>

      {job.description ? (
        <Text
          numberOfLines={2}
          className="mt-3 text-[14.5px] leading-[22px] text-muted-foreground"
        >
          {job.description}
        </Text>
      ) : null}

      <View className="mt-3.5 min-h-6 flex-row items-center justify-between gap-4">
        {/* Свіжа (майстрові) — кольором і з «пульсом»: на неї ще реально
            встигнути, і саме це майстер шукає очима. */}
        <View className="shrink flex-row items-center gap-1.5">
          {fresh ? <LiveDot color={c.primary} /> : null}
          <Text
            className={`text-[13.5px] ${fresh ? 'font-medium' : ''}`}
            style={{ color: fresh ? c.primary : c.mutedForeground }}
          >
            {formatRelative(job.createdAt)}
          </Text>
        </View>
        {!master && job.status ? (
          <View className="shrink-0">
            <StatusPill
              label={state.label}
              tone={state.tone}
              pulse={state.tone === 'live'}
            />
          </View>
        ) : null}
      </View>
    </View>
  )

  return (
    <Link href={{ pathname: '/job/[id]', params: { id: job.id } }} asChild>
      <Pressable className="active:opacity-85">
        {reasons.length ? (
          <TopForYou reasons={reasons}>{card}</TopForYou>
        ) : (
          <View className={JOB_CARD} style={SQUIRCLE}>
            {card}
          </View>
        )}
      </Pressable>
    </Link>
  )
}

/**
 * Рядок факту, як на сайті: сіра іконка 18 pt (набір сайту, лінія 1.75)
 * зліва, текст поруч; довгий текст переноситься під себе, іконка лишається
 * біля першого рядка.
 */
export function FactRow({
  icon,
  children,
}: {
  icon: SiteIconName | ReactNode
  children: ReactNode
}) {
  const c = useColors()
  return (
    <View className="min-w-0 flex-row items-start gap-2.5">
      <View className="mt-px size-[18px] items-center justify-center">
        {typeof icon === 'string' ? (
          <Icon
            name={icon as SiteIconName}
            size={18}
            color={c.mutedForeground}
            strokeWidth={1.75}
          />
        ) : (
          icon
        )}
      </View>
      <View className="min-w-0 flex-1">{children}</View>
    </View>
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
    <View className="overflow-hidden rounded-[20px]" style={SQUIRCLE}>
      <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Defs>
          <LinearGradient id="top" x1="0" y1="0" x2="1" y2="0.3">
            <Stop offset="0.35" stopColor="#016a71" />
            <Stop offset="1" stopColor="#339196" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#top)" />
      </Svg>
      <View className={JOB_CARD} style={SQUIRCLE}>
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
