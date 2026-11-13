import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Alert, AppState, Linking, Switch } from 'react-native'

import { TelegramTile } from '@/components/icons/brand-tiles'
import {
  ActionRow,
  QueryGate,
  Row,
  Section,
  SettingsScroll,
  TINT,
} from '@/components/settings/list'
import { api, errorText } from '@/lib/api'
import { authClient } from '@/lib/auth'
import {
  disablePush,
  enablePush,
  readPushStatus,
  type PushStatus,
} from '@/lib/push'
import { useColors } from '@/lib/theme'
import type { NotificationsData } from '@/shared/settings'

/**
 * Сповіщення: push на цей телефон (lib/push) і Telegram, як розділ на
 * сайті. Telegram підключається через бота: кнопка відкриває
 * t.me/<бот>?start=<токен>, людина тисне «Start», бот записує чат.
 * Застосунок дізнається про це, коли людина повертається з Telegram, —
 * тоді стан перечитується (і посилання з токеном заодно оновлюється:
 * воно живе 15 хв).
 */
export default function NotificationSettings() {
  const query = useQuery({
    queryKey: ['me', 'notifications'],
    queryFn: () => api<NotificationsData>('/api/telegram/link'),
  })
  const [opened, setOpened] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  // Чекаємо «Start» у боті, доки чат не підключився.
  const waiting = opened && !query.data?.telegram?.linked

  const refetch = query.refetch
  useEffect(() => {
    if (!waiting) return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch()
    })
    return () => sub.remove()
  }, [waiting, refetch])

  async function connect(url: string) {
    setOpened(true)
    await Linking.openURL(url).catch(() => {
      setOpened(false)
      Alert.alert('Не вдалося відкрити Telegram')
    })
  }

  async function unlink() {
    if (unlinking) return
    setUnlinking(true)
    try {
      await api('/api/telegram/link', { method: 'DELETE' })
      setOpened(false)
      await refetch()
    } catch (err) {
      Alert.alert('Не вдалося відключити Telegram', errorText(err))
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <QueryGate
      query={query}
      // Push, Telegram (стан і дії).
      skeleton={[{ rows: 1 }, { rows: 2 }]}
    >
      {({ telegram }) => (
        <SettingsScroll>
          <PushSection />

          {telegram ? (
            <Section
              title="Telegram"
              footer="Вимкнути можна й у самому боті — командою /stop."
            >
              {telegram.linked ? (
                <Row
                  leading={<TelegramTile />}
                  label="Telegram підключено"
                  description="Нові заявки, відгуки й зміни замовлень приходять у чат із ботом Zunor."
                />
              ) : (
                <Row
                  leading={<TelegramTile />}
                  label="Сповіщення в Telegram"
                  description={
                    waiting
                      ? 'Натисніть «Start» у Telegram і поверніться сюди.'
                      : 'Нові заявки, відгуки й зміни замовлень — навіть коли застосунок закрито.'
                  }
                />
              )}
              {telegram.linked ? (
                <ActionRow
                  label="Відключити"
                  tone="destructive"
                  loading={unlinking}
                  onPress={unlink}
                />
              ) : telegram.linkUrl ? (
                <ActionRow
                  label={waiting ? 'Відкрити Telegram ще раз' : 'Підключити'}
                  loading={waiting && query.isFetching}
                  onPress={() => connect(telegram.linkUrl!)}
                />
              ) : (
                <Row label="Тимчасово недоступно" />
              )}
            </Section>
          ) : null}
        </SettingsScroll>
      )}
    </QueryGate>
  )
}

/**
 * Push на цей телефон — перемикачем, як у параметрах iPhone. Увімкнення
 * питає дозвіл системи; якщо його вже заборонили, перемикач веде в
 * параметри телефона (звідти людина повертається — стан перечитується).
 */
function PushSection() {
  const c = useColors()
  const { data: session } = authClient.useSession()
  const userId = session?.user.id
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!userId) return
    const read = () => void readPushStatus(userId).then(setStatus)
    read()
    // Повернулись із параметрів телефона — дозвіл міг змінитись.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') read()
    })
    return () => sub.remove()
  }, [userId])

  async function toggle(next: boolean) {
    if (!userId || busy) return
    if (next && status?.kind === 'denied') {
      void Linking.openSettings()
      return
    }
    setBusy(true)
    try {
      if (next) {
        const result = await enablePush(userId)
        setStatus(result)
        if (result.kind === 'denied') {
          Alert.alert(
            'Сповіщення заборонено',
            'Дозвольте сповіщення для Zunor у параметрах телефона.',
            [
              { text: 'Не зараз', style: 'cancel' },
              { text: 'Параметри', onPress: () => void Linking.openSettings() },
            ],
          )
        }
      } else {
        await disablePush()
        setStatus({ kind: 'off' })
      }
    } catch (err) {
      Alert.alert(
        next ? 'Не вдалося увімкнути' : 'Не вдалося вимкнути',
        errorText(err),
      )
    } finally {
      setBusy(false)
    }
  }

  const description =
    status?.kind === 'denied'
      ? 'Заборонено в параметрах телефона.'
      : 'Нові заявки, відгуки й зміни замовлень — одразу на цей телефон.'

  return (
    <Section title="На цьому пристрої">
      {status === null ? (
        <Row icon="push" tint={TINT.red} label="Push-сповіщення" loading />
      ) : status.kind === 'unavailable' ? (
        <Row
          icon="push"
          tint={TINT.red}
          label="Push-сповіщення"
          value={status.reason}
        />
      ) : (
        <Row
          icon="push"
          tint={TINT.red}
          label="Push-сповіщення"
          description={description}
          right={
            <Switch
              // Як у «Вигляд»: Switch на iOS сам ставить собі
              // alignSelf: 'flex-start' — повертаємо по центру рядка.
              style={{ alignSelf: 'center' }}
              value={status.kind === 'on'}
              onValueChange={toggle}
              disabled={busy}
              trackColor={{ true: c.primary, false: c.input }}
              ios_backgroundColor={c.input}
              accessibilityLabel="Push-сповіщення"
            />
          }
        />
      )}
      {status?.kind === 'denied' ? (
        <ActionRow
          label="Відкрити параметри"
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
    </Section>
  )
}
