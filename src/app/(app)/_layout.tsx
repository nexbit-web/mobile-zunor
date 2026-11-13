import * as Haptics from 'expo-haptics'
import { Tabs } from 'expo-router/js-tabs'
import { Drawer } from 'expo-router/drawer'
import { NativeTabs } from 'expo-router/native-tabs'
import { Platform, useWindowDimensions } from 'react-native'

import { useUnreadChats } from '@/components/chat/use-chats'
import {
  BottomDock,
  CLIENT_TABS,
  MASTER_TABS,
} from '@/components/dock/bottom-dock'
import { ClientDrawerNavigator } from '@/components/drawer/client-drawer-navigator'
import { PushBridge } from '@/components/push-bridge'
import { RealtimeBridge } from '@/components/realtime-bridge'
import { authClient, roleOf } from '@/lib/auth'
import {
  CHAT_TRANSITION,
  chatScene,
  CLIENT_DOCK,
  DockSpace,
  isChatOpening,
  MASTER_DOCK,
  openChat,
  stillScene,
  useDockSpace,
} from '@/lib/dock'
import { useColors } from '@/lib/theme'

/**
 * Каркас застосунку — за роллю, на тих самих маршрутах:
 * - клієнт — як застосунок ІІ: головна — розмова з Zunor, бічна панель
 *   (кнопка меню зліва вгорі або свайп від лівого краю); розділи — у ній
 *   або (прототип, lib/dock) у нижній панелі;
 * - майстер — вкладки знизу (наша нижня панель без «+» або системні —
 *   lib/dock, MASTER_DOCK), перша — стрічка заявок.
 */
export default function AppLayout() {
  const { data: session } = authClient.useSession()
  return (
    <>
      {/* Живий канал (Pusher) — поки людина в застосунку. */}
      <RealtimeBridge />
      {/* Push: оновити запис пристрою, відкрити те, до чого торкнулись. */}
      {Platform.OS === 'web' ? null : <PushBridge />}
      {roleOf(session?.user) === 'MASTER' ? (
        MASTER_DOCK ? (
          <MasterDockShell />
        ) : (
          <MasterTabs />
        )
      ) : CLIENT_DOCK ? (
        <ClientDockShell />
      ) : (
        <ClientShell />
      )}
    </>
  )
}

/**
 * Клієнт: головна — розмова з Zunor, розділи — у бічній панелі (кнопка ☰
 * або свайп від лівого краю).
 */
function ClientShell() {
  return (
    <ClientDrawerNavigator>
      <Drawer.Screen name="(home)" />
      <Drawer.Screen name="orders" />
      <Drawer.Screen name="messages" />
      <Drawer.Screen name="alerts" />
      <Drawer.Screen name="profile" />
    </ClientDrawerNavigator>
  )
}

/**
 * ПРОТОТИП (lib/dock): клієнт із нижньою панеллю. Розділи («Замовлення ·
 * Чати · Сповіщення · Профіль») і розмова з Zunor — JS-вкладки: лише в
 * них під час переходу видно обидва екрани. «+» панелі — розмова
 * виїжджає знизу поверх розділу; «✕» у розмові — вона їде вниз над
 * розділом (lib/dock: chatScene). Між розділами — миттєво, їде лише
 * підсвітка в панелі (чому — lib/dock, stillScene). Бічна панель (історія заявок) —
 * у самій розмові: app/(app)/(home)/_layout.
 */
function ClientDockShell() {
  const c = useColors()
  const space = useDockSpace()
  const { height } = useWindowDimensions()
  return (
    <DockSpace value={space}>
      <Tabs
        tabBar={({ state, navigateToTab }) => {
          const current = state.routes[state.index]?.name
          // На розмові панелі немає — вона гасне, поки та виїжджає.
          return current === '(home)' ? null : (
            <BottomDock
              tabs={CLIENT_TABS}
              current={current}
              onPick={(route) => {
                const target = state.routes.find((r) => r.name === route)
                if (target) navigateToTab(target.key)
              }}
              onCompose={() => openChat()}
            />
          )
        }}
        // Функцією — щоб читати `isChatOpening()` на кожному переході.
        screenOptions={() => ({
          headerShown: false,
          sceneStyle: { backgroundColor: c.background },
          // Розділ лишається видимим (і нерухомим) під розмовою лише поки
          // та виїжджає; між розділами — без переходу, одразу.
          ...(isChatOpening()
            ? {
                animation: 'fade' as const,
                transitionSpec: CHAT_TRANSITION,
                sceneStyleInterpolator: stillScene,
              }
            : { animation: 'none' as const }),
        })}
      >
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="messages" />
        <Tabs.Screen name="alerts" />
        <Tabs.Screen name="profile" />
        {/* Без `href: null`: прихована вкладка в expo-router не може бути
            відкритою — її одразу замінює перша видима («Замовлення»). Панель
            і так наша (лише чотири розділи), тож ховати нічого не треба. */}
        <Tabs.Screen
          name="(home)"
          options={{
            animation: 'fade',
            transitionSpec: CHAT_TRANSITION,
            sceneStyleInterpolator: chatScene(height),
          }}
        />
      </Tabs>
    </DockSpace>
  )
}

/**
 * Майстер з нижньою панеллю (lib/dock, MASTER_DOCK): та сама пігулка, що
 * в клієнта, лише без «+» — «Стрічка · Замовлення · Чати · Профіль».
 * JS-вкладки, перемикання миттєве (їде лише підсвітка в панелі).
 * Сповіщення — як і раніше, дзвіночком у шапці (TabStack).
 */
function MasterDockShell() {
  const c = useColors()
  const space = useDockSpace()
  return (
    <DockSpace value={space}>
      <Tabs
        tabBar={({ state, navigateToTab }) => (
          <BottomDock
            tabs={MASTER_TABS}
            current={state.routes[state.index]?.name}
            onPick={(route) => {
              const target = state.routes.find((r) => r.name === route)
              if (target) navigateToTab(target.key)
            }}
          />
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: c.background },
          animation: 'none',
        }}
      >
        {/* Перша — стрічка заявок (головна майстра). */}
        <Tabs.Screen name="(home)" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="messages" />
        <Tabs.Screen name="profile" />
        {/* Сповіщення-вкладка — лише клієнта; у майстра її в панелі
            немає (у шапці — дзвіночок), тож і ховати не треба. */}
        <Tabs.Screen name="alerts" />
      </Tabs>
    </DockSpace>
  )
}

/**
 * Майстер: системні вкладки (на iOS 26 — Liquid Glass). Сповіщення —
 * дзвіночком у шапці (TabStack), не вкладкою.
 */
function MasterTabs() {
  const c = useColors()
  // Непрочитані повідомлення — числом на вкладці «Чати», як у Telegram.
  const unreadChats = useUnreadChats()
  return (
    <NativeTabs
      tintColor={c.primary}
      minimizeBehavior="onScrollDown"
      // До iOS 26 панель стає повністю прозорою, коли список докручено
      // до краю, — а кінець списку тепер стоїть над нею (padBottom), тож
      // «край» настає завжди. Лишаємо її з розмиттям, як була.
      disableTransparentOnScrollEdge
      // Легке «клацання», коли майстер перейшов на ІНШУ вкладку; дотик
      // по вже відкритій (повернутись нагору) — без вібрації.
      screenListeners={({ navigation }) => ({
        tabPress: () => {
          if (Platform.OS !== 'web' && !navigation.isFocused()) {
            void Haptics.selectionAsync()
          }
        },
      })}
    >
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
        {/* Лише коли є непрочитані. Текст і `hidden` разом не можна:
            expo-router з текстом `hidden` ігнорує, і вкладка світила
            червоний «0». */}
        {unreadChats > 0 ? (
          <NativeTabs.Trigger.Badge>
            {unreadChats > 99 ? '99+' : String(unreadChats)}
          </NativeTabs.Trigger.Badge>
        ) : (
          <NativeTabs.Trigger.Badge hidden />
        )}
        <NativeTabs.Trigger.Icon
          sf={{
            default: 'bubble.left.and.bubble.right',
            selected: 'bubble.left.and.bubble.right.fill',
          }}
          md="chat"
        />
      </NativeTabs.Trigger>

      {/* Сповіщення-вкладка — лише нижньої панелі клієнта (прототип,
          lib/dock); у майстра — дзвіночок у шапці. */}
      <NativeTabs.Trigger name="alerts" hidden />

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
