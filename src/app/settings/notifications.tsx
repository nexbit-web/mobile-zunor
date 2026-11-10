import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Alert, AppState, Linking } from 'react-native'

import {
  ActionRow,
  QueryGate,
  Row,
  Section,
  SettingsScroll,
  TINT,
} from '@/components/settings/list'
import { api, errorText } from '@/lib/api'
import type { NotificationsData } from '@/shared/settings'

/**
 * Сповіщення — як розділ на сайті: Telegram. Підключення йде через бота:
 * кнопка відкриває t.me/<бот>?start=<токен>, людина тисне «Start», бот
 * записує чат. Застосунок дізнається про це, коли людина повертається
 * з Telegram, — тоді стан перечитується (і посилання з токеном заодно
 * оновлюється: воно живе 15 хв).
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
    <QueryGate query={query}>
      {({ telegram }) => (
        <SettingsScroll>
          {telegram ? (
            <Section
              title="Telegram"
              footer="Вимкнути можна й у самому боті — командою /stop."
            >
              {telegram.linked ? (
                <Row
                  icon="telegram"
                  tint={TINT.telegram}
                  label="Telegram підключено"
                  description="Нові заявки, відгуки й зміни замовлень приходять у чат із ботом Zunor."
                />
              ) : (
                <Row
                  icon="telegram"
                  tint={TINT.telegram}
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

          <Section
            title="На цьому пристрої"
            footer="Поки що сповіщення приходять у Telegram і на сайт."
          >
            <Row
              icon="push"
              tint={TINT.red}
              label="Push-сповіщення"
              value="Скоро"
            />
          </Section>
        </SettingsScroll>
      )}
    </QueryGate>
  )
}
