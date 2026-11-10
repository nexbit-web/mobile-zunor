import { Link } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

import { resolveWhen, serviceLabel } from '@/shared/cleaning'
import { formatDay, formatRelative } from '@/shared/format'
import {
  formatDistance,
  jobState,
  type JobListItem,
} from '@/shared/jobs'

const TONE: Record<string, string> = {
  live: 'bg-secondary text-foreground',
  // Єдиний залитий стан — тут клієнтові треба щось зробити (як на сайті).
  action: 'bg-primary text-primary-foreground',
  progress: 'bg-secondary text-foreground',
  done: 'bg-secondary text-muted-foreground',
  off: 'bg-secondary text-muted-foreground',
}

/**
 * Картка заявки — та сама мова, що job-card.svelte на сайті: велика назва,
 * під нею послуга · день, майстрові — район і відстань, опис сірим на два
 * рядки, унизу «коли» і стан.
 */
export function JobCard({
  job,
  viewer,
}: {
  job: JobListItem
  viewer: 'client' | 'master'
}) {
  const meta = job.metadata ?? {}
  const day = resolveWhen(meta.when, job.createdAt)
  const facts = [
    typeof meta.service === 'string' ? serviceLabel(meta.service) : null,
    day ? formatDay(day) : null,
  ].filter(Boolean)
  const place = job.place
  const where = place
    ? [
        place.district,
        place.distanceKm !== null ? formatDistance(place.distanceKm) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const state = jobState(job, viewer)

  return (
    <Link href={{ pathname: '/job/[id]', params: { id: job.id } }} asChild>
      <Pressable className="gap-2 rounded-2xl border border-border bg-card p-4 active:opacity-80">
        <Text
          className="text-[18px] font-bold leading-[23px] text-foreground"
          numberOfLines={2}
        >
          {job.title}
        </Text>
        {facts.length ? (
          <Text className="text-[15px] text-foreground">
            {facts.join(' · ')}
          </Text>
        ) : null}
        {where ? (
          <Text className="text-[14px] text-muted-foreground">{where}</Text>
        ) : null}
        {job.description ? (
          <Text
            className="text-[14px] leading-[20px] text-muted-foreground"
            numberOfLines={2}
          >
            {job.description}
          </Text>
        ) : null}
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-[13px] text-muted-foreground">
            {formatRelative(job.createdAt)}
          </Text>
          {job.status ? (
            <Text
              className={`overflow-hidden rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONE[state.tone]}`}
            >
              {state.label}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  )
}
