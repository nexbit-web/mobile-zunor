import Constants from 'expo-constants'
import { router, Stack } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Platform, Pressable, Text, View } from 'react-native'

import { queryClient } from '@/components/providers'
import { THEME_LABEL } from '@/components/settings/appearance-pickers'
import { EditableAvatar } from '@/components/settings/editable-avatar'
import {
  ActionRow,
  Row,
  Section,
  SettingsScroll,
  TINT,
} from '@/components/settings/list'
import { useAvatarEditor } from '@/components/settings/use-avatar-editor'
import { WithBell } from '@/components/header-bell'
import { Button } from '@/components/ui/button'
import { HeaderPill } from '@/components/ui/header-pill'
import { SQUIRCLE } from '@/components/ui/tile'
import { useAppearance } from '@/lib/appearance'
import { authClient, roleOf } from '@/lib/auth'
import { SITE_URL } from '@/lib/config'
import { confirmAction } from '@/lib/confirm'
import { releasePush } from '@/lib/push'

const openSite = (path: string) =>
  WebBrowser.openBrowserAsync(`${SITE_URL}${path}`)

/** Профіль: замовник — екран у застосунку, майстер — поки на сайті. */
export function openProfile(role: string | null | undefined) {
  const r = roleOf({ role })
  // Клієнт і майстер — свій екран у застосунку; службові ролі — на сайті.
  if (r === 'CLIENT' || r === 'MASTER') router.push('/settings/profile')
  else void openSite('/dashboard/settings/profile')
}

/**
 * Головний екран налаштувань — у подачі Telegram: угорі людина (фото з
 * камерою, імʼя, пошта), нижче групи з кольоровими плитками — Акаунт,
 * Застосунок, Підтримка, у самому низу «Вийти» й версія. Розділи ті
 * самі, що в налаштуваннях сайту.
 *
 * Той самий екран — у клієнта з бічної панелі (/settings) і в майстра
 * у вкладці «Профіль».
 */
export function SettingsHome() {
  const { data: session } = authClient.useSession()
  const look = useAppearance()
  const user = session?.user
  const photo = useAvatarEditor({ url: user?.image ?? '', publicId: '' })
  if (!user) return null

  const client = roleOf(user) === 'CLIENT'
  const master = roleOf(user) === 'MASTER'
  const name = user.name || user.email
  const toProfile = () => openProfile(user.role)

  async function signOut() {
    const ok = await confirmAction('Вийти з акаунта?', {
      confirm: 'Вийти',
      destructive: true,
    })
    if (!ok) return
    // Push цієї людини на цей телефон більше не йде (lib/push) — поки
    // сесія ще жива: запис на сайті знімається від її імені.
    await releasePush()
    await authClient.signOut()
    // Дані попередньої людини не мають пережити вихід.
    queryClient.clear()
  }

  // «Змінити» праворуч у шапці — одразу редагування профілю, як у Telegram
  // (так попросив власник); та сама пігулка, що на екрані профілю.
  // Службові ролі редагують профіль на сайті — їм кнопки немає.
  const edit =
    client || master ? (
      <HeaderPill
        label="Змінити"
        tone="secondary"
        onPress={() =>
          router.push({ pathname: '/settings/profile', params: { edit: '1' } })
        }
      />
    ) : null

  return (
    <SettingsScroll>
      {edit ? (
        <Stack.Screen
          options={{
            // У майстра (вкладка «Профіль») — ще й дзвіночок, як скрізь у
            // нього; у клієнта сповіщення — у нижній панелі чи бічній.
            headerRight: () => (master ? <WithBell>{edit}</WithBell> : edit),
          }}
        />
      ) : null}
      <View className="items-center gap-3 pt-1">
        <EditableAvatar
          uri={photo.avatar.url || null}
          name={name}
          size={104}
          busy={photo.busy}
          onPress={toProfile}
          onCamera={photo.change}
        />
        <Pressable
          onPress={toProfile}
          accessibilityRole="button"
          className="items-center gap-1 active:opacity-70"
        >
          <Text
            numberOfLines={1}
            className="text-[26px] font-bold tracking-tight text-foreground"
          >
            {user.name || 'Без імені'}
          </Text>
          <Text numberOfLines={1} className="text-[15px] text-muted-foreground">
            {user.email}
          </Text>
        </Pressable>
      </View>

      {/* Без анкети сайт не пускає в кабінет. Замовник заповнює її прямо
          тут (той самий профіль), майстер — поки на сайті. */}
      {!user.onboarded ? (
        <View className="gap-3 rounded-[24px] bg-shell p-4" style={SQUIRCLE}>
          <Text className="text-[17px] font-semibold text-foreground">
            Профіль ще не заповнено
          </Text>
          <Text className="text-[15px] leading-[20px] text-muted-foreground">
            Імʼя, місто й телефон — і можна замовляти прибирання.
          </Text>
          <Button onPress={toProfile}>Заповнити профіль</Button>
        </View>
      ) : null}

      <Section title="Акаунт">
        <Row
          icon="profile"
          tint={TINT.blue}
          label="Профіль"
          onPress={toProfile}
          external={!client && !master}
        />
        <Row
          icon="security"
          tint={TINT.gray}
          label="Безпека"
          onPress={() => router.push('/settings/security')}
        />
        <Row
          icon="notifications"
          tint={TINT.red}
          label="Сповіщення"
          onPress={() => router.push('/settings/notifications')}
        />
      </Section>

      <Section title="Застосунок">
        <Row
          icon="appearance"
          tint={TINT.cyan}
          label="Вигляд"
          value={THEME_LABEL[look.theme]}
          onPress={() => router.push('/settings/appearance')}
        />
        {/* Анкета впливає на розмову про заявку — майстер їх не створює. */}
        {client ? (
          <Row
            icon="assistant"
            tint={TINT.purple}
            label="AI асистент"
            onPress={() => router.push('/settings/assistant')}
          />
        ) : null}
      </Section>

      <Section title="Підтримка">
        <Row
          icon="help"
          tint={TINT.orange}
          label="Допомога"
          external
          onPress={() => openSite('/dashboard/help')}
        />
        <Row
          icon="website"
          tint={TINT.teal}
          label="Сайт zunor.org"
          external
          onPress={() => openSite('/')}
        />
      </Section>

      <Section>
        <ActionRow label="Вийти" tone="destructive" onPress={signOut} />
      </Section>

      <Text className="-mt-2 text-center text-[13px] text-muted-foreground">
        Zunor для {Platform.OS === 'android' ? 'Android' : 'iOS'} · версія{' '}
        {Constants.expoConfig?.version ?? '1.0.0'}
      </Text>
    </SettingsScroll>
  )
}
