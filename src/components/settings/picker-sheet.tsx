import { useState } from 'react'
import { Modal, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Glyph } from '@/components/icons/glyph'
import { Row, Section } from '@/components/settings/list'
import { RoundButton } from '@/components/ui/round-button'
import { useColors } from '@/lib/theme'

export interface PickerGroup {
  title?: string
  options: { value: string; label: string }[]
}

/**
 * Вибір зі списку — аркушем знизу (на iOS — системний, з жестом униз):
 * місто, район. Обране — з галочкою; вибір одразу закриває аркуш.
 */
export function PickerSheet({
  visible,
  title,
  groups,
  value,
  onPick,
  onClose,
  searchable = false,
}: {
  visible: boolean
  title: string
  groups: PickerGroup[]
  value: string
  onPick: (value: string) => void
  onClose: () => void
  searchable?: boolean
}) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const shown = groups
    .map((g) => ({
      ...g,
      options: q
        ? g.options.filter((o) => o.label.toLowerCase().includes(q))
        : g.options,
    }))
    .filter((g) => g.options.length > 0)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={() => setQuery('')}
    >
      <View className="flex-1 bg-background">
        <View className="h-[60px] flex-row items-center px-4">
          <View className="w-[56px]" />
          <Text className="flex-1 text-center text-[17px] font-semibold text-foreground">
            {title}
          </Text>
          <View className="w-[56px] items-end">
            <RoundButton icon="close" label="Закрити" onPress={onClose} />
          </View>
        </View>

        {searchable ? (
          <View className="px-4 pt-3">
            <View className="h-11 flex-row items-center gap-2 rounded-[12px] bg-shell px-3">
              <Glyph name="search" size={16} color={c.mutedForeground} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Пошук"
                placeholderTextColor={c.mutedForeground}
                autoCorrect={false}
                returnKeyType="search"
                className="flex-1 text-[16px] text-foreground"
              />
            </View>
          </View>
        ) : null}

        <ScrollView
          contentContainerClassName="gap-6 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {shown.map((g) => (
            <Section key={g.title ?? 'all'} title={g.title} inset="text">
              {g.options.map((o) => (
                <Row
                  key={o.value}
                  label={o.label}
                  chevron={false}
                  onPress={() => {
                    onPick(o.value)
                    onClose()
                  }}
                  right={
                    o.value === value ? (
                      <Glyph
                        name="check"
                        size={16}
                        color={c.primary}
                        weight="semibold"
                      />
                    ) : null
                  }
                />
              ))}
            </Section>
          ))}
          {shown.length === 0 ? (
            <Text className="py-10 text-center text-[15px] text-muted-foreground">
              Нічого не знайдено
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  )
}
