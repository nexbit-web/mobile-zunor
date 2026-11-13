import { router, Stack, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'

import { Glyph } from '@/components/icons/glyph'
import { ServiceBadge } from '@/components/icons/service-icon'
import { PhotoGrid } from '@/components/photo-grid'
import { queryClient } from '@/components/providers'
import { EditableAvatar } from '@/components/settings/editable-avatar'
import {
  AreaField,
  FieldRow,
  Footnote,
  Row,
  Section,
  SettingsScroll,
  TINT,
} from '@/components/settings/list'
import { PickerSheet } from '@/components/settings/picker-sheet'
import { PortfolioEditor } from '@/components/settings/portfolio-editor'
import { useAvatarEditor } from '@/components/settings/use-avatar-editor'
import { Avatar } from '@/components/ui/avatar'
import { HeaderPill } from '@/components/ui/header-pill'
import { RoundButton } from '@/components/ui/round-button'
import { StatusPill } from '@/components/ui/status-pill'
import { api, errorText } from '@/lib/api'
import { authClient } from '@/lib/auth'
import { SITE_URL } from '@/lib/config'
import { confirmAction } from '@/lib/confirm'
import { useColors } from '@/lib/theme'
import { discardPortfolioPhoto, type Photo } from '@/lib/upload'
import { SERVICES } from '@/shared/cleaning'
import {
  CATEGORIES_MAX,
  CLEANING_SLUG,
  DESC_MAX,
  DESC_MIN,
  isTravelRadius,
  KIND_OPTIONS,
  NAME_MAX,
  NAME_MIN,
  parseCleaningSkills,
  PERSON_CREW_OPTIONS,
  PORTFOLIO_MAX,
  PREMISE_GROUPS,
  SERVICE_HINTS,
  TRAVEL_OPTIONS,
  usernameProblem,
  VEHICLE_OPTIONS,
  verificationLook,
  type Crew,
  type MasterKind,
  type PersonCrew,
  type PremiseGroup,
  type TravelRadius,
} from '@/shared/masters'
import { formatPhone, normalizePhone, phoneValid } from '@/shared/phone'
import type { MasterProfileData } from '@/shared/settings'

const KEY = ['me', 'master-profile'] as const

interface Form {
  kind: MasterKind | null
  personCrew: PersonCrew | null
  name: string
  username: string
  phone: string
  city: string
  district: string
  radius: TravelRadius
  vehicle: boolean | null
  categories: string[]
  services: string[]
  premises: PremiseGroup[]
  description: string
  portfolio: Photo[]
}

/** Поля форми з того, що збережено (як initial у master-onboarding). */
function formOf(data: MasterProfileData): Form {
  const u = data.user
  const m = data.master
  const only = data.categories.length === 1 ? data.categories[0].slug : null
  const skills = parseCleaningSkills(m?.skills[CLEANING_SLUG])
  return {
    kind: m?.crew === 'COMPANY' ? 'company' : m?.crew ? 'person' : null,
    personCrew: m?.crew === 'SOLO' || m?.crew === 'TEAM' ? m.crew : null,
    name: u.name ?? '',
    username: u.username ?? '',
    phone: normalizePhone(u.phone ?? ''),
    city: u.city ?? '',
    district: u.district ?? '',
    radius: m && isTravelRadius(m.travelRadiusKm) ? m.travelRadiusKm : null,
    vehicle: m?.hasVehicle ?? null,
    categories: m?.categories.length ? m.categories : only ? [only] : [],
    services: skills.services,
    premises: skills.premises,
    description: m?.description ?? '',
    portfolio: (m?.portfolioImages ?? []).map((url, i) => ({
      url,
      publicId: m?.portfolioImagesPublicIds[i] ?? url,
    })),
  }
}

/** Для порівняння «чи щось змінилось»: без пробілів по краях і регістру. */
function snapshot(f: Form, needsDistrict: boolean): string {
  return JSON.stringify({
    ...f,
    name: f.name.trim(),
    username: f.username.trim().toLowerCase(),
    district: needsDistrict ? f.district : '',
    description: f.description.trim(),
    portfolio: f.portfolio.map((p) => p.publicId),
  })
}

const toggle = <T,>(list: T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

/**
 * Профіль майстра — усе, що є в анкеті на сайті (dashboard/settings/
 * profile → master-onboarding): хто ви, дані, де й як працюєте, що
 * робите, про себе, приклади робіт і стан перевірки. Спершу — просто
 * дані, як у клієнта; «Змінити» в шапці відкриває форму, «Зберегти»
 * шле її тим самим шляхом, що сайт (POST /api/profile/master). Кожне
 * збереження — повторна перевірка: так і на сайті.
 *
 * Фото профілю зберігається одразу; приклади робіт — разом із формою
 * (нові, але не збережені, при «Скасувати» прибираємо з хмари).
 */
export function MasterProfile({ data }: { data: MasterProfileData }) {
  const { refetch: refetchSession } = authClient.useSession()
  const saved = data.master
  // «Змінити» на головній «Профілю» відкриває одразу редагування, а
  // «Зберегти» й «✕» повертають туди ж (як у Telegram).
  const direct = useLocalSearchParams<{ edit?: string }>().edit === '1'

  const [editing, setEditing] = useState(!saved || direct)
  const [form, setForm] = useState(() => formOf(data))
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))
  const photo = useAvatarEditor({
    url: data.user.avatar ?? '',
    publicId: data.user.avatarPublicId ?? '',
  })
  const [picker, setPicker] = useState<'city' | 'district' | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Помилки — лише після першої спроби зберегти.
  const [showErrors, setShowErrors] = useState(false)

  const company = form.kind === 'company'
  const onlyCategory = data.categories.length === 1
  const cleans = form.categories.includes(CLEANING_SLUG)
  const districts = data.districts.filter((d) => d.citySlug === form.city)
  const needsDistrict = districts.length > 0
  const cityName = data.cities.find((x) => x.slug === form.city)?.name ?? ''
  const districtName =
    districts.find((d) => d.slug === form.district)?.name ?? ''

  // ─── Username: формат тут, зайнятість — у сервера, з паузою ───
  const uname = form.username.trim().toLowerCase()
  const unameFormat = usernameProblem(uname)
  const [taken, setTaken] = useState<'checking' | 'free' | 'taken' | null>(null)
  useEffect(() => {
    if (!editing || unameFormat || uname === (data.user.username ?? '')) {
      setTaken(null)
      return
    }
    setTaken('checking')
    let live = true
    const t = setTimeout(() => {
      api<{ available: boolean }>(
        `/api/user/username/check?username=${encodeURIComponent(uname)}`,
      )
        .then((r) => live && setTaken(r.available ? 'free' : 'taken'))
        .catch(() => live && setTaken(null))
    }, 400)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [uname, unameFormat, editing, data.user.username])

  // ─── Помилки (ті самі, що в save() на сайті) ───
  const nameTrim = form.name.trim()
  const descLen = form.description.trim().length
  const errors = {
    kind: form.kind ? '' : 'Оберіть, хто ви',
    name: !nameTrim
      ? company
        ? 'Введіть назву компанії'
        : 'Введіть імʼя'
      : nameTrim.length < NAME_MIN || nameTrim.length > NAME_MAX
        ? `${company ? 'Назва' : 'Імʼя'}: ${NAME_MIN}–${NAME_MAX} символів`
        : '',
    username:
      unameFormat || (taken === 'taken' ? 'Цей username уже зайнято' : ''),
    phone: !form.phone
      ? 'Введіть номер телефону'
      : !phoneValid(form.phone)
        ? 'Перевірте номер: +380 XX XXX XX XX'
        : '',
    place: !form.city
      ? 'Оберіть місто'
      : needsDistrict && !districtName
        ? 'Оберіть район'
        : '',
    vehicle:
      form.vehicle === null ? 'Вкажіть, як добираєтесь на замовлення' : '',
    crew:
      !company && form.kind && !form.personCrew ? 'Оберіть, як працюєте' : '',
    categories: form.categories.length ? '' : 'Оберіть хоча б одну категорію',
    services:
      cleans && !form.services.length
        ? 'Оберіть, які прибирання ви робите'
        : '',
    premises:
      cleans && !form.premises.length ? 'Оберіть, де готові прибирати' : '',
    description:
      descLen < DESC_MIN
        ? `Опис: щонайменше ${DESC_MIN} символів (зараз ${descLen})`
        : descLen > DESC_MAX
          ? `Не більше ${DESC_MAX} символів`
          : '',
  }
  const firstError = Object.values(errors).find(Boolean) ?? ''
  const err = (e: string, fallback?: ReactNode) =>
    showErrors && e ? <Footnote tone="error">{e}</Footnote> : fallback

  const dirty =
    snapshot(form, needsDistrict) !== snapshot(formOf(data), needsDistrict)
  const canSave =
    (dirty || !saved) && !photo.busy && !uploading && taken !== 'checking'

  // ─── Дії ───

  /** Нові фото робіт, яких у збереженому профілі немає, — з хмари. */
  const dropNewPhotos = (list: Photo[]) => {
    const keep = new Set(saved?.portfolioImagesPublicIds ?? [])
    for (const p of list) {
      if (!keep.has(p.publicId))
        void discardPortfolioPhoto(p.publicId).catch(() => {})
    }
  }

  function startEdit() {
    setForm(formOf(data))
    setShowErrors(false)
    setEditing(true)
  }

  function cancelEdit() {
    dropNewPhotos(form.portfolio)
    if (direct) {
      router.back()
      return
    }
    setForm(formOf(data))
    setShowErrors(false)
    setEditing(false)
  }

  async function save() {
    if (firstError) {
      setShowErrors(true)
      Alert.alert('Перевірте анкету', firstError)
      return
    }
    if (saved?.verificationStatus === 'VERIFIED') {
      const ok = await confirmAction('Зберегти зміни?', {
        message: 'Після збереження профіль пройде повторну перевірку.',
        confirm: 'Зберегти',
      })
      if (!ok) return
    }
    setSaving(true)
    const crew: Crew = company ? 'COMPANY' : (form.personCrew as PersonCrew)
    const body = {
      name: nameTrim,
      username: uname,
      phone: '+380' + form.phone,
      city: form.city,
      district: needsDistrict ? form.district : null,
      travelRadiusKm: form.radius,
      categories: form.categories,
      description: form.description.trim(),
      vehicle: form.vehicle,
      crew,
      skills: cleans
        ? {
            [CLEANING_SLUG]: {
              services: form.services,
              premises: form.premises,
            },
          }
        : {},
      // Фото профілю — поточне: без нього сервер прибрав би його.
      avatar: photo.avatar.url || null,
      avatarPublicId: photo.avatar.url ? photo.avatar.publicId || null : null,
      portfolioImages: form.portfolio.map((p) => p.url),
      portfolioImagesPublicIds: form.portfolio.map((p) => p.publicId),
    }
    try {
      await api('/api/profile/master', { method: 'POST', json: body })
    } catch (e) {
      Alert.alert('Не вдалося зберегти', errorText(e))
      setSaving(false)
      return
    }
    // Збережене видно одразу; кожна подача — знову «На перевірці».
    queryClient.setQueryData<MasterProfileData>(KEY, (old) =>
      old
        ? {
            ...old,
            user: {
              ...old.user,
              name: body.name,
              username: body.username,
              phone: body.phone,
              city: body.city,
              district: body.district,
              avatar: body.avatar,
              avatarPublicId: body.avatarPublicId,
            },
            master: {
              categories: body.categories,
              travelRadiusKm: body.travelRadiusKm,
              hasVehicle: body.vehicle,
              crew,
              skills: body.skills,
              description: body.description,
              portfolioImages: body.portfolioImages,
              portfolioImagesPublicIds: body.portfolioImagesPublicIds,
              verificationStatus: 'PENDING',
              verificationRejectReason: null,
            },
          }
        : old,
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

  const header = (
    <Stack.Screen
      options={{
        headerLeft:
          editing && saved
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
        <MasterView data={data} avatarUrl={photo.avatar.url} />
      </>
    )
  }

  return (
    <>
      {header}

      <SettingsScroll>
        {saved?.verificationStatus === 'REJECTED' &&
        saved.verificationRejectReason ? (
          <Rejected reason={saved.verificationRejectReason} />
        ) : null}

        <View className="items-center gap-3 pt-1">
          <EditableAvatar
            uri={photo.avatar.url || null}
            name={nameTrim || data.user.email}
            size={108}
            busy={photo.busy}
            onPress={photo.change}
            onCamera={photo.change}
          />
          <Pressable onPress={photo.change} disabled={photo.busy} hitSlop={8}>
            <Text className="text-[16px] font-medium text-primary">
              {photo.avatar.url
                ? company
                  ? 'Змінити логотип'
                  : 'Змінити фото'
                : company
                  ? 'Додати логотип'
                  : 'Додати фото'}
            </Text>
          </Pressable>
        </View>

        <Section title="Хто ви" inset="text" footer={err(errors.kind)}>
          {KIND_OPTIONS.map((o) => (
            <Row
              key={o.value}
              label={o.label}
              description={o.hint}
              selected={form.kind === o.value}
              onPress={() => set({ kind: o.value })}
            />
          ))}
        </Section>

        <Section
          title={company ? 'Дані компанії' : 'Особисті дані'}
          footer={err(
            errors.name || errors.username || errors.phone,
            `Сторінка: zunor.org/@${uname || 'username'}. Телефон клієнт побачить лише після підтвердження замовлення. Зміни пройдуть повторну перевірку.`,
          )}
        >
          <FieldRow
            icon={company ? 'city' : 'profile'}
            tint={TINT.blue}
            label={company ? 'Назва' : 'Імʼя'}
            labelWidth={84}
            value={form.name}
            onChangeText={(name) => set({ name })}
            placeholder={company ? 'Чисто Плюс' : 'Олена Коваленко'}
            maxLength={NAME_MAX}
            autoCapitalize="words"
            autoComplete={company ? 'organization' : 'name'}
            textContentType={company ? 'organizationName' : 'name'}
          />
          <FieldRow
            icon="at"
            tint={TINT.purple}
            label="Username"
            labelWidth={84}
            prefix="@"
            value={form.username}
            onChangeText={(t) =>
              set({ username: t.toLowerCase().replace(/\s/g, '') })
            }
            placeholder="olena_clean"
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            right={unameFormat ? null : <UsernameState state={taken} />}
          />
          <FieldRow
            icon="phone"
            tint={TINT.green}
            label="Телефон"
            labelWidth={84}
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
          title="Де ви працюєте"
          footer={err(
            errors.place,
            'Район — звідки ви їдете. Публічно не показуємо.',
          )}
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

        {needsDistrict ? (
          <Section
            title="Як далеко готові їздити"
            inset="text"
            footer="Заявки далі обраної відстані не надсилаємо."
          >
            {TRAVEL_OPTIONS.map((o) => (
              <Row
                key={String(o.value)}
                label={o.label}
                description={o.hint}
                selected={form.radius === o.value}
                onPress={() => set({ radius: o.value })}
              />
            ))}
          </Section>
        ) : null}

        <Section
          title="Як добираєтесь на замовлення"
          footer={err(errors.vehicle)}
        >
          {VEHICLE_OPTIONS.map((o) => (
            <Row
              key={String(o.value)}
              icon={o.value ? 'car' : 'bus'}
              tint={o.value ? TINT.blue : TINT.orange}
              label={o.label}
              description={o.hint}
              selected={form.vehicle === o.value}
              onPress={() => set({ vehicle: o.value })}
            />
          ))}
        </Section>

        {!company ? (
          <Section
            title="Працюєте самі чи з напарником"
            footer={err(errors.crew)}
          >
            {PERSON_CREW_OPTIONS.map((o) => (
              <Row
                key={o.value}
                icon={o.value === 'SOLO' ? 'profile' : 'team'}
                tint={o.value === 'SOLO' ? TINT.teal : TINT.indigo}
                label={o.label}
                description={o.hint}
                selected={form.personCrew === o.value}
                onPress={() => set({ personCrew: o.value })}
              />
            ))}
          </Section>
        ) : null}

        {!onlyCategory ? (
          <Section
            title="Категорії"
            inset="text"
            footer={err(errors.categories, `До ${CATEGORIES_MAX} категорій.`)}
          >
            {data.categories.map((cat) => {
              const on = form.categories.includes(cat.slug)
              return (
                <Row
                  key={cat.slug}
                  label={cat.name}
                  selected={on}
                  disabled={!on && form.categories.length >= CATEGORIES_MAX}
                  onPress={() =>
                    set({ categories: toggle(form.categories, cat.slug) })
                  }
                />
              )
            })}
          </Section>
        ) : null}

        {cleans ? (
          <>
            <Section
              title="Які прибирання робите"
              footer={err(errors.services)}
            >
              {SERVICES.map((s) => (
                <Row
                  key={s.key}
                  leading={<ServiceBadge service={s.key} size={30} />}
                  label={s.label}
                  description={SERVICE_HINTS[s.key]}
                  selected={form.services.includes(s.key)}
                  onPress={() =>
                    set({ services: toggle(form.services, s.key) })
                  }
                />
              ))}
            </Section>

            <Section
              title="Де готові прибирати"
              footer={err(errors.premises, 'Надсилатимемо лише такі заявки.')}
            >
              {PREMISE_GROUPS.map((g) => (
                <Row
                  key={g.key}
                  icon={g.key === 'home' ? 'house' : 'office'}
                  tint={g.key === 'home' ? TINT.green : TINT.orange}
                  label={g.label}
                  description={g.hint}
                  selected={form.premises.includes(g.key)}
                  onPress={() =>
                    set({
                      premises: toggle<PremiseGroup>(form.premises, g.key),
                    })
                  }
                />
              ))}
            </Section>
          </>
        ) : null}

        <Section
          title={company ? 'Про компанію' : 'Про себе'}
          inset="text"
          footer={err(
            errors.description,
            descLen < DESC_MIN
              ? `Мінімум ${DESC_MIN} символів: досвід, що робите найкраще, чим відрізняєтесь.`
              : `${descLen}/${DESC_MAX}`,
          )}
        >
          <AreaField
            value={form.description}
            onChangeText={(description) => set({ description })}
            maxLength={DESC_MAX}
            placeholder={
              company
                ? 'Скільки років працюєте, яка команда, що прибираєте найкраще.'
                : 'Досвід, що прибираєте найкраще, чим відрізняєтесь.'
            }
          />
        </Section>

        <Section
          title="Приклади робіт"
          footer={`Необовʼязково. До ${PORTFOLIO_MAX} фото, найкраще — «до / після».`}
        >
          <PortfolioEditor
            photos={form.portfolio}
            setPhotos={(update) =>
              setForm((f) => ({ ...f, portfolio: update(f.portfolio) }))
            }
            max={PORTFOLIO_MAX}
            onBusy={setUploading}
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

/** Праворуч від username: перевіряємо / вільний ✓ / зайнятий ✕. */
function UsernameState({
  state,
}: {
  state: 'checking' | 'free' | 'taken' | null
}) {
  const c = useColors()
  if (state === null) return null
  if (state === 'checking') {
    return <ActivityIndicator size="small" color={c.mutedForeground} />
  }
  return state === 'free' ? (
    <Glyph name="check" size={16} color="#34c759" weight="semibold" />
  ) : (
    <Glyph name="close" size={15} color={c.destructive} weight="semibold" />
  )
}

/** Картка-попередження: перевірку не пройдено, і чому. */
function Rejected({ reason }: { reason: string }) {
  return (
    <Section footer="Виправте анкету й збережіть — перевіримо знову.">
      <Row
        icon="nRejected"
        tint={TINT.red}
        label="Профіль не пройшов перевірку"
        description={reason}
      />
    </Section>
  )
}

/** Профіль без полів — те, що збережено, як картка в Telegram. */
function MasterView({
  data,
  avatarUrl,
}: {
  data: MasterProfileData
  avatarUrl: string
}) {
  const u = data.user
  const m = data.master
  const f = formOf(data)
  const company = f.kind === 'company'
  const phone = normalizePhone(u.phone ?? '')
  const cityName = data.cities.find((x) => x.slug === u.city)?.name ?? ''
  const districtName =
    data.districts.find((d) => d.citySlug === u.city && d.slug === u.district)
      ?.name ?? ''
  const look = verificationLook(m?.verificationStatus ?? 'NONE')
  const services = SERVICES.filter((s) => f.services.includes(s.key)).map(
    (s) => s.label,
  )
  const premises = PREMISE_GROUPS.filter((g) => f.premises.includes(g.key)).map(
    (g) => g.label,
  )
  const categories = data.categories
    .filter((c) => f.categories.includes(c.slug))
    .map((c) => c.name)

  return (
    <SettingsScroll>
      <View className="items-center gap-3 pt-1">
        <Avatar uri={avatarUrl || null} name={u.name || u.email} size={108} />
        <View className="items-center gap-1">
          <Text
            numberOfLines={1}
            className="text-[26px] font-bold tracking-tight text-foreground"
          >
            {u.name || 'Без імені'}
          </Text>
          <Text numberOfLines={1} className="text-[15px] text-muted-foreground">
            {u.username ? `@${u.username}` : u.email}
          </Text>
        </View>
        <StatusPill label={look.label} tone={look.tone} size="md" />
      </View>

      {m?.verificationStatus === 'REJECTED' && m.verificationRejectReason ? (
        <Rejected reason={m.verificationRejectReason} />
      ) : null}

      <Section title="Контакти">
        <Row
          icon="phone"
          tint={TINT.green}
          label="Телефон"
          value={phone ? `+380 ${formatPhone(phone)}` : 'Не вказано'}
        />
        {u.username ? (
          <Row
            icon="at"
            tint={TINT.purple}
            label="Сторінка"
            value={`@${u.username}`}
            external
            onPress={() =>
              WebBrowser.openBrowserAsync(`${SITE_URL}/@${u.username}`)
            }
          />
        ) : null}
      </Section>

      <Section title="Де ви працюєте">
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
        {districtName ? (
          <Row
            icon="radius"
            tint={TINT.teal}
            label="Їздите"
            value={
              TRAVEL_OPTIONS.find((o) => o.value === f.radius)?.label ??
              'Будь-де'
            }
          />
        ) : null}
        {f.vehicle !== null ? (
          <Row
            icon={f.vehicle ? 'car' : 'bus'}
            tint={f.vehicle ? TINT.blue : TINT.orange}
            label="Транспорт"
            value={f.vehicle ? 'Своє авто' : 'Громадський'}
          />
        ) : null}
        {f.kind ? (
          <Row
            icon={
              company ? 'city' : f.personCrew === 'TEAM' ? 'team' : 'profile'
            }
            tint={TINT.purple}
            label="Формат"
            value={
              company
                ? 'Компанія'
                : f.personCrew === 'TEAM'
                  ? 'З напарником'
                  : f.personCrew === 'SOLO'
                    ? 'Сам(а)'
                    : 'Не вказано'
            }
          />
        ) : null}
      </Section>

      <Section title="Що ви виконуєте">
        {data.categories.length > 1 ? (
          <Row
            icon="briefcase"
            tint={TINT.gray}
            label="Категорії"
            description={categories.join(' · ') || 'Не обрано'}
          />
        ) : null}
        <Row
          icon="cleaning"
          tint={TINT.cyan}
          label="Прибирання"
          description={services.join(' · ') || 'Не обрано'}
        />
        <Row
          icon="house"
          tint={TINT.green}
          label="Де прибираєте"
          description={premises.join(' · ') || 'Не обрано'}
        />
      </Section>

      <Section title={company ? 'Про компанію' : 'Про себе'} inset="text">
        <Text
          className={`px-4 py-3.5 text-[17px] leading-[23px] ${
            f.description ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {f.description ||
            'Ще нічого не розповіли. Натисніть «Змінити», щоб додати.'}
        </Text>
      </Section>

      <Section title="Приклади робіт" inset="text">
        {f.portfolio.length ? (
          <View className="p-3">
            <PhotoGrid urls={f.portfolio.map((p) => p.url)} />
          </View>
        ) : (
          <Text className="px-4 py-3.5 text-[17px] leading-[23px] text-muted-foreground">
            Ще немає. Найкраще — фото «до / після».
          </Text>
        )}
      </Section>
    </SettingsScroll>
  )
}
