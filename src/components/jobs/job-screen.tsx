import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { Alert, Platform, RefreshControl, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EmptyState } from '@/components/empty-state'
import { WithBell } from '@/components/header-bell'
import { Glyph } from '@/components/icons/glyph'
import { PhotoGrid } from '@/components/photo-grid'
import { Row, Section } from '@/components/settings/list'
import { Avatar } from '@/components/ui/avatar'
import { BalancedText } from '@/components/ui/balanced-text'
import { Button } from '@/components/ui/button'
import { FooterFade } from '@/components/ui/footer-fade'
import { GlowButton } from '@/components/ui/glow-button'
import {
  PullIndicator,
  refreshLook,
  usePullRefresh,
} from '@/components/ui/pull-indicator'
import { RoundButton } from '@/components/ui/round-button'
import { Bone, SectionSkeleton, Skeleton } from '@/components/ui/skeleton'
import { StatusPill } from '@/components/ui/status-pill'
import { SQUIRCLE, Tile, TINT } from '@/components/ui/tile'
import { ZunorNote } from '@/components/zunor/zunor-note'
import { showActionSheet } from '@/lib/action-sheet'
import { api, errorText } from '@/lib/api'
import { SITE_URL } from '@/lib/config'
import { confirmAction } from '@/lib/confirm'
import {
  HEADER_BAR,
  useHeaderScroll,
  useLargeTitleScroll,
} from '@/lib/large-title'
import { useColors } from '@/lib/theme'
import { describeJob, resolveWhen, serviceLabel } from '@/shared/cleaning'
import {
  formatDay,
  formatDayLong,
  formatRelative,
  pluralUk,
} from '@/shared/format'
import {
  effortSize,
  expiresIn,
  formatBudget,
  formatDistance,
  jobState,
  memberSince,
  type JobDetail,
  type JobProposal,
} from '@/shared/jobs'

import { Chip, GroupLabel, InfoRow, MetaLine } from './job-details'
import { ProposalCard } from './proposal-card'
import { ProposeSheet } from './propose-sheet'

/**
 * Заявка — однаково для клієнта й майстра, у згрупованій подачі iOS за
 * макетом власника:
 *
 *   ЗАЯВКА · 2 ДН ТОМУ · велика назва · стан і «Активна ще 4 дн»
 *   (клієнтові) РЕКОМЕНДУЄМО ДЛЯ ВАС — пропозиції майстрів, одразу під
 *     назвою: він тут, щоб обрати; (майстрові) ВАША ПРОПОЗИЦІЯ
 *   КОЛИ І ДЕ — день і район кольоровими плитками
 *   БЮДЖЕТ · ЗАМОВНИК (майстрові: хто, рейтинг, телефон після вибору)
 *   ОБ’ЄКТ — таблиця «назва — значення»: тип, помешкання, кімнати, площа,
 *     обсяг і решта характеристик
 *   ПРО ЗАЯВКУ — опис і фото (на весь екран по дотику)
 *   АСИСТЕНТ (клієнтові, поки заявка відкрита) — слово від Zunor, що
 *     друкується
 *   підвал: опубліковано · перегляди
 *
 * Дані — GET /api/jobs/[id]?open=1 (web: $lib/server/job-detail, ті самі,
 * що в сторінки сайту; `open=1` — перегляд і «майстер відкрив» для
 * розсилки). Маршрут — app/job/[id].tsx, у корені поверх усього.
 */
export function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const c = useColors()
  const { top, padTop, scrollProps } = useLargeTitleScroll({ refresh: true })

  const q = useQuery({
    queryKey: ['job', id],
    queryFn: () => api<JobDetail>(`/api/jobs/${encodeURIComponent(id)}?open=1`),
  })
  const { refreshing, onRefresh } = usePullRefresh(() => q.refetch())
  const y = useHeaderScroll()
  const qc = useQueryClient()
  // Аркуш пропозиції майстра (propose-sheet) — замість форми на сайті.
  const [proposing, setProposing] = useState(false)

  if (q.isPending) return <JobSkeleton top={top} />

  if (q.isError) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: top }}>
        <EmptyState
          icon="warning"
          title="Заявку не відкрито"
          text={errorText(q.error)}
          action={{ label: 'Спробувати ще', onPress: () => q.refetch() }}
        />
      </View>
    )
  }

  const data = q.data
  const proposeBar = Boolean(data.canPropose)

  return (
    <View className="flex-1 bg-background">
      <Animated.ScrollView
        {...scrollProps}
        className="flex-1"
        contentContainerClassName="gap-7 px-4"
        contentContainerStyle={{
          paddingTop: padTop + 8,
          paddingBottom: insets.bottom + (proposeBar ? 96 : 32),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            {...refreshLook(c, top)}
          />
        }
      >
        <JobBody data={data} id={id} refetch={() => void q.refetch()} />
      </Animated.ScrollView>
      <PullIndicator
        y={y}
        top={insets.top + HEADER_BAR}
        refreshing={refreshing}
      />

      {proposeBar ? (
        <>
          <ProposeBar onPress={() => setProposing(true)} />
          <ProposeSheet
            visible={proposing}
            jobId={id}
            jobTitle={data.job.title}
            budget={
              formatBudget(
                data.job.budgetMinCents,
                data.job.budgetMaxCents,
                data.job.currency,
              ) || null
            }
            onClose={() => setProposing(false)}
            onSent={() => {
              setProposing(false)
              // Тепер на екрані — «Ваша пропозиція»; стрічка теж знає.
              void qc.invalidateQueries({ queryKey: ['job', id] })
              void qc.invalidateQueries({ queryKey: ['jobs'] })
            }}
          />
        </>
      ) : null}
    </View>
  )
}

function JobBody({
  data,
  id,
  refetch,
}: {
  data: JobDetail
  id: string
  refetch: () => void
}) {
  const qc = useQueryClient()
  const [accepting, setAccepting] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const { job, isOwner } = data
  const master = !isOwner
  const open = job.status === 'OPEN'
  const meta = (job.metadata ?? {}) as Record<string, unknown>
  const service = typeof meta.service === 'string' ? meta.service : null

  // День прибирання: «today/tomorrow» — відносно дня створення заявки.
  // Старий сервер (до деплою) metadata не віддає — тоді розділів просто менше.
  const iso = resolveWhen(meta.when, job.createdAt)
  const day = iso ? formatDay(iso) : ''
  const dayLong = iso ? formatDayLong(iso) : ''
  // «Гаряча» з work.ua — у нас «Терміново»: прибрати сьогодні чи завтра,
  // а майстра ще шукають.
  const urgent = open && (day === 'Сьогодні' || day === 'Завтра')
  const state = jobState(job, isOwner ? 'client' : 'master')
  const live = open && new Date(job.expiresAt).getTime() > Date.now()

  // Об’єкт — таблицею: тип прибирання, далі все з describeJob (крім
  // послуги — вона вже «Тип»), обсяг і предмети хімчистки.
  const specs = describeJob(job.metadata)
  const objectRows = [
    ...(service
      ? [{ label: 'Тип прибирання', value: serviceLabel(service) }]
      : []),
    ...specs
      .filter((s) => s.label !== 'Послуга' && !s.items && s.value)
      .map((s) => ({ label: s.label, value: s.value })),
    ...(job.effort
      ? [{ label: 'Обсяг роботи', value: effortSize(job.effort) }]
      : []),
    ...(specs.find((s) => s.items)?.items ?? []).map((it) => ({
      label: it.name,
      value: it.qty > 1 ? `× ${it.qty}` : '1 шт.',
    })),
  ]

  const place = [job.cityName, job.place?.district].filter(Boolean).join(', ')
  const km = job.place?.distanceKm ?? null
  const budget = formatBudget(
    job.budgetMinCents,
    job.budgetMaxCents,
    job.currency,
  )

  const proposals = data.proposals ?? []
  const recommended = proposals.filter((p) => p.recommended)
  const visible = showAll || recommended.length === 0 ? proposals : recommended
  const mine = master ? proposals[0] : undefined

  // Слово від Zunor — клієнтові, поки заявка відкрита.
  const zunorText =
    isOwner && open
      ? proposals.length > 0
        ? `Уже є ${proposals.length} ${pluralUk(proposals.length, 'пропозиція', 'пропозиції', 'пропозицій')}${
            recommended.length > 0 ? ' — тих, кого раджу, я позначив' : ''
          }. Порівняйте їх угорі й оберіть одного майстра.`
        : 'Шукаю майстрів поруч. Можете спокійно займатися справами — я сповіщу, щойно хтось відгукнеться.'
      : null

  const footer = [
    {
      icon: 'clock' as const,
      text: `Опубліковано ${formatRelative(job.createdAt)}`,
    },
    // Як на замовленні: номер унизу, щоб продиктувати підтримці.
    ...(job.number
      ? [{ icon: 'document' as const, text: `№${job.number}` }]
      : []),
    {
      icon: 'eye' as const,
      text: `${job.viewsCount} ${pluralUk(job.viewsCount, 'перегляд', 'перегляди', 'переглядів')}`,
    },
    ...(job.editedAt
      ? [
          {
            icon: 'compose' as const,
            text: `Змінено ${formatRelative(job.editedAt)}`,
          },
        ]
      : []),
  ]

  async function accept(p: JobProposal) {
    const ok = await confirmAction('Обрати цього майстра?', {
      confirm: 'Обрати',
      cancel: 'Назад',
      message:
        'Інші пропозиції буде відхилено, а заявка стане замовленням: там телефон майстра й чат, щоб домовитись про деталі.',
    })
    if (!ok) return
    setAccepting(p.id)
    try {
      await api(`/api/proposals/${p.id}/accept`, { method: 'POST' })
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['job', id] }),
        qc.invalidateQueries({ queryKey: ['jobs'] }),
        qc.invalidateQueries({ queryKey: ['orders'] }),
      ])
      // Ключовий момент маркетплейсу: заявка стала замовленням — туди й ведемо.
      Alert.alert('Майстра обрано', 'Замовлення — у «Замовлення» → «Активні».')
      router.navigate('/orders')
    } catch (err) {
      Alert.alert('Не вдалося обрати', errorText(err))
    } finally {
      setAccepting(null)
    }
  }

  async function cancelJob() {
    const ok = await confirmAction('Скасувати заявку?', {
      confirm: 'Скасувати заявку',
      cancel: 'Назад',
      destructive: true,
      message:
        'Майстри більше не бачитимуть її і не зможуть надіслати пропозиції.',
    })
    if (!ok) return
    try {
      await api(`/api/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' })
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['job', id] }),
        qc.invalidateQueries({ queryKey: ['jobs'] }),
      ])
      router.back()
    } catch (err) {
      Alert.alert('Не вдалося скасувати', errorText(err))
    }
  }

  return (
    <>
      {/* Рідкісні дії власника — у «⋯», а не кнопками на виду: скасування
          незворотне. Редагування — поки на сайті. Дзвіночок — завжди. */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <WithBell>
              {isOwner && open ? (
                <RoundButton
                  icon="more"
                  label="Дії із заявкою"
                  onPress={() =>
                    showActionSheet(undefined, [
                      {
                        label: 'Редагувати заявку',
                        onPress: async () => {
                          await WebBrowser.openBrowserAsync(
                            `${SITE_URL}/dashboard/jobs/${id}/edit`,
                          )
                          refetch()
                        },
                      },
                      {
                        label: 'Скасувати заявку',
                        destructive: true,
                        onPress: () => void cancelJob(),
                      },
                    ])
                  }
                />
              ) : null}
            </WithBell>
          ),
        }}
      />

      {/* ─── Назва ─── */}
      <View className="gap-2.5 px-1">
        <Text className="text-[13px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
          {/* Номер — за ним підтримка знаходить заявку (Job.number). */}
          {job.number ? `Заявка №${job.number}` : 'Заявка'} ·{' '}
          {formatRelative(job.createdAt)}
        </Text>
        <BalancedText
          accessibilityRole="header"
          className="font-semibold text-foreground"
          style={titleType(job.title)}
        >
          {unbreakHyphens(job.title)}
        </BalancedText>
        <View className="mt-1 flex-row flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <StatusPill
            label={state.label}
            tone={state.tone}
            pulse={state.tone === 'live'}
          />
          {urgent ? (
            <Chip icon="fresh" label="Терміново" tone="orange" />
          ) : null}
          {live ? (
            <Text className="text-[14px] text-muted-foreground">
              Активна ще {expiresIn(job.expiresAt)}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ─── Клієнтові: пропозиції одразу під назвою — він тут, щоб обрати ─── */}
      {isOwner && proposals.length > 0 ? (
        <View className="gap-2">
          <GroupLabel>
            {`${recommended.length > 0 && !showAll ? 'Рекомендуємо для вас' : 'Пропозиції майстрів'} · ${proposals.length}`}
          </GroupLabel>
          <View className="gap-2.5">
            {visible.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                currency={job.currency}
                onAccept={
                  p.status === 'SENT' && open ? () => void accept(p) : undefined
                }
                accepting={accepting === p.id}
                disabled={accepting !== null}
              />
            ))}
          </View>
          {!showAll &&
          recommended.length > 0 &&
          proposals.length > recommended.length ? (
            <Button variant="secondary" onPress={() => setShowAll(true)}>
              {`Показати всі пропозиції (${proposals.length})`}
            </Button>
          ) : null}
        </View>
      ) : null}

      {/* ─── Майстрові: його пропозиція (або чому не можна) — теж угорі ─── */}
      {mine ? (
        <View className="gap-2">
          <GroupLabel>Ваша пропозиція</GroupLabel>
          <ProposalCard proposal={mine} currency={job.currency} mine />
        </View>
      ) : master && !data.canPropose && data.cantProposeReason ? (
        <Notice text={data.cantProposeReason} />
      ) : null}

      {/* ─── Коли і де ─── */}
      {dayLong || place ? (
        <Section title="Коли і де">
          {dayLong ? (
            <InfoRow
              leading={<Tile icon="calendar" tint={TINT.red} />}
              caption="День прибирання"
              value={dayLong}
            />
          ) : null}
          {place ? (
            <InfoRow
              leading={<Tile icon="pin" tint={TINT.blue} />}
              caption={
                master && km !== null
                  ? km < 0.5
                    ? 'Район · ваш район'
                    : `Район · ${formatDistance(km)} від вас`
                  : 'Район'
              }
              value={place}
            />
          ) : null}
        </Section>
      ) : null}

      {/* ─── Бюджет ─── */}
      {budget ? (
        <Section title="Бюджет">
          <InfoRow
            leading={<Tile icon="wallet" tint={TINT.green} />}
            caption={isOwner ? 'Ваш бюджет' : 'Бюджет клієнта'}
            value={
              <Text
                className="text-[17px] font-semibold tracking-[-0.2px] text-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {budget}
              </Text>
            }
          />
        </Section>
      ) : null}

      {/* ─── Замовник (майстрові) ─── */}
      {master ? (
        <Section title="Замовник">
          <InfoRow
            leading={
              <Avatar
                uri={job.client.avatar}
                name={job.client.name ?? 'Замовник'}
                size={30}
              />
            }
            caption={
              job.client.createdAt
                ? `На Zunor з ${memberSince(job.client.createdAt)}`
                : 'Замовник'
            }
            value={
              <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
                <Text className="text-[17px] font-semibold tracking-[-0.2px] text-foreground">
                  {job.client.name ?? 'Замовник'}
                </Text>
                {job.client.reviewsCount > 0 ? (
                  <Rating
                    value={job.client.avgRating}
                    count={job.client.reviewsCount}
                  />
                ) : null}
              </View>
            }
          />
          {/* Чесно, як «Показати телефон» у work.ua: номер — лише після
              вибору майстра (захист контактів до угоди). */}
          <InfoRow
            leading={<Tile icon="phone" tint={TINT.green} />}
            caption="Телефон"
            value={
              <Text className="text-[17px] tracking-[-0.2px] text-muted-foreground">
                Відкриється, щойно клієнт обере вас
              </Text>
            }
          />
        </Section>
      ) : null}

      {/* ─── Об’єкт ─── */}
      {objectRows.length > 0 ? (
        <Section title="Об’єкт" inset="text">
          {objectRows.map((r) => (
            <Row key={r.label} label={r.label} value={r.value} />
          ))}
        </Section>
      ) : null}

      {/* ─── Про заявку ─── */}
      {job.description || job.attachments.length > 0 ? (
        <View className="gap-2">
          <GroupLabel>Про заявку</GroupLabel>
          <View className="gap-4 rounded-[24px] bg-card p-4" style={SQUIRCLE}>
            {job.description ? (
              <Text
                selectable
                className="text-[17px] leading-[25px] text-foreground"
              >
                {job.description}
              </Text>
            ) : null}
            <PhotoGrid urls={job.attachments} />
          </View>
        </View>
      ) : null}

      {/* ─── Асистент ─── */}
      {zunorText ? (
        <Section title="Асистент">
          <View className="p-4">
            <ZunorNote bare text={zunorText} />
          </View>
        </Section>
      ) : null}

      <MetaLine items={footer} />
    </>
  )
}

/** Рейтинг замовника пігулкою: ★ 4.8 (12). */
function Rating({ value, count }: { value: number; count: number }) {
  return (
    <View className="h-6 flex-row items-center gap-1 rounded-full bg-secondary px-2">
      <Glyph name="star" size={11} color="#f5b400" />
      <Text className="text-[12.5px] font-medium text-foreground">
        {value.toFixed(1)}
      </Text>
      <Text className="text-[12.5px] text-muted-foreground">({count})</Text>
    </View>
  )
}

/** Чому майстрові не можна відгукнутись — тихою карткою, без тривоги. */
function Notice({ text }: { text: string }) {
  const c = useColors()
  return (
    <View
      className="flex-row items-center gap-3 rounded-[20px] bg-card p-4"
      style={SQUIRCLE}
    >
      <Glyph
        name="hourglass"
        size={20}
        color={c.mutedForeground}
        weight="medium"
      />
      <Text className="flex-1 text-[15px] leading-[21px] text-muted-foreground">
        {text}
      </Text>
    </View>
  )
}

/** Висота згасання над кнопкою — зміст тут ледь темнішає й іде під неї. */
const FADE = 44

/**
 * «Подати пропозицію» — притиснута донизу, без смуги-підкладки, як кнопки
 * в Telegram: під нею лише м'який градієнт у колір фону (у темній темі —
 * ледь темний), тож текст заходить під кнопку й плавно згасає. Під рукою,
 * хоч де ти на сторінці.
 */
function ProposeBar({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 px-4"
      style={{
        paddingTop: FADE,
        paddingBottom: insets.bottom > 0 ? insets.bottom + 4 : 16,
      }}
    >
      <FooterFade />
      <GlowButton icon="propose" label="Подати пропозицію" onPress={onPress} />
    </View>
  )
}

/**
 * Поки заявка вантажиться — її будова сірими брусками (ui/skeleton):
 * «ЗАЯВКА · …», назва у два рядки, плашка стану, далі групи «Коли і де»,
 * «Бюджет», «Об’єкт» — із тими самими відступами, що в прокрутці нижче.
 */
function JobSkeleton({ top }: { top: number }) {
  return (
    <View className="flex-1 bg-background">
      <Skeleton className="gap-7 px-4" style={{ paddingTop: top + 8 }}>
        <View className="gap-3 px-1">
          <Bone width={150} height={11} />
          <View className="gap-2.5">
            <Bone width="88%" height={22} radius={7} />
            <Bone width="58%" height={22} radius={7} />
          </View>
          <View className="mt-1 flex-row items-center gap-2.5">
            <Bone width={136} height={26} radius={13} />
            <Bone width={96} height={12} />
          </View>
        </View>
        <SectionSkeleton rows={2} />
        <SectionSkeleton rows={1} />
        <SectionSkeleton rows={4} tiles={false} />
      </Skeleton>
    </View>
  )
}

/**
 * Розмір назви заявки — за довжиною, щоб вона лягала в два-три рівні
 * рядки, а не «слово, слово, два слова в кінці» (так попросив власник):
 * коротка — великим, як на сайті (26), звичайна — трохи менше, довга —
 * ще менше. Рядки вирівнює BalancedText.
 */
export function titleType(title: string) {
  const size = title.length <= 26 ? 26 : title.length <= 52 ? 23 : 21
  return {
    fontSize: size,
    lineHeight: Math.round(size * 1.24),
    letterSpacing: -size * 0.02,
  }
}

/**
 * «4-кімнатної» не рветься на дефісі («4-» в кінці рядка, «кімнатної» —
 * на наступному): звичайний дефіс → нерозривний (U+2011).
 */
const NB_HYPHEN = String.fromCharCode(0x2011)

export function unbreakHyphens(text: string): string {
  return text.replace(/(\S)-(?=\S)/g, `$1${NB_HYPHEN}`)
}
