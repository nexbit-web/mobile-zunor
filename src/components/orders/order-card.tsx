import * as WebBrowser from 'expo-web-browser'
import { Pressable, Text, View } from 'react-native'

import {
  CARD,
  CardDivider,
  ServiceHeader,
  SQUIRCLE,
  TagRow,
} from '@/components/jobs/card-parts'
import { Avatar } from '@/components/ui/avatar'
import { StatusPill, type PillTone } from '@/components/ui/status-pill'
import { SITE_URL } from '@/lib/config'
import { jobTags, resolveWhen } from '@/shared/cleaning'
import { formatDay, formatRelative } from '@/shared/format'
import {
  formatPrice,
  ORDER_STATUS_LABEL,
  type OrderListItem,
  type OrderStatus,
} from '@/shared/orders'

/**
 * Колір стану — як order-card.svelte на сайті: створено — бурштин (майстра
 * обрано, робота попереду), в роботі — акцент із «пульсом» (іде просто
 * зараз), завершено — зелений, скасовано — сірий.
 */
const TONE: Record<OrderStatus, PillTone> = {
  CREATED: 'progress',
  IN_PROGRESS: 'live',
  COMPLETED: 'done',
  CANCELLED: 'off',
}

/**
 * Картка замовлення — тією ж мовою, що картка заявки: плитка послуги й
 * день, стан, назва, характеристики, а внизу — друга сторона угоди
 * (клієнтові — майстер, майстрові — клієнт) і ціна. Опису немає навмисно:
 * замовлення людина вже знає, у списку вона шукає «яке з них» і «що з ним
 * зараз». Екрана замовлення в застосунку ще немає — відкриваємо на сайті.
 */
export function OrderCard({
  order,
  viewer,
}: {
  order: OrderListItem
  viewer: 'client' | 'master'
}) {
  const meta = order.metadata ?? {}
  // «today/tomorrow» — відносно дня створення ЗАЯВКИ, не замовлення.
  const iso = resolveWhen(meta.when, order.jobCreatedAt ?? order.createdAt)
  const day = iso ? formatDay(iso) : ''
  const peer = viewer === 'client' ? order.master : order.client
  const peerName = peer?.name || peer?.username || 'Без імені'
  const price = formatPrice(order.priceCents, order.currency)
  const cancelled = order.status === 'CANCELLED'

  return (
    <Pressable
      onPress={() =>
        WebBrowser.openBrowserAsync(`${SITE_URL}/dashboard/orders/${order.id}`)
      }
      accessibilityRole="button"
      className={CARD}
      style={SQUIRCLE}
    >
      <View
        className="gap-3.5 p-4"
        style={cancelled ? { opacity: 0.6 } : undefined}
      >
        <ServiceHeader
          service={meta.service}
          day={day}
          right={
            <StatusPill
              label={ORDER_STATUS_LABEL[order.status]}
              tone={TONE[order.status]}
              pulse={order.status === 'IN_PROGRESS'}
            />
          }
        />

        <Text
          numberOfLines={2}
          className="text-[18px] font-bold leading-[23px] tracking-[-0.3px] text-foreground"
        >
          {order.title}
        </Text>

        <TagRow tags={jobTags(meta)} />

        <CardDivider />

        <View className="flex-row items-center gap-3">
          <Avatar uri={peer?.avatar} name={peerName} size={40} />
          <View className="flex-1 gap-0.5">
            <Text
              numberOfLines={1}
              className="text-[15.5px] font-semibold text-foreground"
            >
              {peerName}
            </Text>
            <Text numberOfLines={1} className="text-[13px] text-muted-foreground">
              {viewer === 'client' ? 'Майстер' : 'Клієнт'} · оновлено{' '}
              {formatRelative(order.updatedAt)}
            </Text>
          </View>
          {price ? (
            <Text
              className="text-[18px] font-bold text-foreground"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {price}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}
