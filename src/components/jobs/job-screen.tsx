import { StarIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react-native'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { EmptyState } from '@/components/empty-state'
import { api, errorText } from '@/lib/api'
import { useLargeTitleScroll } from '@/lib/large-title'
import { useColors } from '@/lib/theme'
import { formatRelative } from '@/shared/format'
import { jobState, type JobDetail } from '@/shared/jobs'

/**
 * Заявка. Дані — GET /api/jobs/[id], той самий доступ, що й на сайті
 * (job-access): чужа заявка — 404. Деталей прибирання (кімнати, вікна)
 * ендпоінт поки не віддає — це наступний крок на сервері.
 *
 * Маршрут — app/job/[id].tsx, у корені поверх усього.
 */
export function JobScreen() {
  const c = useColors()
  const { id } = useLocalSearchParams<{ id: string }>()
  // Під напівпрозорою шапкою з великим заголовком (lib/large-title).
  const { padTop, scrollProps } = useLargeTitleScroll()
  const q = useQuery({
    queryKey: ['job', id],
    queryFn: () => api<JobDetail>(`/api/jobs/${encodeURIComponent(id)}`),
  })

  if (q.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={c.mutedForeground} />
      </View>
    )
  }

  if (q.isError) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          icon="warning"
          title="Заявку не відкрито"
          text={errorText(q.error)}
          action={{ label: 'Спробувати ще', onPress: () => q.refetch() }}
        />
      </View>
    )
  }

  const { job, isOwner } = q.data
  const state = jobState(job, isOwner ? 'client' : 'master')

  return (
    <Animated.ScrollView
      {...scrollProps}
      className="bg-background"
      contentContainerClassName="gap-5 p-4"
      contentContainerStyle={{ paddingTop: padTop + 8 }}
    >
      <View
        className="gap-3 rounded-[22px] bg-card p-4"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className="text-[13px] text-muted-foreground">
          Опубліковано {formatRelative(job.createdAt)}
        </Text>
        <Text className="text-[24px] font-bold leading-[29px] text-foreground">
          {job.title}
        </Text>
        <View className="flex-row">
          <Text
            className={`overflow-hidden rounded-full px-2.5 py-1 text-[12px] font-semibold ${
              state.tone === 'action'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground'
            }`}
          >
            {state.label}
          </Text>
        </View>

        {!isOwner ? (
          <View className="flex-row items-center gap-2">
            <Text className="text-[15px] text-foreground">
              {job.client.name ?? 'Замовник'}
            </Text>
            {job.client.reviewsCount > 0 ? (
              <View className="flex-row items-center gap-1">
                <HugeiconsIcon
                  icon={StarIcon}
                  size={14}
                  color={c.mutedForeground}
                />
                <Text className="text-[14px] text-muted-foreground">
                  {job.client.avgRating.toFixed(1)} · {job.client.reviewsCount}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {job.description ? (
        <View className="gap-2">
          <Text className="text-[17px] font-semibold text-foreground">
            Про заявку
          </Text>
          <Text className="text-[15px] leading-[22px] text-foreground">
            {job.description}
          </Text>
        </View>
      ) : null}

      {job.attachments.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {job.attachments.map((url) => (
              <Image
                key={url}
                source={url}
                contentFit="cover"
                transition={150}
                style={{ width: 120, height: 120, borderRadius: 12 }}
              />
            ))}
          </View>
        </ScrollView>
      ) : null}
    </Animated.ScrollView>
  )
}
