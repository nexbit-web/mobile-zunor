import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  AreaField,
  FieldRow,
  Footnote,
  Section,
  TINT,
} from '@/components/settings/list'
import { GlowButton } from '@/components/ui/glow-button'
import { api, errorText } from '@/lib/api'
import { pluralUk } from '@/shared/format'

// Межі — як у формі на сайті (dashboard/jobs/[id]/job-master-view.svelte);
// сервер (POST /api/jobs/[id]/proposals) перевіряє все повторно.
const MSG_MIN = 20
const MSG_MAX = 922
const PRICE_MIN = 50
const PRICE_MAX = 500_000
const DAYS_MIN = 1
const DAYS_MAX = 180

/** Жартівливі відгуки на суму й термін — ті самі, що тости на сайті. */
function priceJoke(v: number): string | null {
  if (v >= 300_000) return 'Ого! Таких грошей навіть у нас немає'
  if (v >= 100_000) return 'Опа, а це вже цікаво'
  if (v >= 50_001) return '50 тисяч — це максимум'
  if (v >= 50_000) return 'Це вже гроші'
  if (v > 0 && v < 100) return 'Чого так мало?'
  return null
}

function daysJoke(v: number): string | null {
  if (v >= 90) return '🐢 Три місяці? Клієнт встигне переїхати двічі.'
  if (v >= 10) return 'А ви не поспішаєте'
  return null
}

const digits = (t: string) => t.replace(/\D/g, '')

/**
 * Пропозиція майстра — аркушем знизу (на iOS — системний, з жестом униз),
 * ті самі поля, що на сайті: ціна, термін, повідомлення клієнту. Чернетка
 * живе, поки екран заявки відкритий: закрив аркуш і відкрив знову —
 * написане на місці. Надіслано — аркуш закривається, екран перечитує
 * заявку й показує «Ваша пропозиція».
 */
export function ProposeSheet({
  visible,
  jobId,
  jobTitle,
  budget,
  onClose,
  onSent,
}: {
  visible: boolean
  jobId: string
  jobTitle: string
  /** «до 1 500 ₴» — бюджет клієнта, якщо вказаний. */
  budget: string | null
  onClose: () => void
  onSent: () => void
}) {
  const insets = useSafeAreaInsets()
  const [price, setPrice] = useState('')
  const [days, setDays] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [priceNote, setPriceNote] = useState<string | null>(null)
  const [daysNote, setDaysNote] = useState<string | null>(null)

  const priceN = Number(price)
  const daysN = Number(days)
  const msgLen = message.trim().length
  const priceOk = price !== '' && priceN >= PRICE_MIN && priceN <= PRICE_MAX
  const daysOk = days !== '' && daysN >= DAYS_MIN && daysN <= DAYS_MAX
  const msgOk = msgLen >= MSG_MIN && msgLen <= MSG_MAX
  const valid = priceOk && daysOk && msgOk

  // Що не так — підписуємо, щойно поле заповнене (порожнє — не «помилка»).
  const priceErr =
    price !== '' && !priceOk
      ? `Ціна: від ${PRICE_MIN} до ${PRICE_MAX.toLocaleString('uk-UA')} ₴`
      : ''
  const daysErr =
    days !== '' && !daysOk ? `Термін: від ${DAYS_MIN} до ${DAYS_MAX} днів` : ''

  async function send() {
    if (!valid || sending) return
    setSending(true)
    setError('')
    try {
      await api(`/api/jobs/${encodeURIComponent(jobId)}/proposals`, {
        method: 'POST',
        json: { message: message.trim(), priceUah: priceN, estimatedDays: daysN },
      })
    } catch (e) {
      setError(errorText(e))
      setSending(false)
      return
    }
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
    setSending(false)
    setPrice('')
    setDays('')
    setMessage('')
    setPriceNote(null)
    setDaysNote(null)
    onSent()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!sending) onClose()
      }}
    >
      <View className="flex-1 bg-background">
        <View className="h-[56px] flex-row items-center px-4">
          <Pressable
            onPress={onClose}
            disabled={sending}
            hitSlop={8}
            accessibilityRole="button"
            className="w-[96px] active:opacity-60"
          >
            <Text className="text-[17px] text-primary">Скасувати</Text>
          </Pressable>
          <Text className="flex-1 text-center text-[17px] font-semibold text-foreground">
            Пропозиція
          </Text>
          <View className="w-[96px]" />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-6 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          // iOS сам піднімає зміст над клавіатурою — кнопка лишається досяжною.
          automaticallyAdjustKeyboardInsets
        >
          {/* На яку заявку — щоб не сумніватись, кому пишеш. */}
          <View className="gap-1 px-1">
            <Text
              numberOfLines={2}
              className="text-[20px] font-bold leading-[25px] tracking-[-0.4px] text-foreground"
            >
              {jobTitle}
            </Text>
            {budget ? (
              <Text className="text-[14px] text-muted-foreground">
                Бюджет клієнта: {budget}
              </Text>
            ) : null}
          </View>

          <Section
            title="Ваша пропозиція"
            footer={
              priceErr || daysErr ? (
                <Footnote tone="error">{priceErr || daysErr}</Footnote>
              ) : priceNote || daysNote ? (
                priceNote || daysNote
              ) : (
                'Клієнт побачить ціну, термін і повідомлення. Телефонами ви обміняєтесь, лише коли він вас обере.'
              )
            }
          >
            <FieldRow
              icon="wallet"
              tint={TINT.green}
              label="Ціна"
              labelWidth={84}
              value={price}
              onChangeText={(t) => setPrice(digits(t).slice(0, 6))}
              onBlur={() => setPriceNote(price ? priceJoke(priceN) : null)}
              placeholder="1 200"
              keyboardType="number-pad"
              right={<Unit>₴</Unit>}
            />
            <FieldRow
              icon="calendar"
              tint={TINT.orange}
              label="Термін"
              labelWidth={84}
              value={days}
              onChangeText={(t) => setDays(digits(t).slice(0, 3))}
              onBlur={() => setDaysNote(days ? daysJoke(daysN) : null)}
              placeholder="1"
              keyboardType="number-pad"
              right={
                <Unit>
                  {pluralUk(days ? daysN : 5, 'день', 'дні', 'днів')}
                </Unit>
              }
            />
          </Section>

          <Section
            title="Повідомлення клієнту"
            inset="text"
            footer={
              msgLen > 0 && msgLen < MSG_MIN ? (
                <Footnote tone="error">
                  Ще {MSG_MIN - msgLen} — мінімум {MSG_MIN} символів
                </Footnote>
              ) : (
                `${msgLen} / ${MSG_MAX}`
              )
            }
          >
            <AreaField
              value={message}
              onChangeText={setMessage}
              maxLength={MSG_MAX}
              placeholder="Розкажіть, як виконаєте роботу: що входить, які засоби, ваш досвід."
            />
          </Section>

          {error ? <Footnote tone="error">{error}</Footnote> : null}

          <GlowButton
            icon="propose"
            label="Надіслати пропозицію"
            onPress={() => void send()}
            loading={sending}
            disabled={!valid}
          />
        </ScrollView>
      </View>
    </Modal>
  )
}

/** Одиниця праворуч від числа: «₴», «днів». */
function Unit({ children }: { children: string }) {
  return (
    <Text className="text-[17px] text-muted-foreground">{children}</Text>
  )
}
