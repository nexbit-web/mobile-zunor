import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EmptyState } from '@/components/empty-state'
import { WithBell } from '@/components/header-bell'
import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { GroupLabel, InfoRow, MetaLine } from '@/components/jobs/job-details'
import { titleType, unbreakHyphens } from '@/components/jobs/job-screen'
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
import { StatusPill, type PillTone } from '@/components/ui/status-pill'
import { SQUIRCLE, Tile, TINT } from '@/components/ui/tile'
import { showActionSheet } from '@/lib/action-sheet'
import { api, errorText } from '@/lib/api'
import { authClient } from '@/lib/auth'
import { confirmAction } from '@/lib/confirm'
import {
  HEADER_BAR,
  useHeaderScroll,
  useLargeTitleScroll,
} from '@/lib/large-title'
import { useColors } from '@/lib/theme'
import { describeJob, resolveWhen, serviceLabel } from '@/shared/cleaning'
import { formatDayLong, formatRelative, pluralUk } from '@/shared/format'
import {
  formatPrice,
  ORDER_STATUS_LABEL,
  type OrderDetail,
  type OrderReview,
  type OrderStatus,
} from '@/shared/orders'

/** Колір стану — той самий, що в картці замовлення (order-card). */
export const ORDER_TONE: Record<OrderStatus, PillTone> = {
  CREATED: 'progress',
  IN_PROGRESS: 'live',
  COMPLETED: 'done',
  CANCELLED: 'off',
}

/** Жовта зірка рейтингу — як у картці заявки (amber-400 сайту). */
const STAR = '#fbbf24'

type Viewer = 'client' | 'master'
type Step = 'start' | 'complete'

const orderKey = (id: string) => ['order', id] as const

/**
 * Замовлення — для клієнта й майстра, у тій самій згрупованій подачі iOS,
 * що й заявка (job-screen):
 *
 *   ЗАМОВЛЕННЯ · №… · велика назва · стан і що зараз відбувається
 *   МАЙСТЕР / КЛІЄНТ — хто (рейтинг, перевірка, виконані), телефон;
 *     під карткою — «Написати» й «Подзвонити» (телефон — лише тут: угода
 *     вже є, MANIFESTO «захист контактів до угоди»)
 *   КОЛИ · ЦІНА · ОБ’ЄКТ · КОМЕНТАР — те, про що домовились
 *   ВІДГУКИ (після завершення) — свій відгук формою, відгук другої сторони
 *   «Відкрити заявку» · підвал: створено · номер
 *
 * Майстрові внизу — головна дія стану: «Почати роботу» → «Завершити
 * роботу», як «Подати пропозицію» на заявці. Скасування — у «⋯» шапки:
 * воно незворотне. Дані — GET /api/orders/[id] (web:
 * $lib/server/order-detail, ті самі, що на сторінці сайту), переходи —
 * POST /api/orders/[id]/[action] (стейт-машина сайту вирішує, кому що).
 */
export function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const c = useColors()
  const qc = useQueryClient()
  const { data: session } = authClient.useSession()
  const me = session?.user.id
  const { top, padTop, scrollProps } = useLargeTitleScroll({ refresh: true })
  const y = useHeaderScroll()
  const [stepping, setStepping] = useState(false)

  const q = useQuery({
    queryKey: orderKey(id),
    queryFn: async () =>
      (
        await api<{ order: OrderDetail }>(
          `/api/orders/${encodeURIComponent(id)}`,
        )
      ).order,
  })
  const { refreshing, onRefresh } = usePullRefresh(() => q.refetch())

  if (q.isPending) return <OrderSkeleton top={top} />

  if (q.isError) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: top }}>
        <EmptyState
          icon="warning"
          title="Замовлення не відкрито"
          text={errorText(q.error)}
          action={{ label: 'Спробувати ще', onPress: () => void q.refetch() }}
        />
      </View>
    )
  }

  const order = q.data
  const viewer: Viewer = order.clientId === me ? 'client' : 'master'
  const step: Step | null =
    viewer === 'master'
      ? order.status === 'CREATED'
        ? 'start'
        : order.status === 'IN_PROGRESS'
          ? 'complete'
          : null
      : null

  /** Перехід стану; замовлення й списки — свіжі. Кидає назовні. */
  async function transition(action: 'start' | 'complete' | 'cancel') {
    await api(`/api/orders/${encodeURIComponent(order.id)}/${action}`, {
      method: 'POST',
      json: {},
    })
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: orderKey(order.id) }),
      qc.invalidateQueries({ queryKey: ['orders'] }),
    ])
  }

  async function doStep(s: Step) {
    const ok = await confirmAction(
      s === 'start' ? 'Почати роботу?' : 'Роботу завершено?',
      {
        confirm: s === 'start' ? 'Почати' : 'Завершити',
        cancel: 'Назад',
        message:
          s === 'start'
            ? 'Клієнт отримає сповіщення, що ви взялися за роботу.'
            : 'Клієнт отримає сповіщення й зможе залишити відгук. Змінити це вже не вийде.',
      },
    )
    if (!ok) return
    setStepping(true)
    try {
      await transition(s)
    } catch (err) {
      Alert.alert('Не вдалося', errorText(err))
    } finally {
      setStepping(false)
    }
  }

  async function cancel() {
    const ok = await confirmAction('Скасувати замовлення?', {
      confirm: 'Скасувати замовлення',
      cancel: 'Назад',
      destructive: true,
      message:
        viewer === 'master'
          ? 'Заявка повернеться в пошук, і клієнт обере іншого майстра. Скасування не можна відмінити.'
          : 'Майстер отримає сповіщення. Скасування не можна відмінити.',
    })
    if (!ok) return
    try {
      await transition('cancel')
    } catch (err) {
      Alert.alert('Не вдалося скасувати', errorText(err))
    }
  }

  const cancellable =
    order.status === 'CREATED' || order.status === 'IN_PROGRESS'

  return (
    <View className="flex-1 bg-background">
      {/* Скасування — рідкісне й незворотне: у «⋯», а не кнопкою на виду. */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <WithBell>
              {cancellable ? (
                <RoundButton
                  icon="more"
                  label="Дії із замовленням"
                  onPress={() =>
                    showActionSheet(undefined, [
                      {
                        label: 'Скасувати замовлення',
                        destructive: true,
                        onPress: () => void cancel(),
                      },
                    ])
                  }
                />
              ) : null}
            </WithBell>
          ),
        }}
      />
      <Animated.ScrollView
        {...scrollProps}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-7 px-4"
        contentContainerStyle={{
          paddingTop: padTop + 8,
          paddingBottom: insets.bottom + (step ? 96 : 32),
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            {...refreshLook(c, top)}
          />
        }
      >
        <OrderBody order={order} viewer={viewer} me={me} />
      </Animated.ScrollView>
      <PullIndicator
        y={y}
        top={insets.top + HEADER_BAR}
        refreshing={refreshing}
      />
      {step ? (
        <StepBar
          step={step}
          loading={stepping}
          onPress={() => void doStep(step)}
        />
      ) : null}
    </View>
  )
}

/** Що зараз із замовленням — одним реченням під станом. */
function statusHint(order: OrderDetail, viewer: Viewer, me?: string): string {
  switch (order.status) {
    case 'CREATED':
      return viewer === 'client'
        ? 'Майстра обрано. Домовтеся в чаті про час і деталі.'
        : 'Клієнт обрав вас. Домовтеся в чаті й почніть роботу в призначений день.'
    case 'IN_PROGRESS':
      return viewer === 'client'
        ? 'Майстер працює над замовленням.'
        : 'Коли закінчите — позначте роботу завершеною.'
    case 'COMPLETED':
      return order.completedAt
        ? `Роботу завершено ${formatRelative(order.completedAt)}.`
        : 'Роботу завершено.'
    case 'CANCELLED': {
      const who =
        order.cancelledById === me
          ? 'Ви скасували'
          : order.cancelledById === order.masterId
            ? 'Майстер скасував'
            : order.cancelledById === order.clientId
              ? 'Клієнт скасував'
              : 'Скасовано'
      return order.cancelledAt
        ? `${who} ${formatRelative(order.cancelledAt)}.`
        : `${who}.`
    }
  }
}

function OrderBody({
  order,
  viewer,
  me,
}: {
  order: OrderDetail
  viewer: Viewer
  me?: string
}) {
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const service = typeof meta.service === 'string' ? meta.service : null
  // День прибирання: «today/tomorrow» — відносно дня створення ЗАЯВКИ.
  const iso = resolveWhen(meta.when, order.jobCreatedAt ?? order.createdAt)
  const dayLong = iso ? formatDayLong(iso) : ''
  const price = formatPrice(order.priceCents, order.currency)
  // Номер для людей — номер заявки (за ним підтримка знаходить
  // замовлення); старі без нього — хвіст id, як було.
  const shortId = order.jobNumber
    ? String(order.jobNumber)
    : order.id.slice(-8).toUpperCase()

  const specs = describeJob(order.metadata)
  const objectRows = [
    ...(service
      ? [{ label: 'Тип прибирання', value: serviceLabel(service) }]
      : []),
    ...specs
      .filter((s) => s.label !== 'Послуга' && !s.items && s.value)
      .map((s) => ({ label: s.label, value: s.value })),
    ...(specs.find((s) => s.items)?.items ?? []).map((it) => ({
      label: it.name,
      value: it.qty > 1 ? `× ${it.qty}` : '1 шт.',
    })),
  ]

  const myDirection =
    viewer === 'client' ? 'CLIENT_TO_MASTER' : 'MASTER_TO_CLIENT'
  const myReview = order.reviews.find((r) => r.direction === myDirection)
  const theirReview = order.reviews.find((r) => r.direction !== myDirection)
  const peerWord = viewer === 'client' ? 'майстра' : 'клієнта'

  return (
    <>
      {/* ─── Назва ─── */}
      <View className="gap-2.5 px-1">
        <Text className="text-[13px] font-semibold uppercase tracking-[0.5px] text-muted-foreground">
          Замовлення · №{shortId}
        </Text>
        <BalancedText
          accessibilityRole="header"
          className="font-semibold text-foreground"
          style={titleType(order.title)}
        >
          {unbreakHyphens(order.title)}
        </BalancedText>
        <View className="mt-1 flex-row flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <StatusPill
            label={ORDER_STATUS_LABEL[order.status]}
            tone={ORDER_TONE[order.status]}
            pulse={order.status === 'IN_PROGRESS'}
          />
        </View>
        <Text className="text-[15px] leading-[21px] text-muted-foreground">
          {statusHint(order, viewer, me)}
        </Text>
      </View>

      {/* ─── Друга сторона угоди ─── */}
      <Peer order={order} viewer={viewer} />

      {/* ─── Коли й ціна ─── */}
      {dayLong || price ? (
        <Section title="Про що домовились">
          {dayLong ? (
            <InfoRow
              leading={<Tile icon="calendar" tint={TINT.red} />}
              caption="День прибирання"
              value={dayLong}
            />
          ) : null}
          {price ? (
            <InfoRow
              leading={<Tile icon="wallet" tint={TINT.green} />}
              caption={viewer === 'client' ? 'Ціна майстра' : 'Ваша ціна'}
              value={
                <Text
                  className="text-[17px] font-semibold tracking-[-0.2px] text-foreground"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {price}
                </Text>
              }
            />
          ) : null}
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

      {/* ─── Коментар ─── */}
      {order.description ? (
        <View className="gap-2">
          <GroupLabel>Про замовлення</GroupLabel>
          <View className="rounded-[24px] bg-card p-4" style={SQUIRCLE}>
            <Text
              selectable
              className="text-[17px] leading-[25px] text-foreground"
            >
              {order.description}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ─── Причина скасування ─── */}
      {order.status === 'CANCELLED' && order.cancelReason ? (
        <View className="gap-2">
          <GroupLabel>Причина скасування</GroupLabel>
          <View className="rounded-[24px] bg-card p-4" style={SQUIRCLE}>
            <Text
              selectable
              className="text-[17px] leading-[25px] text-foreground"
            >
              {order.cancelReason}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ─── Відгуки ─── */}
      {order.status === 'COMPLETED' ? (
        <View className="gap-2.5">
          <GroupLabel>Відгуки</GroupLabel>
          {myReview ? (
            <ReviewCard title="Ваш відгук" review={myReview} />
          ) : (
            <ReviewForm orderId={order.id} viewer={viewer} />
          )}
          {theirReview ? (
            <ReviewCard
              title={
                viewer === 'client'
                  ? 'Відгук майстра про вас'
                  : 'Відгук клієнта про вас'
              }
              review={theirReview}
            />
          ) : (
            <Quiet icon="hourglass" text={`Очікуємо відгук від ${peerWord}.`} />
          )}
        </View>
      ) : null}

      {/* ─── Заявка, з якої все почалось ─── */}
      {order.jobId ? (
        <Section>
          <Row
            icon="document"
            tint={TINT.gray}
            label="Відкрити заявку"
            onPress={() =>
              router.push({
                pathname: '/job/[id]',
                params: { id: order.jobId as string },
              })
            }
          />
        </Section>
      ) : null}

      <MetaLine
        items={[
          {
            icon: 'clock',
            text: `Створено ${formatRelative(order.createdAt)}`,
          },
          { icon: 'document', text: `№${shortId}` },
        ]}
      />
    </>
  )
}

/**
 * Друга сторона: клієнтові — майстер (перевірений, виконані замовлення,
 * рейтинг), майстрові — клієнт (рейтинг як клієнта). Телефон рядком, під
 * карткою — «Написати» й «Подзвонити».
 */
function Peer({ order, viewer }: { order: OrderDetail; viewer: Viewer }) {
  const c = useColors()
  const [opening, setOpening] = useState(false)
  const peer = viewer === 'client' ? order.master : order.client
  const name =
    peer.name || peer.username || (viewer === 'client' ? 'Майстер' : 'Клієнт')
  const phone = peer.phone?.trim() || null
  const done = viewer === 'client' ? order.master.completedOrders : 0

  const caption =
    viewer === 'client'
      ? done > 0
        ? `Майстер · ${done} ${pluralUk(done, 'виконане замовлення', 'виконані замовлення', 'виконаних замовлень')}`
        : 'Майстер'
      : 'Клієнт'

  async function openChat() {
    if (opening) return
    if (order.chatId) {
      router.push({ pathname: '/chat/[id]', params: { id: order.chatId } })
      return
    }
    // Чат заводиться на першому натисканні, як на сайті: інакше кожен вибір
    // майстра плодив би порожню розмову в обох списках.
    setOpening(true)
    try {
      const { chatId } = await api<{ chatId: string }>(
        `/api/orders/${encodeURIComponent(order.id)}/chat`,
        { method: 'POST' },
      )
      router.push({ pathname: '/chat/[id]', params: { id: chatId } })
    } catch (err) {
      Alert.alert('Не вдалося відкрити чат', errorText(err))
    } finally {
      setOpening(false)
    }
  }

  function call() {
    if (!phone) return
    void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() =>
      Alert.alert('Не вдалося подзвонити', phone),
    )
  }

  return (
    <View className="gap-2.5">
      <Section title={viewer === 'client' ? 'Майстер' : 'Клієнт'}>
        <InfoRow
          leading={<Avatar uri={peer.avatar} name={name} size={40} />}
          caption={caption}
          value={
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <View className="shrink flex-row items-center gap-1.5">
                <Text
                  numberOfLines={1}
                  className="shrink text-[17px] font-semibold tracking-[-0.2px] text-foreground"
                >
                  {name}
                </Text>
                {viewer === 'client' && order.master.isVerified ? (
                  <Glyph name="verified" size={15} color={c.primary} />
                ) : null}
              </View>
              {peer.reviewsCount > 0 ? (
                <Rating value={peer.avgRating} count={peer.reviewsCount} />
              ) : null}
            </View>
          }
        />
        <InfoRow
          leading={<Tile icon="phone" tint={TINT.green} />}
          caption="Телефон"
          value={
            phone ? (
              <Text
                selectable
                className="text-[17px] font-semibold tracking-[-0.2px] text-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {phone}
              </Text>
            ) : (
              <Text className="text-[17px] tracking-[-0.2px] text-muted-foreground">
                Не вказано
              </Text>
            )
          }
        />
      </Section>
      <View className="flex-row gap-2.5">
        <ContactButton
          icon="chats"
          label="Написати"
          loading={opening}
          onPress={() => void openChat()}
        />
        <ContactButton
          icon="phone"
          label="Подзвонити"
          disabled={!phone}
          onPress={call}
        />
      </View>
    </View>
  )
}

/** Кнопка звʼязку під карткою людини — як «повідомлення / дзвінок» в iOS. */
function ContactButton({
  icon,
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  icon: GlyphName
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}) {
  const c = useColors()
  const color = disabled ? c.mutedForeground : c.primary
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={`h-[64px] flex-1 items-center justify-center gap-1 rounded-[20px] bg-shell active:opacity-70 ${
        disabled ? 'opacity-50' : ''
      }`}
      style={SQUIRCLE}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Glyph name={icon} size={21} color={color} weight="medium" />
      )}
      <Text className="text-[13.5px] font-medium" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  )
}

/** Рейтинг пігулкою: ★ 4.8 (12). */
function Rating({ value, count }: { value: number; count: number }) {
  return (
    <View className="h-6 flex-row items-center gap-1 rounded-full bg-secondary px-2">
      <Glyph name="star" size={11} color={STAR} />
      <Text className="text-[12.5px] font-medium text-foreground">
        {value.toFixed(1)}
      </Text>
      <Text className="text-[12.5px] text-muted-foreground">({count})</Text>
    </View>
  )
}

/** Пʼять зірок — показ оцінки або вибір (`onPick`). */
function Stars({
  value,
  size,
  onPick,
}: {
  value: number
  size: number
  onPick?: (n: number) => void
}) {
  const c = useColors()
  return (
    <View
      className="flex-row items-center"
      style={{ gap: size > 20 ? 8 : 3 }}
      accessibilityRole={onPick ? undefined : 'image'}
      accessibilityLabel={onPick ? undefined : `Оцінка ${value} з 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const star = (
          <Glyph name="star" size={size} color={n <= value ? STAR : c.input} />
        )
        return onPick ? (
          <Pressable
            key={n}
            hitSlop={4}
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.selectionAsync()
              onPick(n)
            }}
            accessibilityRole="button"
            accessibilityLabel={`${n} з 5`}
          >
            {star}
          </Pressable>
        ) : (
          <View key={n}>{star}</View>
        )
      })}
    </View>
  )
}

function ReviewCard({ title, review }: { title: string; review: OrderReview }) {
  return (
    <View className="gap-2 rounded-[24px] bg-card p-4" style={SQUIRCLE}>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="shrink text-[15px] font-semibold text-foreground">
          {title}
        </Text>
        <Stars value={review.rating} size={14} />
      </View>
      {review.comment ? (
        <Text selectable className="text-[16px] leading-[23px] text-foreground">
          {review.comment}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * Свій відгук — прямо тут: зірки й кілька слів (POST /api/reviews, той
 * самий, що форма на сайті). Відгук про майстра бачать інші клієнти, про
 * клієнта — майстри.
 */
function ReviewForm({ orderId, viewer }: { orderId: string; viewer: Viewer }) {
  const c = useColors()
  const qc = useQueryClient()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  async function send() {
    if (!rating || busy) return
    setBusy(true)
    try {
      await api('/api/reviews', {
        method: 'POST',
        json: { orderId, rating, comment: comment.trim() || null },
      })
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
      await qc.invalidateQueries({ queryKey: orderKey(orderId) })
    } catch (err) {
      Alert.alert('Не вдалося надіслати відгук', errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="gap-4 rounded-[24px] bg-card p-4" style={SQUIRCLE}>
      <View className="gap-1">
        <Text className="text-[17px] font-semibold text-foreground">
          Як усе пройшло?
        </Text>
        <Text className="text-[14.5px] leading-[20px] text-muted-foreground">
          {viewer === 'client'
            ? 'Оцініть майстра — відгук побачать інші клієнти.'
            : 'Оцініть клієнта — це допоможе іншим майстрам.'}
        </Text>
      </View>
      <Stars value={rating} size={34} onPick={setRating} />
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Кілька слів про співпрацю (необовʼязково)"
        placeholderTextColor={c.mutedForeground}
        multiline
        maxLength={2000}
        textAlignVertical="top"
        className="min-h-[88px] rounded-[14px] bg-field px-3.5 py-3 text-foreground"
        style={{ fontSize: 16, lineHeight: 22 }}
      />
      <Button onPress={() => void send()} loading={busy} disabled={!rating}>
        Надіслати відгук
      </Button>
    </View>
  )
}

/** Тиха картка без тривоги: «Очікуємо відгук…». */
function Quiet({ icon, text }: { icon: GlyphName; text: string }) {
  const c = useColors()
  return (
    <View
      className="flex-row items-center gap-3 rounded-[20px] bg-card p-4"
      style={SQUIRCLE}
    >
      <Glyph name={icon} size={20} color={c.mutedForeground} weight="medium" />
      <Text className="flex-1 text-[15px] leading-[21px] text-muted-foreground">
        {text}
      </Text>
    </View>
  )
}

/** Висота згасання над кнопкою — як на заявці. */
const FADE = 44

/**
 * Головна дія майстра — притиснута донизу, як «Подати пропозицію» на
 * заявці: «Почати роботу», потім «Завершити роботу».
 */
function StepBar({
  step,
  loading,
  onPress,
}: {
  step: Step
  loading: boolean
  onPress: () => void
}) {
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
      <GlowButton
        icon={step === 'start' ? 'nStarted' : 'check'}
        label={step === 'start' ? 'Почати роботу' : 'Завершити роботу'}
        loading={loading}
        onPress={onPress}
      />
    </View>
  )
}

/** Поки вантажиться — будова екрана сірими брусками, як у заявки. */
function OrderSkeleton({ top }: { top: number }) {
  return (
    <View className="flex-1 bg-background">
      <Skeleton className="gap-7 px-4" style={{ paddingTop: top + 8 }}>
        <View className="gap-3 px-1">
          <Bone width={170} height={11} />
          <View className="gap-2.5">
            <Bone width="86%" height={22} radius={7} />
            <Bone width="54%" height={22} radius={7} />
          </View>
          <Bone width={110} height={26} radius={13} />
          <Bone width="92%" height={12} />
        </View>
        <SectionSkeleton rows={2} />
        <SectionSkeleton rows={2} />
        <SectionSkeleton rows={3} tiles={false} />
      </Skeleton>
    </View>
  )
}
