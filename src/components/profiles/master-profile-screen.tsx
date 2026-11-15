import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams } from 'expo-router'
import { RefreshControl, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EmptyState } from '@/components/empty-state'
import { Glyph } from '@/components/icons/glyph'
import { ServiceIcon } from '@/components/icons/service-icon'
import { PhotoGrid } from '@/components/photo-grid'
import {
  PullIndicator,
  refreshLook,
  usePullRefresh,
} from '@/components/ui/pull-indicator'
import { api, errorText } from '@/lib/api'
import {
  HEADER_BAR,
  useHeaderScroll,
  useLargeTitleScroll,
} from '@/lib/large-title'
import { useColors } from '@/lib/theme'
import { crewKindLabel, type MasterProfile } from '@/shared/profiles'

import { bannerFor } from './banner'
import {
  BannerHero,
  CardBlock,
  placeLine,
  ProfileSkeleton,
  ratingStat,
  ReviewList,
  reviewsWord,
  StatsCard,
  TextBlock,
} from './profile-parts'

/**
 * Профіль майстра — клієнтові, з пропозиції чи замовлення (власник: «щоб
 * клієнт міг подивитись рейтинг, портфоліо, опис»). Те саме, що публічна
 * сторінка майстра /@handle на сайті:
 *
 *   фото, імʼя й перевірка · хто (людина чи компанія), місто, відколи
 *   рейтинг · виконано · відгуки
 *   ПОСЛУГИ — категорія, які прибирання, де (житло, офіси)
 *   ПРО СЕБЕ · ПРИКЛАДИ РОБІТ · ВІДГУКИ
 *
 * Телефону тут немає: клієнтові він — у пропозиції й замовленні. І ні
 * «обраних», ні «запросити майстра» — Zunor не каталог (MANIFESTO): сюди
 * приходять лише з конкретної пропозиції чи замовлення.
 * Дані — GET /api/masters/[id] (web: $lib/server/master-page).
 */
export function MasterProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const c = useColors()
  const { top, padTop, scrollProps } = useLargeTitleScroll({ refresh: true })
  const y = useHeaderScroll()

  const q = useQuery({
    queryKey: ['master', id],
    queryFn: async () =>
      (
        await api<{ profile: MasterProfile }>(
          `/api/masters/${encodeURIComponent(id)}`,
        )
      ).profile,
  })
  const { refreshing, onRefresh } = usePullRefresh(() => q.refetch())

  if (q.isPending) return <ProfileSkeleton top={top} banner />

  if (q.isError) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: top }}>
        <EmptyState
          icon="warning"
          title="Профіль не відкрито"
          text={errorText(q.error)}
          action={{ label: 'Спробувати ще', onPress: () => void q.refetch() }}
        />
      </View>
    )
  }

  const m = q.data
  const company = m.crew === 'COMPANY'

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: company ? 'Компанія' : 'Майстер' }} />
      <Animated.ScrollView
        {...scrollProps}
        className="flex-1"
        contentContainerClassName="gap-7 px-4"
        contentContainerStyle={{
          paddingTop: padTop + 8,
          paddingBottom: insets.bottom + 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            {...refreshLook(c, top)}
          />
        }
      >
        <MasterBody master={m} />
      </Animated.ScrollView>
      <PullIndicator
        y={y}
        top={insets.top + HEADER_BAR}
        refreshing={refreshing}
      />
    </View>
  )
}

function MasterBody({ master: m }: { master: MasterProfile }) {
  const company = m.crew === 'COMPANY'
  const name = m.name || m.username || (company ? 'Компанія' : 'Майстер')

  return (
    <>
      <BannerHero
        banner={bannerFor(m.categorySlugs)}
        avatar={m.avatar}
        name={name}
        verified={m.isVerified}
        username={m.username}
        kind={crewKindLabel(m.crew)}
        line={placeLine(m.city, m.createdAt)}
      />

      <StatsCard
        items={[
          ratingStat(m.avgRating, m.reviewsCount, company ? 'Нова' : 'Новий'),
          { value: String(m.completedOrders), label: 'виконано' },
          { value: String(m.reviewsCount), label: reviewsWord(m.reviewsCount) },
        ]}
      />

      {m.categories.length > 0 || m.services.length > 0 ? (
        <CardBlock title="Послуги">
          <View className="flex-row flex-wrap gap-2">
            {m.categories.map((name) => (
              <AccentPill key={name} label={name} />
            ))}
            {m.services.map((s) => (
              <ServicePill key={s.key} service={s.key} label={s.label} />
            ))}
          </View>
          {m.premises.length > 0 ? (
            <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
              {m.premises.map((p) => (
                <Premise key={p.key} business={p.key === 'business'} label={p.label} />
              ))}
            </View>
          ) : null}
        </CardBlock>
      ) : null}

      <TextBlock title={company ? 'Про компанію' : 'Про себе'} muted={!m.bio}>
        {m.bio ||
          (company ? 'Компанія ще не додала опис.' : 'Майстер ще не додав опис.')}
      </TextBlock>

      {m.portfolioImages.length > 0 ? (
        <CardBlock title="Приклади робіт">
          <PhotoGrid urls={m.portfolioImages} />
        </CardBlock>
      ) : null}

      <ReviewList
        title="Відгуки"
        reviews={m.reviews}
        total={m.reviewsCount}
        empty={
          company
            ? 'Відгуків ще немає — компанія новенька на Zunor.'
            : 'Відгуків ще немає — майстер новенький на Zunor.'
        }
      />
    </>
  )
}

/** Категорія — тоном акценту, як на сайті. */
function AccentPill({ label }: { label: string }) {
  const c = useColors()
  return (
    <View
      className="h-8 justify-center rounded-[10px] px-3"
      style={{ backgroundColor: `${c.primary}1f` }}
    >
      <Text className="text-[14px] font-medium" style={{ color: c.primary }}>
        {label}
      </Text>
    </View>
  )
}

/** Послуга — сірою плашкою з тією ж іконкою, що в заявках. */
function ServicePill({ service, label }: { service: string; label: string }) {
  return (
    <View className="h-8 flex-row items-center gap-1.5 rounded-[10px] bg-secondary px-2.5">
      <ServiceIcon service={service} size={18} />
      <Text className="text-[14px] text-foreground">{label}</Text>
    </View>
  )
}

/** Де прибирає: житло чи офіси — підписом з іконкою. */
function Premise({ business, label }: { business: boolean; label: string }) {
  const c = useColors()
  return (
    <View className="flex-row items-center gap-1.5">
      <Glyph
        name={business ? 'office' : 'house'}
        size={14}
        color={c.mutedForeground}
      />
      <Text className="text-[14px] text-muted-foreground">{label}</Text>
    </View>
  )
}
