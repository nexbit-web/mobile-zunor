import { useQuery } from '@tanstack/react-query'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'

import { queryClient } from '@/components/providers'
import { EditableAvatar } from '@/components/settings/editable-avatar'
import {
  AreaField,
  FieldRow,
  Footnote,
  QueryGate,
  Row,
  Section,
  SettingsScroll,
  TINT,
} from '@/components/settings/list'
import { MasterProfile } from '@/components/settings/master-profile'
import { PickerSheet } from '@/components/settings/picker-sheet'
import { useAvatarEditor } from '@/components/settings/use-avatar-editor'
import { Avatar } from '@/components/ui/avatar'
import { HeaderPill } from '@/components/ui/header-pill'
import { RoundButton } from '@/components/ui/round-button'
import { api, errorText } from '@/lib/api'
import { authClient, roleOf } from '@/lib/auth'
import { SITE_URL } from '@/lib/config'
import { formatPhone, normalizePhone, phoneValid } from '@/shared/phone'
import type { MasterProfileData, ProfileData } from '@/shared/settings'

// Межі — як на сервері (web/src/lib/server/profile.ts): там перевіряється
// все повторно, тут — лише щоб людина побачила помилку до запиту.
const NAME_MIN = 2
const NAME_MAX = 80
const BIO_MAX = 922

/**
 * Профіль замовника — як у Telegram: спершу просто дані (фото, імʼя,
 * телефон, місто, «про вас»), а «Змінити» в шапці відкриває ту саму
 * форму, що в налаштуваннях сайту, і саме стає «Зберегти». Кругла «✕»
 * зліва (замість слова «Скасувати») — повернути як було.
 *
 * Фото зберігається одразу (як на сайті). Незаповнений профіль (без
 * onboarded) відкривається одразу формою: показувати ще нічого, а
 * сервер поставить onboarded після повної перевірки.
 */
export default function ProfileSettings() {
  const { data: session } = authClient.useSession()
  return roleOf(session?.user) === 'MASTER' ? (
    <MasterProfileSettings />
  ) : (
    <ClientProfileSettings />
  )
}

function ClientProfileSettings() {
  const query = useQuery({
    queryKey: ['me', 'profile'],
    queryFn: () => api<ProfileData>('/api/me/profile'),
  })
  return (
    <QueryGate
      query={query}
      // Фото й імʼя, контакти, де живе, «про вас».
      skeleton={[
        'profile',
        { rows: 1 },
        { rows: 2 },
        { rows: 1, tiles: false },
      ]}
    >
      {(data) => <Profile data={data} />}
    </QueryGate>
  )
}

/** Майстрові — уся анкета, як на сайті (components/settings/master-profile). */
function MasterProfileSettings() {
  const query = useQuery({
    queryKey: ['me', 'master-profile'],
    queryFn: () => api<MasterProfileData>('/api/me/master-profile'),
  })
  return (
    <QueryGate
      query={query}
      // Фото й імʼя, контакти, де працює, послуги.
      skeleton={['profile', { rows: 2 }, { rows: 2 }, { rows: 3 }]}
    >
      {(data) => <MasterProfile data={data} />}
    </QueryGate>
  )
}

/** Поля форми з того, що збережено. */
function fieldsOf(u: ProfileData['user']) {
  return {
    name: u.name ?? '',
    phone: normalizePhone(u.phone ?? ''),
    city: u.city ?? '',
    district: u.district ?? '',
    bio: u.bio ?? '',
  }
}

function Profile({ data }: { data: ProfileData }) {
  const { refetch: refetchSession } = authClient.useSession()
  const saved = data.user
  // «Змінити» на головній «Профілю» відкриває одразу редагування, а
  // «Зберегти» й «✕» повертають туди ж (як у Telegram).
  const direct = useLocalSearchParams<{ edit?: string }>().edit === '1'

  const [editing, setEditing] = useState(!saved.onboarded || direct)
  const [form, setForm] = useState(() => fieldsOf(saved))
  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }))
  const photo = useAvatarEditor({
    url: saved.avatar ?? '',
    publicId: saved.avatarPublicId ?? '',
  })
  const [picker, setPicker] = useState<'city' | 'district' | null>(null)
  const [saving, setSaving] = useState(false)
  // Помилки — лише після першої спроби зберегти: червоне під полем, якого
  // ще не торкались, — це грубо.
  const [showErrors, setShowErrors] = useState(false)

  // Район питаємо лише там, де для міста є райони (зараз — Одеса).
  const districts = data.districts.filter((d) => d.citySlug === form.city)
  const needsDistrict = districts.length > 0
  const cityName = data.cities.find((x) => x.slug === form.city)?.name ?? ''
  const districtName =
    districts.find((d) => d.slug === form.district)?.name ?? ''

  const nameTrim = form.name.trim()
  const nameError =
    nameTrim.length === 0
      ? 'Введіть імʼя'
      : nameTrim.length < NAME_MIN || nameTrim.length > NAME_MAX
        ? `Імʼя: ${NAME_MIN}–${NAME_MAX} символів`
        : ''
  const phoneError =
    form.phone.length === 0
      ? 'Введіть номер телефону'
      : !phoneValid(form.phone)
        ? 'Перевірте номер: +380 XX XXX XX XX'
        : ''
  const placeError = !form.city
    ? 'Оберіть місто'
    : needsDistrict && !districtName
      ? 'Оберіть район'
      : ''
  const valid = !nameError && !phoneError && !placeError

  const start = fieldsOf(saved)
  const dirty =
    nameTrim !== start.name.trim() ||
    form.phone !== start.phone ||
    form.city !== start.city ||
    (needsDistrict ? form.district : '') !== start.district ||
    form.bio.trim() !== start.bio.trim()
  // Незаповнений профіль можна зберегти й без змін: так він стає заповненим.
  const canSave = (dirty || !saved.onboarded) && !photo.busy

  function startEdit() {
    setForm(fieldsOf(saved))
    setShowErrors(false)
    setEditing(true)
  }

  function cancelEdit() {
    if (direct) {
      router.back()
      return
    }
    setForm(fieldsOf(saved))
    setShowErrors(false)
    setEditing(false)
  }

  async function save() {
    if (!valid) {
      setShowErrors(true)
      return
    }
    setSaving(true)
    const next = {
      name: nameTrim,
      phone: '+380' + form.phone,
      city: form.city,
      district: needsDistrict ? form.district : null,
      bio: form.bio.trim(),
    }
    try {
      // role та onboarded не шлемо: сервер виставляє їх сам після
      // перевірки. Фото — поточне: без нього сервер прибрав би його.
      await api('/api/profile/client', {
        method: 'POST',
        json: {
          ...next,
          avatar: photo.avatar.url || null,
          avatarPublicId: photo.avatar.url
            ? photo.avatar.publicId || null
            : null,
        },
      })
    } catch (err) {
      Alert.alert('Не вдалося зберегти', errorText(err))
      setSaving(false)
      return
    }
    // Збережене видно одразу, не чекаючи перечитування.
    queryClient.setQueryData<ProfileData>(['me', 'profile'], (old) =>
      old ? { ...old, user: { ...old.user, ...next, onboarded: true } } : old,
    )
    setEditing(false)
    setSaving(false)
    setShowErrors(false)
    if (direct) router.back()
    await refetchSession({ query: { disableCookieCache: true } }).catch(
      () => {},
    )
    void queryClient.invalidateQueries({ queryKey: ['me'] })
  }

  const pickCity = (slug: string) => {
    // Район іншого міста тут нічого не означає.
    const keep = data.districts.some(
      (d) => d.citySlug === slug && d.slug === form.district,
    )
    set({ city: slug, district: keep ? form.district : '' })
  }

  const districtGroups = [
    {
      title: 'Місто',
      options: districts
        .filter((d) => d.group === 'CITY')
        .map((d) => ({ value: d.slug, label: d.name })),
    },
    {
      title: 'Передмістя',
      options: districts
        .filter((d) => d.group === 'SUBURB')
        .map((d) => ({ value: d.slug, label: d.name })),
    },
  ].filter((g) => g.options.length > 0)

  // «✕» (скасувати) — лише коли є до чого повертатись (профіль уже заповнений).
  const header = (
    <Stack.Screen
      options={{
        headerLeft:
          editing && saved.onboarded
            ? () => (
                <RoundButton
                  icon="close"
                  label="Скасувати зміни"
                  onPress={cancelEdit}
                  disabled={saving}
                />
              )
            : undefined,
        // Лише «Змінити»/«Зберегти», без дзвіночка — так попросив власник.
        headerRight: () =>
          editing ? (
            <HeaderPill
              label="Зберегти"
              onPress={save}
              disabled={!canSave}
              loading={saving}
            />
          ) : (
            <HeaderPill label="Змінити" tone="secondary" onPress={startEdit} />
          ),
      }}
    />
  )

  if (!editing) {
    return (
      <>
        {header}
        <ProfileView data={data} avatarUrl={photo.avatar.url} />
      </>
    )
  }

  return (
    <>
      {header}

      <SettingsScroll>
        <View className="items-center gap-3 pt-1">
          <EditableAvatar
            uri={photo.avatar.url || null}
            name={nameTrim || saved.email}
            size={108}
            busy={photo.busy}
            onPress={photo.change}
            onCamera={photo.change}
          />
          <Pressable onPress={photo.change} disabled={photo.busy} hitSlop={8}>
            <Text className="text-[16px] font-medium text-primary">
              {photo.avatar.url ? 'Змінити фото' : 'Додати фото'}
            </Text>
          </Pressable>
        </View>

        <Section
          title="Особисті дані"
          footer={
            showErrors && (nameError || phoneError) ? (
              <Footnote tone="error">{nameError || phoneError}</Footnote>
            ) : (
              'Телефон побачить лише майстер, якого ви оберете, — і лише після підтвердження замовлення.'
            )
          }
        >
          <FieldRow
            icon="profile"
            tint={TINT.blue}
            label="Імʼя"
            labelWidth={78}
            value={form.name}
            onChangeText={(name) => set({ name })}
            placeholder="Олена Коваленко"
            maxLength={NAME_MAX}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
          />
          <FieldRow
            icon="phone"
            tint={TINT.green}
            label="Телефон"
            labelWidth={78}
            prefix="+380"
            value={formatPhone(form.phone)}
            onChangeText={(t) => set({ phone: normalizePhone(t) })}
            placeholder="67 123 45 67"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
        </Section>

        <Section
          title="Де ви живете"
          footer={
            showErrors && placeError ? (
              <Footnote tone="error">{placeError}</Footnote>
            ) : (
              'Заявку спершу побачать майстри з вашого району й сусідніх — вони приїдуть швидше. Точну адресу ви повідомите в чаті.'
            )
          }
        >
          <Row
            icon="city"
            tint={TINT.indigo}
            label="Місто"
            value={cityName || 'Оберіть'}
            onPress={() => setPicker('city')}
          />
          {needsDistrict ? (
            <Row
              icon="pinFill"
              tint={TINT.red}
              label="Район"
              value={districtName || 'Оберіть'}
              onPress={() => setPicker('district')}
            />
          ) : null}
        </Section>

        <Section
          title="Про вас"
          inset="text"
          footer={
            form.bio.length > 0
              ? `${form.bio.length}/${BIO_MAX}`
              : 'Необовʼязково, але так майстру простіше підготуватися.'
          }
        >
          <AreaField
            value={form.bio}
            onChangeText={(bio) => set({ bio })}
            maxLength={BIO_MAX}
            placeholder="Є кіт, підʼїзд із кодом, зручніше зранку."
          />
        </Section>
      </SettingsScroll>

      <PickerSheet
        visible={picker === 'city'}
        title="Місто"
        searchable
        groups={[
          {
            options: data.cities.map((x) => ({ value: x.slug, label: x.name })),
          },
        ]}
        value={form.city}
        onPick={pickCity}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'district'}
        title="Район"
        groups={districtGroups}
        value={form.district}
        onPick={(district) => set({ district })}
        onClose={() => setPicker(null)}
      />
    </>
  )
}

/** Профіль без полів — те, що збережено, як картка в Telegram. */
function ProfileView({
  data,
  avatarUrl,
}: {
  data: ProfileData
  avatarUrl: string
}) {
  const u = data.user
  const name = u.name || u.email
  const phone = normalizePhone(u.phone ?? '')
  const cityName = data.cities.find((x) => x.slug === u.city)?.name ?? ''
  const districtName =
    data.districts.find((d) => d.citySlug === u.city && d.slug === u.district)
      ?.name ?? ''

  return (
    <SettingsScroll>
      <View className="items-center gap-3 pt-1">
        <Avatar uri={avatarUrl || null} name={name} size={108} />
        <View className="items-center gap-1">
          <Text
            numberOfLines={1}
            className="text-[26px] font-bold tracking-tight text-foreground"
          >
            {u.name || 'Без імені'}
          </Text>
          <Text numberOfLines={1} className="text-[15px] text-muted-foreground">
            {u.email}
          </Text>
        </View>
      </View>

      <Section title="Контакти">
        <Row
          icon="phone"
          tint={TINT.green}
          label="Телефон"
          value={phone ? `+380 ${formatPhone(phone)}` : 'Не вказано'}
        />
      </Section>

      <Section title="Де ви живете">
        <Row
          icon="city"
          tint={TINT.indigo}
          label="Місто"
          value={cityName || 'Не вказано'}
        />
        {districtName ? (
          <Row
            icon="pinFill"
            tint={TINT.red}
            label="Район"
            value={districtName}
          />
        ) : null}
      </Section>

      <Section title="Про вас" inset="text">
        <Text
          className={`px-4 py-3.5 text-[17px] leading-[23px] ${
            u.bio ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {u.bio || 'Ще нічого не розповіли. Натисніть «Змінити», щоб додати.'}
        </Text>
      </Section>

      {/* Перехід у виконавці — окрема усвідомлена дія, назад дороги
          немає. Анкета нового акаунта — у застосунку (onboarding), а
          перехід клієнта у виконавці поки на сайті. */}
      {u.role === 'CLIENT' ? (
        <Section footer="Повернутися до ролі замовника буде неможливо.">
          <Row
            icon="briefcase"
            tint={TINT.teal}
            label="Стати виконавцем"
            description="Отримуйте заявки як майстер."
            external
            onPress={() =>
              WebBrowser.openBrowserAsync(
                `${SITE_URL}/dashboard/onboarding/master`,
              )
            }
          />
        </Section>
      ) : null}
    </SettingsScroll>
  )
}
