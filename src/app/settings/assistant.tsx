import { useQuery } from '@tanstack/react-query'
import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { ServiceIcon } from '@/components/icons/service-icon'
import { queryClient } from '@/components/providers'
import {
  ActionRow,
  AreaField,
  FieldRow,
  QueryGate,
  Section,
  SettingsScroll,
} from '@/components/settings/list'
import { HeaderSave } from '@/components/ui/header-pill'
import { api, errorText } from '@/lib/api'
import { useColors } from '@/lib/theme'
import type { AiObject, AssistantData } from '@/shared/settings'

/**
 * AI асистент — анкета, яку Zunor читає перед розмовою про заявку (як
 * розділ на сайті): як звертатись, чим людина займається, її обʼєкти й
 * які послуги цікавлять. Лише для замовника.
 */
export default function AssistantSettings() {
  const query = useQuery({
    queryKey: ['me', 'assistant'],
    queryFn: () => api<AssistantData>('/api/profile/ai-profile'),
  })
  return (
    <QueryGate
      query={query}
      // «Про вас» (поля), обʼєкти, послуги.
      skeleton={[
        { rows: 2, tiles: false },
        { rows: 3 },
        { rows: 3 },
      ]}
    >
      {(data) => <AssistantForm data={data} />}
    </QueryGate>
  )
}

/**
 * Іконки типів помешкання за ключем (ключі — web/…/categories/cleaning/
 * presets.ts). Новий тип на сайті без іконки тут — просто чіп без іконки.
 * Послуги малюються іконками сайту (ServiceIcon), не цими.
 */
const PREMISE_GLYPH: Record<string, GlyphName> = {
  apartment: 'apartment',
  house: 'house',
  office: 'office',
  commercial: 'commercial',
  other: 'other',
}

function AssistantForm({ data }: { data: AssistantData }) {
  const c = useColors()
  const start = data.profile
  const { limits } = data

  const [callName, setCallName] = useState(start.callName)
  const [about, setAbout] = useState(start.about)
  const [objects, setObjects] = useState<AiObject[]>(start.objects)
  const [services, setServices] = useState<string[]>(start.services)
  const [saving, setSaving] = useState(false)

  const snapshot = (p: {
    callName: string
    about: string
    objects: AiObject[]
    services: string[]
  }) =>
    JSON.stringify([p.callName, p.about, p.objects, p.services])
  const dirty =
    snapshot({ callName, about, objects, services }) !== snapshot(start)

  const editObject = (i: number, patch: Partial<AiObject>) =>
    setObjects((list) => list.map((o, j) => (j === i ? { ...o, ...patch } : o)))

  const addObject = () =>
    setObjects((list) =>
      list.length >= limits.maxObjects
        ? list
        : [...list, { premise: data.premises[0]?.key ?? 'apartment', note: '' }],
    )

  const toggleService = (key: string) =>
    setServices((list) =>
      list.includes(key) ? list.filter((s) => s !== key) : [...list, key],
    )

  async function save() {
    setSaving(true)
    try {
      // Сервер однаково все перевіряє й санітизує (parseAiProfile).
      await api('/api/profile/ai-profile', {
        method: 'POST',
        json: {
          callName: callName.trim(),
          about: about.trim(),
          objects: objects.map((o) => ({ ...o, note: o.note.trim() })),
          services,
        },
      })
      queryClient.invalidateQueries({ queryKey: ['me', 'assistant'] })
      router.back()
    } catch (err) {
      Alert.alert('Не вдалося зберегти', errorText(err))
      setSaving(false)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          // Лише «Зберегти», без дзвіночка — так попросив власник.
          headerRight: () => (
            <HeaderSave onPress={save} disabled={!dirty} loading={saving} />
          ),
        }}
      />

      <SettingsScroll>
        <Section
          title="Про вас"
          inset="text"
          footer="Zunor не питатиме те, що вже знає."
        >
          <FieldRow
            label="Як звертатись"
            labelWidth={122}
            value={callName}
            onChangeText={setCallName}
            maxLength={40}
            placeholder={data.userName || 'Ваше імʼя'}
            autoCapitalize="words"
          />
          <View>
            <AreaField
              value={about}
              onChangeText={setAbout}
              maxLength={limits.about}
              placeholder="Чим займаєтесь — наприклад: здаю квартири подобово, прибирання потрібне часто"
            />
            {/* Лічильник — лише коли є що рахувати: «0/300» під порожнім
                полем читається як помилка. */}
            {about.length > 0 ? (
              <Text className="absolute bottom-2.5 right-4 text-[12px] text-muted-foreground">
                {about.length}/{limits.about}
              </Text>
            ) : null}
          </View>
        </Section>

        <Section
          title="Ваші обʼєкти"
          inset="text"
          footer="Те, що прибираєте регулярно."
        >
          {objects.map((o, i) => (
            <View key={i} className="gap-3 py-4">
              <View className="flex-row items-center px-4">
                <Text className="flex-1 text-[13px] uppercase tracking-[0.3px] text-muted-foreground">
                  Обʼєкт {i + 1}
                </Text>
                <Pressable
                  onPress={() =>
                    setObjects((list) => list.filter((_, j) => j !== i))
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Видалити обʼєкт"
                  className="size-8 items-center justify-center rounded-full bg-secondary active:opacity-70"
                >
                  <Glyph name="close" size={13} color={c.mutedForeground} weight="semibold" />
                </Pressable>
              </View>
              {/* Тип — чіпи, а не список: варіантів пʼять, усі під рукою. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerClassName="gap-2 px-4"
              >
                {data.premises.map((p) => (
                  <Chip
                    key={p.key}
                    label={p.label}
                    icon={PREMISE_GLYPH[p.key]}
                    selected={o.premise === p.key}
                    onPress={() => editObject(i, { premise: p.key })}
                  />
                ))}
              </ScrollView>
              <View className="px-4">
                <TextInput
                  value={o.note}
                  onChangeText={(note) => editObject(i, { note })}
                  maxLength={limits.objectNote}
                  placeholder="3 кімнати, Таїрова, 5 поверх без ліфта"
                  placeholderTextColor={c.mutedForeground}
                  accessibilityLabel="Деталі обʼєкта"
                  className="h-[46px] rounded-[12px] bg-secondary px-3.5 text-[15.5px] text-foreground"
                />
              </View>
            </View>
          ))}
          <ActionRow
            label={
              objects.length >= limits.maxObjects
                ? `Не більше ${limits.maxObjects} обʼєктів`
                : 'Додати обʼєкт'
            }
            icon="plus"
            align="left"
            disabled={objects.length >= limits.maxObjects}
            onPress={addObject}
          />
        </Section>

        <Section
          title="Що вас цікавить"
          footer="Асистент пропонуватиме це першим."
        >
          <View className="flex-row flex-wrap gap-2 p-4">
            {data.services.map((s) => {
              const on = services.includes(s.key)
              return (
                <Chip
                  key={s.key}
                  label={s.label}
                  icon={on ? 'check' : undefined}
                  service={on ? undefined : s.key}
                  selected={on}
                  onPress={() => toggleService(s.key)}
                />
              )
            })}
          </View>
        </Section>
      </SettingsScroll>
    </>
  )
}

function Chip({
  label,
  icon,
  service,
  selected,
  onPress,
}: {
  label: string
  icon?: GlyphName
  /** Чіп послуги — з іконкою сайту замість системної. */
  service?: string
  selected: boolean
  onPress: () => void
}) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`h-10 flex-row items-center gap-1.5 rounded-full px-3.5 active:opacity-80 ${
        selected ? 'bg-primary' : 'bg-secondary'
      }`}
    >
      {service ? <ServiceIcon service={service} size={18} /> : null}
      {icon ? (
        <Glyph
          name={icon}
          size={15}
          color={selected ? c.primaryForeground : c.foreground}
          weight={selected ? 'semibold' : 'regular'}
        />
      ) : null}
      <Text
        className={`text-[14.5px] ${
          selected ? 'font-semibold text-primary-foreground' : 'text-foreground'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  )
}
