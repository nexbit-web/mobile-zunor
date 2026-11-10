import { Drawer } from 'expo-router/drawer'
import { NativeTabs } from 'expo-router/native-tabs'

import { ClientDrawer } from '@/components/drawer/client-drawer'
import { authClient, roleOf } from '@/lib/auth'
import { useColors } from '@/lib/theme'

/**
 * Каркас застосунку — за роллю, на тих самих маршрутах:
 * - клієнт — як застосунок ІІ: увесь екран — розмова з Zunor, розділи в
 *   бічній панелі (кнопка меню зліва вгорі або свайп від лівого краю);
 * - майстер — системні вкладки знизу, перша — стрічка заявок.
 */
export default function AppLayout() {
  const { data: session } = authClient.useSession()
  return roleOf(session?.user) === 'MASTER' ? <MasterTabs /> : <ClientShell />
}

function ClientShell() {
  const c = useColors()
  return (
    <Drawer
      drawerContent={(props) => <ClientDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        // Екран відʼїжджає вправо разом із панеллю (DrawerScene малює
        // йому заокруглення), без затемнення.
        drawerType: 'slide',
        overlayColor: 'transparent',
        drawerStyle: { width: '84%', backgroundColor: c.card },
        sceneStyle: { backgroundColor: c.background },
        swipeEdgeWidth: 48,
      }}
    >
      <Drawer.Screen name="(home)" />
      <Drawer.Screen name="orders" />
      <Drawer.Screen name="messages" />
      <Drawer.Screen name="profile" />
    </Drawer>
  )
}

/**
 * Майстер: системні вкладки (на iOS 26 — Liquid Glass). Сповіщення —
 * дзвіночком у шапці (TabStack), не вкладкою.
 */
function MasterTabs() {
  const c = useColors()
  return (
    <NativeTabs tintColor={c.primary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Стрічка</NativeTabs.Trigger.Label>
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
