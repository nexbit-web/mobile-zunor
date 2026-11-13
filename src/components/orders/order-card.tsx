import { Link } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

import { ServiceIcon } from '@/components/icons/service-icon'
import { Chevron, SQUIRCLE } from '@/components/jobs/card-parts'
import { FactRow, JOB_CARD } from '@/components/jobs/job-card'
import { ORDER_TONE } from '@/components/orders/order-screen'
import { Avatar } from '@/components/ui/avatar'
import { StatusPill } from '@/components/ui/status-pill'
import { useColors } from '@/lib/theme'
import { jobTags, resolveWhen, serviceLabel } from '@/shared/cleaning'
import { formatDay, formatRelative } from '@/shared/format'
import {
  formatPrice,
  ORDER_STATUS_LABEL,
  type OrderListItem,
} from '@/shared/orders'

/**
 * Картка замовлення — тією ж мовою, що картка заявки (job-card, як
 * вакансія на work.ua; власник попросив «у нашому звичайному стилі»):
 * назва великим із шевроном, під нею факти рядками з сірими іконками —
 * ціна жирним, послуга й день, друга сторона угоди (клієнтові — майстер,
 * майстрові — клієнт) з фото, характеристики через крапку; унизу — коли
 * щось змінилось і стан праворуч. Опису немає навмисно: замовлення людина
 * вже знає, у списку вона шукає «яке з них» і «що з ним зараз».
 *
 * Дотик — екран замовлення в застосунку (order-screen): там друга
 * сторона з телефоном, чат, дії й відгуки.
 */
export function OrderCard({
  order,
  viewer,
}: {
  order: OrderListItem
  viewer: 'client' | 'master'
}) {
  const c = useColors()
  const meta = order.metadata ?? {}
  // «today/tomorrow» — відносно дня створення ЗАЯВКИ, не замовлення.
  const iso = resolveWhen(meta.when, order.jobCreatedAt ?? order.createdAt)
  const day = iso ? formatDay(iso) : ''
  const service =
    typeof meta.service === 'string' ? serviceLabel(meta.service) : 'Прибирання'
  const peer = viewer === 'client' ? order.master : order.client
  const peerName = peer?.name || peer?.username || 'Без імені'
  const price = formatPrice(order.priceCents, order.currency)
  const tags = jobTags(meta)
  // Скасовані — пригашені: це вже історія.
  const dimmed = order.status === 'CANCELLED'

  return (
    <Link href={{ pathname: '/order/[id]', params: { id: order.id } }} asChild>
      <Pressable accessibilityRole="button" className="active:opacity-85">
        <View className={JOB_CARD} style={SQUIRCLE}>
          <View
            className="px-5 py-[18px]"
            style={dimmed ? { opacity: 0.6 } : undefined}
          >
            <View className="flex-row items-start gap-3">
              <Text
                numberOfLines={3}
                className="flex-1 text-[19px] font-semibold leading-[25px] tracking-[-0.2px] text-foreground"
              >
                {order.title}
              </Text>
              {/* По центру першого рядка назви. */}
              <View className="h-[25px] justify-center">
                <Chevron />
              </View>
            </View>

            <View className="mt-2.5 gap-1.5">
              {price ? (
                <FactRow icon="wallet">
                  <Text
                    className="text-[14.5px] font-semibold leading-[20px] text-foreground"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {price}
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

              <FactRow
                icon={<Avatar uri={peer?.avatar} name={peerName} size={18} />}
              >
                <Text
                  numberOfLines={1}
                  className="text-[14.5px] font-medium leading-[20px] text-foreground"
                >
                  {peerName}
                  <Text className="font-normal text-muted-foreground">
                    {viewer === 'client' ? ' · майстер' : ' · клієнт'}
                  </Text>
                </Text>
              </FactRow>

              {tags.length ? (
                <FactRow icon="file-text">
                  <Text
                    numberOfLines={2}
                    className="text-[14.5px] leading-[20px] text-foreground"
                  >
                    {tags.join(' · ')}
                  </Text>
                </FactRow>
              ) : null}
            </View>

            <View className="mt-3.5 min-h-6 flex-row items-center justify-between gap-4">
              <Text
                numberOfLines={1}
                className="shrink text-[13.5px] text-muted-foreground"
              >
                {formatRelative(order.updatedAt)}
              </Text>
              <View className="shrink-0">
                <StatusPill
                  label={ORDER_STATUS_LABEL[order.status]}
                  tone={ORDER_TONE[order.status]}
                  pulse={order.status === 'IN_PROGRESS'}
                />
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  )
}
