import { NativeTabs } from 'expo-router/native-tabs'

import { authClient, roleOf } from '@/lib/auth'
import { useColors } from '@/lib/theme'

/**
 * Нижні вкладки — системні (на iOS 26 — Liquid Glass, на Android —
 * Material). Склад — як панель кабінету на сайті; перша вкладка майстрові
 * — стрічка заявок, клієнтові — його заявки.
 */
export default function AppTabs() {
  const { data: session } = authClient.useSession()
  const master = roleOf(session?.user) === 'MASTER'
  const c = useColors()

  return (
    <NativeTabs tintColor={c.primary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="(jobs)">
        <NativeTabs.Trigger.Label>
          {master ? 'Стрічка' : 'Заявки'}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'list.bullet.rectangle',
            selected: 'list.bullet.rectangle.fill',
          }}
          md="list_alt"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="orders">
        <NativeTabs.Trigger.Label>Замовлення</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'checkmark.seal', selected: 'checkmark.seal.fill' }}
          md="handshake"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="messages">
        <NativeTabs.Trigger.Label>Чати</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'bubble.left.and.bubble.right',
            selected: 'bubble.left.and.bubble.right.fill',
          }}
          md="chat"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="notifications">
        <NativeTabs.Trigger.Label>Сповіщення</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bell', selected: 'bell.fill' }}
          md="notifications"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Профіль</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'person.crop.circle',
            selected: 'person.crop.circle.fill',
          }}
          md="account_circle"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
