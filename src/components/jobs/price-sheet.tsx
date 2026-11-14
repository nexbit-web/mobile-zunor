import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { FieldRow, Footnote, Section, TINT } from '@/components/settings/list'
import { GlowButton } from '@/components/ui/glow-button'
import { api, errorText } from '@/lib/api'

// Межі — ті самі, що в пропозиції (propose-sheet) і на сервері
// (PATCH /api/proposals/[id]).
const PRICE_MIN = 50
const PRICE_MAX = 500_000

const digits = (t: string) => t.replace(/\D/g, '')

/**
 * Зміна ціни в надісланій пропозиції — аркушем знизу, як і сама
 * пропозиція (власник). Клієнт бачить номер майстра в пропозиції й
 * дзвонить домовитись; домовились про іншу ціну — майстер міняє її тут,
 * клієнт отримує сповіщення й обирає вже за новою. Лише поки майстра не
 * обрали — це перевіряє і екран (кнопку показує тільки тоді), і сервер.
 */
export function PriceSheet({
  visible,
  proposalId,
  priceCents,
  onClose,
  onSaved,
}: {
  visible: boolean
  proposalId: string
  /** Поточна ціна — з неї поле стартує. */
  priceCents: number
  onClose: () => void
  onSaved: () => void
}) {
  const insets = useSafeAreaInsets()
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Щоразу, як аркуш відкривають, — з поточної ціни, без старої помилки.
  useEffect(() => {
    if (!visible) return
    setPrice(String(Math.round(priceCents / 100)))
    setError('')
  }, [visible, priceCents])

  const priceN = Number(price)
  const ok = price !== '' && priceN >= PRICE_MIN && priceN <= PRICE_MAX
  const same = ok && priceN * 100 === priceCents

  async function save() {
    if (!ok || saving) return
    if (same) {
      onClose()
      return
    }
    setSaving(true)
    setError('')
    try {
      await api(`/api/proposals/${encodeURIComponent(proposalId)}`, {
        method: 'PATCH',
        json: { priceUah: priceN },
      })
    } catch (e) {
      setError(errorText(e))
      setSaving(false)
      return
    }
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!saving) onClose()
      }}
    >
      <View className="flex-1 bg-background">
        <View className="h-[56px] flex-row items-center px-4">
          <Pressable
            onPress={onClose}
            disabled={saving}
            hitSlop={8}
            accessibilityRole="button"
            className="w-[96px] active:opacity-60"
          >
            <Text className="text-[17px] text-primary">Скасувати</Text>
          </Pressable>
          <Text className="flex-1 text-center text-[17px] font-semibold text-foreground">
            Нова ціна
          </Text>
          <View className="w-[96px]" />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-6 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Section
            title="Ваша пропозиція"
            footer={
              price !== '' && !ok ? (
                <Footnote tone="error">
                  {`Ціна: від ${PRICE_MIN} до ${PRICE_MAX.toLocaleString('uk-UA')} ₴`}
                </Footnote>
              ) : (
                'Домовились із клієнтом про іншу ціну — вкажіть її тут. Клієнт отримає сповіщення й обере вас уже за новою.'
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
              placeholder="1 200"
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              right={
                <Text className="text-[17px] text-muted-foreground">₴</Text>
              }
            />
          </Section>

          {error ? <Footnote tone="error">{error}</Footnote> : null}

          <GlowButton
            icon="wallet"
            label="Зберегти ціну"
            onPress={() => void save()}
            loading={saving}
            disabled={!ok}
          />
        </ScrollView>
      </View>
    </Modal>
  )
}
