import { useState } from 'react'
import { Text, View } from 'react-native'

import { Celebration } from '@/components/mascot/celebration'
import { AvatarPicker } from '@/components/onboarding/controls'
import {
  cityDistricts,
  PlaceFields,
} from '@/components/onboarding/place-fields'
import { useEnterApp } from '@/components/onboarding/use-enter-app'
import { Wizard, type WizardStep } from '@/components/onboarding/wizard'
import { useAvatarEditor } from '@/components/settings/use-avatar-editor'
import { TextField } from '@/components/ui/text-field'
import { api, errorText } from '@/lib/api'
import { formatPhone, normalizePhone, phoneValid } from '@/shared/phone'
import type { ProfileData } from '@/shared/settings'

// Межі — як на сервері (web/src/lib/server/profile.ts), той перевіряє
// все повторно.
const NAME_MIN = 2
const NAME_MAX = 80
const BIO_MAX = 922

// Копія STEPS із web/…/onboarding/client-onboarding.svelte. Обовʼязкове —
// спершу, необовʼязкове — одним кроком наприкінці, який можна пропустити.
const STEPS: readonly WizardStep[] = [
  {
    id: 'name',
    title: 'Як вас звати?',
    subtitle: 'Так до вас звертатиметься майстер.',
  },
  {
    id: 'city',
    title: 'Де ви живете?',
    subtitle:
      'Заявку спершу побачать майстри з вашого району й сусідніх — вони приїдуть швидше. Точну адресу ви повідомите в чаті.',
  },
  {
    id: 'phone',
    title: 'Ваш номер телефону',
    subtitle:
      'Його побачить лише майстер, якого ви оберете, — і лише після підтвердження замовлення.',
  },
  {
    id: 'extras',
    title: 'Ще трохи про вас',
    subtitle: 'Необовʼязково, але так майстру простіше підготуватися.',
    optional: true,
  },
]

/**
 * Анкета замовника — як на сайті (client-onboarding.svelte, режим
 * onboarding): імʼя, місто з районом, телефон і необовʼязкові фото та
 * «про вас». Замовника ведуть за руку (MANIFESTO, розділ 7): чотири
 * коротких питання легші за форму одним екраном.
 *
 * Зберігається ОДНИМ запитом у кінці (POST /api/profile/client): сервер
 * ставить onboarded і роль лише після повної перевірки. Фото — одразу
 * (useAvatarEditor), як на сайті. Далі — у застосунок (useEnterApp).
 */
export function ClientOnboarding({
  data,
  onExit,
}: {
  data: ProfileData
  onExit: () => void
}) {
  const u = data.user
  const enterApp = useEnterApp()

  const [step, setStep] = useState(0)
  const [name, setName] = useState(u.name ?? '')
  // Місто одне — його й обираємо: питання без вибору людині ні до чого.
  const [place, setPlace] = useState({
    city: u.city ?? (data.cities.length === 1 ? data.cities[0].slug : ''),
    district: u.district ?? '',
  })
  const [phone, setPhone] = useState(normalizePhone(u.phone ?? ''))
  const [bio, setBio] = useState(u.bio ?? '')
  const photo = useAvatarEditor({
    url: u.avatar ?? '',
    publicId: u.avatarPublicId ?? '',
  })

  // Помилка — лише після спроби піти далі: червоне під полем, якого ще не
  // торкались, — це грубо.
  const [touched, setTouched] = useState({
    name: false,
    city: false,
    phone: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  /** Профіль щойно створено — на весь екран свято з котом (Celebration). */
  const [celebrating, setCelebrating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameTrim = name.trim()
  const nameValid = nameTrim.length >= NAME_MIN && nameTrim.length <= NAME_MAX
  const districts = cityDistricts(data.districts, place.city)
  const districtValid =
    districts.length === 0 || districts.some((d) => d.slug === place.district)
  const bioTrim = bio.trim()

  const nameError =
    touched.name && !nameValid
      ? nameTrim
        ? `Імʼя: ${NAME_MIN}–${NAME_MAX} символів`
        : 'Введіть імʼя'
      : null
  const cityError = touched.city && !place.city ? 'Оберіть місто' : null
  const districtError =
    touched.city && place.city && !districtValid ? 'Оберіть район' : null
  const phoneError =
    touched.phone && !phoneValid(phone)
      ? phone
        ? 'Перевірте номер: +380 XX XXX XX XX'
        : 'Введіть номер'
      : null

  function validate(id: string): boolean {
    switch (id) {
      case 'name':
        setTouched((t) => ({ ...t, name: true }))
        return nameValid
      case 'city':
        setTouched((t) => ({ ...t, city: true }))
        return !!place.city && districtValid
      case 'phone':
        setTouched((t) => ({ ...t, phone: true }))
        return phoneValid(phone)
      default:
        return true
    }
  }

  async function save() {
    if (submitting) return
    setError(null)
    setSubmitting(true)
    if (!saved) {
      try {
        // role та onboarded не шлемо: сервер виставляє їх сам після
        // перевірки. Фото — поточне: без нього сервер прибрав би його.
        await api('/api/profile/client', {
          method: 'POST',
          json: {
            name: nameTrim,
            phone: '+380' + phone,
            city: place.city,
            district: districts.length ? place.district : null,
            bio: bioTrim,
            avatar: photo.avatar.url || null,
            avatarPublicId: photo.avatar.url
              ? photo.avatar.publicId || null
              : null,
          },
        })
        setSaved(true)
      } catch (err) {
        setError(errorText(err))
        setSubmitting(false)
        return
      }
      // Збережено — спершу свято на весь екран, застосунок — після нього.
      setCelebrating(true)
      return
    }
    await open()
  }

  // Успіх — корінь сам відкриє застосунок, і цей екран (разом зі святом)
  // зникне. Ні — свято геть, помилка й «ще раз» (без свята).
  async function open() {
    if (!(await enterApp())) {
      setCelebrating(false)
      setError(
        'Анкету збережено, але застосунок не відкрився. Спробуйте ще раз',
      )
      setSubmitting(false)
    }
  }

  return (
    <View className="flex-1">
      <Wizard
        steps={STEPS}
        current={step}
        onStep={setStep}
        validate={validate}
        onExit={onExit}
        onSubmit={save}
        submitLabel="Готово"
        busy={submitting || photo.busy}
        submitting={submitting}
        note="Фото ще завантажується…"
        error={error}
        renderStep={(id, next) => {
          switch (id) {
            case 'name':
              return (
                <TextField
                  focusOnMount
                  label="Олена Коваленко"
                  accessibilityLabel="Імʼя"
                  value={name}
                  onChangeText={setName}
                  error={nameError}
                  maxLength={NAME_MAX}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  onSubmitEditing={next}
                  submitBehavior="submit"
                />
              )
            case 'city':
              return (
                <PlaceFields
                  cities={data.cities}
                  districts={data.districts}
                  city={place.city}
                  district={place.district}
                  onChange={setPlace}
                  cityError={cityError}
                  districtError={districtError}
                />
              )
            case 'phone':
              return (
                <TextField
                  focusOnMount
                  prefix="+380"
                  label="67 123 45 67"
                  accessibilityLabel="Телефон"
                  value={formatPhone(phone)}
                  onChangeText={(t) => setPhone(normalizePhone(t))}
                  error={phoneError}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />
              )
            case 'extras':
              return (
                <>
                  <AvatarPicker
                    uri={photo.avatar.url}
                    name={nameTrim || u.email}
                    busy={photo.busy}
                    onChange={photo.change}
                  />
                  <TextField
                    multiline
                    label="Є кіт, підʼїзд із кодом, зручніше зранку."
                    accessibilityLabel="Про себе"
                    value={bio}
                    onChangeText={setBio}
                    maxLength={BIO_MAX}
                  />
                  {/* Лічильник — лише біля стелі, як на сайті. */}
                  {bioTrim.length > BIO_MAX * 0.8 ? (
                    <Text className="-mt-2 text-right text-[12px] text-muted-foreground">
                      {bioTrim.length}/{BIO_MAX}
                    </Text>
                  ) : null}
                </>
              )
            default:
              return null
          }
        }}
      />
      {celebrating ? (
        <Celebration
          title="Готово!"
          text="Профіль створено. Тепер можна замовити прибирання — Zunor підбере майстра."
          onDone={() => void open()}
        />
      ) : null}
    </View>
  )
}
