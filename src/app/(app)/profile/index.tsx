import {
  Globe02Icon,
  HelpCircleIcon,
  Logout01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native'
import { Image } from 'expo-image'
import * as WebBrowser from 'expo-web-browser'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { queryClient } from '@/components/providers'
import { Button } from '@/components/ui/button'
import { authClient, roleOf, type Role } from '@/lib/auth'
import { SITE_URL } from '@/lib/config'
import { confirmAction } from '@/lib/confirm'
import { useColors } from '@/lib/theme'

const ROLE_LABEL: Record<Role, string> = {
  CLIENT: 'Клієнт',
  MASTER: 'Майстер',
  ADMIN: 'Адміністратор',
  MANAGER: 'Менеджер',
  MODERATOR: 'Модератор',
}

export default function ProfileScreen() {
  const c = useColors()
  const { data: session } = authClient.useSession()
  const user = session?.user
  if (!user) return null

  const open = (path: string) => WebBrowser.openBrowserAsync(`${SITE_URL}${path}`)

  async function confirmSignOut() {
    const ok = await confirmAction('Вийти з акаунта?', {
      confirm: 'Вийти',
      destructive: true,
    })
    if (!ok) return
    await authClient.signOut()
    // Дані попередньої людини не мають пережити вихід.
    queryClient.clear()
  }

  return (
    <ScrollView
      className="bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-5 p-4"
    >
      <View className="items-center gap-3 py-2">
        {user.image ? (
          <Image
            source={user.image}
            contentFit="cover"
            style={{ width: 88, height: 88, borderRadius: 44 }}
          />
        ) : (
          <View className="size-[88px] items-center justify-center rounded-full bg-primary">
            <Text className="text-[34px] font-semibold text-primary-foreground">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View className="items-center gap-1">
          <Text className="text-[22px] font-bold text-foreground">
            {user.name || 'Без імені'}
          </Text>
          <Text className="text-[15px] text-muted-foreground">
            {user.email} · {ROLE_LABEL[roleOf(user)]}
          </Text>
        </View>
      </View>

      {/* Без анкети сайт не пускає в кабінет — і застосунку тут нема що
          показати. Онбординг поки лише на сайті. */}
      {!user.onboarded ? (
        <View className="gap-3 rounded-2xl bg-secondary p-4">
          <Text className="text-[16px] font-semibold text-foreground">
            Анкету ще не заповнено
          </Text>
          <Text className="text-[14px] leading-[20px] text-muted-foreground">
            Заповніть її на сайті — після цього тут зʼявляться ваші заявки й
            замовлення.
          </Text>
          <Button onPress={() => open('/dashboard/onboarding')}>
            Заповнити на сайті
          </Button>
        </View>
      ) : null}

      <View className="overflow-hidden rounded-2xl bg-card">
        <Row
          first
          icon={Globe02Icon}
          label="Відкрити zunor.org"
          onPress={() => open('/')}
          color={c.foreground}
        />
        <Row
          icon={HelpCircleIcon}
          label="Допомога"
          onPress={() => open('/dashboard/help')}
          color={c.foreground}
        />
        <Row
          icon={Logout01Icon}
          label="Вийти"
          onPress={confirmSignOut}
          color={c.foreground}
          danger
        />
      </View>
    </ScrollView>
  )
}

function Row({
  icon,
  label,
  onPress,
  color,
  danger = false,
  first = false,
}: {
  icon: IconSvgElement
  label: string
  onPress: () => void
  color: string
  danger?: boolean
  /** Перший рядок картки — без лінії зверху (як рядки налаштувань сайту). */
  first?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 border-border px-4 py-3.5 active:bg-secondary ${
        first ? '' : 'border-t'
      }`}
    >
      <HugeiconsIcon icon={icon} size={22} color={color} strokeWidth={1.5} />
      <Text
        className={`flex-1 text-[16px] ${danger ? 'text-destructive' : 'text-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  )
}
