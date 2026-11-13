import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { Glyph } from '@/components/icons/glyph'
import { ServiceBadge } from '@/components/icons/service-icon'
import { CatScene } from '@/components/mascot/cat-scene'
import { Celebration } from '@/components/mascot/celebration'
import { AvatarPicker, ChoiceList } from '@/components/onboarding/controls'
import {
  cityDistricts,
  PlaceFields,
} from '@/components/onboarding/place-fields'
import { useEnterApp } from '@/components/onboarding/use-enter-app'
import {
  Wizard,
  type WizardPhase,
  type WizardStep,
} from '@/components/onboarding/wizard'
import { PortfolioEditor } from '@/components/settings/portfolio-editor'
import { useAvatarEditor } from '@/components/settings/use-avatar-editor'
import { Avatar } from '@/components/ui/avatar'
import { TextField, type TextFieldHandle } from '@/components/ui/text-field'
import { api, errorText } from '@/lib/api'
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
  type MasterKind,
  type PersonCrew,
  type PremiseGroup,
  type TravelRadius,
} from '@/shared/masters'
import { formatPhone, normalizePhone, phoneValid } from '@/shared/phone'
import type { MasterProfileData } from '@/shared/settings'

// ─── Етапи й кроки — копія web/…/onboarding/master-onboarding.svelte ───
// Тексти — під відповідь на перше питання: людині «Як вас звати?»,
// компанії «Як називається компанія?». Поки відповіді немає — як людині.

function phasesFor(company: boolean): WizardPhase[] {
  return [
    {
      id: 'you',
      title: company ? 'Про компанію' : 'Познайомимось',
      lead: company
        ? 'Назва, логотип і телефон. Клієнти бачать вивіску, а номер — лише той, хто обере саме вас.'
        : 'Імʼя, фото й телефон. Клієнти обирають людей, а не нікнейми, а номер побачить лише той, хто обере саме вас.',
      // Кіт-талісман вітається — і людині, і компанії (власник).
      art: <CatScene scene="hello" say="Познайомимось!" />,
    },
    {
      id: 'work',
      title: 'Яку роботу берете',
      lead: company
        ? 'Які прибирання робите, звідки виїжджаєте й чи є авто. З цього ми підбираємо заявки — лише ті, що вам справді підходять.'
        : 'Які прибирання робите, де живете й як добираєтесь. З цього ми підбираємо заявки — лише ті, що вам справді підходять.',
      // Кіт думає сам із собою: відро зі шваброю чи пульверизатор? (власник)
      art: <CatScene scene="think" say="Яку роботу обрати?" />,
    },
    {
      id: 'profile',
      title: company ? 'Покажіть компанію клієнтам' : 'Покажіть себе клієнтам',
      lead: company
        ? 'Кілька слів про команду й фото робіт — і профіль іде на перевірку. Після неї заявки почнуть приходити самі.'
        : 'Кілька слів про досвід і фото робіт — і профіль іде на перевірку. Після неї заявки почнуть приходити самі.',
      // Кіт показує свій профіль на планшеті: зірки, «про себе», фото робіт.
      art: (
        <CatScene
          scene="show"
          say={company ? 'Покажіть компанію!' : 'Покажіть себе!'}
        />
      ),
    },
  ]
}

function stepsFor(company: boolean): WizardStep[] {
  return [
    {
      id: 'who',
      title: 'Ви — приватний майстер чи компанія?',
      subtitle:
        'Від цього залежить, про що спитаємо далі: імʼя чи назву, фото чи логотип.',
    },
    {
      id: 'overview',
      kind: 'overview',
      title: company
        ? 'Підключити компанію до Zunor — просто'
        : 'Стати майстром Zunor — просто',
    },
    { id: 'intro-you', kind: 'intro', phase: 'you', title: '' },
    company
      ? {
          id: 'name',
          phase: 'you',
          title: 'Як називається компанія?',
          subtitle:
            'Так вас бачитимуть клієнти — у пропозиціях, чаті й відгуках. Username стане адресою сторінки компанії.',
        }
      : {
          id: 'name',
          phase: 'you',
          title: 'Як вас звати?',
          subtitle:
            'Справжнє імʼя — клієнти довіряють людям, а не нікнеймам. Username стане адресою вашої сторінки.',
        },
    company
      ? {
          id: 'photo',
          phase: 'you',
          title: 'Додайте логотип',
          subtitle:
            'Логотип або фото команди — клієнти бачать його поруч із назвою.',
          optional: true,
        }
      : {
          id: 'photo',
          phase: 'you',
          title: 'Додайте своє фото',
          subtitle:
            'Майстрів із фото обличчя обирають частіше. Лише ви — без логотипів і картинок.',
          optional: true,
        },
    {
      id: 'phone',
      phase: 'you',
      title: company ? 'Телефон компанії' : 'Ваш номер телефону',
      subtitle:
        'Його побачить лише клієнт, який обрав саме вас, — і лише після підтвердження замовлення.',
    },
    { id: 'intro-work', kind: 'intro', phase: 'work', title: '' },
    {
      id: 'services',
      phase: 'work',
      title: 'Які прибирання ви робите?',
      subtitle:
        'Заявки приходитимуть лише з обраних — без того, чим ви не займаєтесь.',
    },
    {
      id: 'premises',
      phase: 'work',
      title: 'Де готові прибирати?',
      subtitle:
        'Офісні заявки не надсилатимемо тим, хто прибирає лише житло, — і навпаки.',
    },
    company
      ? {
          id: 'city',
          phase: 'work',
          title: 'Звідки виїжджаєте на замовлення?',
          subtitle:
            'Район офісу чи складу. Заявки з нього й сусідніх приходитимуть першими — менше часу в дорозі.',
        }
      : {
          id: 'city',
          phase: 'work',
          title: 'Де ви живете?',
          subtitle:
            'Заявки з вашого району й сусідніх приходитимуть першими — менше часу в дорозі.',
        },
    {
      id: 'transport',
      phase: 'work',
      title: company
        ? 'Як команда добирається на замовлення?'
        : 'Як добираєтесь на замовлення?',
      subtitle: 'Підбираємо заявки так, щоб дорога не зʼїдала ваш день.',
    },
    {
      id: 'radius',
      phase: 'work',
      title: 'Як далеко готові їздити?',
      subtitle:
        'Далі цієї відстані заявки не надсилатимемо. Чим ширше коло — тим більше заявок.',
    },
    {
      id: 'crew',
      phase: 'work',
      title: 'Працюєте самі чи з напарником?',
      subtitle:
        'Невеликі заявки першими отримують ті, хто працює сам, а великі квартири, будинки й після ремонту — ті, хто з напарником чи бригадою.',
    },
    { id: 'intro-profile', kind: 'intro', phase: 'profile', title: '' },
    company
      ? {
          id: 'about',
          phase: 'profile',
          title: 'Розкажіть про компанію',
          subtitle:
            'Скільки людей у команді, як давно працюєте, чим відрізняєтесь. Це перше, що читає клієнт.',
        }
      : {
          id: 'about',
          phase: 'profile',
          title: 'Розкажіть про себе',
          subtitle:
            'Досвід, що берете з собою, чим відрізняєтесь. Це перше, що читає клієнт.',
        },
    {
      id: 'portfolio',
      phase: 'profile',
      title: 'Покажіть свою роботу',
      subtitle:
        'Фото «до / після» переконують краще за слова. Можна додати й пізніше.',
      optional: true,
    },
    {
      id: 'review',
      phase: 'profile',
      title: 'Усе правильно?',
      subtitle:
        'Так вас бачитимуть клієнти. Після надсилання профіль перевірить модератор.',
    },
  ]
}

const toggle = <T,>(list: T[], v: T): T[] =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

type Touched = Partial<Record<string, boolean>>

/**
 * Анкета майстра — як на сайті (master-onboarding.svelte, режим
 * onboarding): одне питання на екран, від простого до складного, три
 * етапи з заставками й огляд на початку. «Людина чи компанія» — першим:
 * від нього залежить решта (назва замість імені, логотип замість фото,
 * «сам чи з напарником» компанію не питаємо — у базі компанія — це
 * `crew = COMPANY`, а назва лежить у User.name).
 *
 * «Які прибирання», «де», «авто» й «формат» — для підбору заявок
 * (dispatch), тому обовʼязкові. «Як далеко» — лише там, де в місті є
 * райони; «де прибирати» — лише з прибиранням серед категорій. Наприкінці
 * — перевірка всього разом із «Змінити» біля кожного рядка; щось не так —
 * ведемо на перший незаповнений крок.
 *
 * Зберігається ОДНИМ запитом у кінці (POST /api/profile/master, як у
 * налаштуваннях): сервер ставить роль майстра й onboarded лише після
 * повної перевірки й шле анкету на модерацію. Фото профілю — одразу;
 * приклади робіт — разом з анкетою (нові, але не надіслані, при виході
 * прибираємо з хмари).
 */
export function MasterOnboarding({
  data,
  onExit,
}: {
  data: MasterProfileData
  onExit: () => void
}) {
  const c = useColors()
  const u = data.user
  const m = data.master
  const enterApp = useEnterApp()

  // ─── Хто ви: людина чи компанія — із формату роботи ───
  const [kind, setKind] = useState<MasterKind | null>(
    m?.crew === 'COMPANY' ? 'company' : m?.crew ? 'person' : null,
  )
  const [personCrew, setPersonCrew] = useState<PersonCrew | null>(
    m?.crew === 'SOLO' || m?.crew === 'TEAM' ? m.crew : null,
  )
  const company = kind === 'company'

  // Імʼя людини й назва компанії — обидва User.name, але чернетки окремі:
  // інакше імʼя з Google ставало б «назвою компанії».
  const [personName, setPersonName] = useState(
    m?.crew === 'COMPANY' ? '' : (u.name ?? ''),
  )
  const [companyTitle, setCompanyTitle] = useState(
    m?.crew === 'COMPANY' ? (u.name ?? '') : '',
  )
  const name = company ? companyTitle : personName
  const setName = company ? setCompanyTitle : setPersonName

  const [username, setUsername] = useState(u.username ?? '')
  const usernameRef = useRef<TextFieldHandle>(null)
  const [phone, setPhone] = useState(normalizePhone(u.phone ?? ''))
  const [place, setPlace] = useState({
    city: u.city ?? (data.cities.length === 1 ? data.cities[0].slug : ''),
    district: u.district ?? '',
  })
  // Новий профіль — «будь-де»: звузити коло людина може сама.
  const [radius, setRadius] = useState<TravelRadius>(
    m && isTravelRadius(m.travelRadiusKm) ? m.travelRadiusKm : null,
  )
  // Категорія поки одна — «Прибирання»: її обираємо самі, а питаємо, які
  // саме прибирання.
  const onlyCategory =
    data.categories.length === 1 ? data.categories[0].slug : null
  const [categories, setCategories] = useState<string[]>(
    m?.categories.length ? m.categories : onlyCategory ? [onlyCategory] : [],
  )
  const [skills] = useState(() => parseCleaningSkills(m?.skills[CLEANING_SLUG]))
  const [services, setServices] = useState<string[]>(skills.services)
  const [premises, setPremises] = useState<PremiseGroup[]>(skills.premises)
  const [vehicle, setVehicle] = useState<boolean | null>(m?.hasVehicle ?? null)
  const [description, setDescription] = useState(m?.description ?? '')
  const [portfolio, setPortfolio] = useState<Photo[]>(() =>
    (m?.portfolioImages ?? []).map((url, i) => ({
      url,
      publicId: m?.portfolioImagesPublicIds[i] ?? url,
    })),
  )
  const [uploading, setUploading] = useState(false)
  const photo = useAvatarEditor({
    url: u.avatar ?? '',
    publicId: u.avatarPublicId ?? '',
  })

  const [step, setStep] = useState(0)
  const [touched, setTouched] = useState<Touched>({})
  const touch = (...keys: string[]) =>
    setTouched((t) => ({
      ...t,
      ...Object.fromEntries(keys.map((k) => [k, true])),
    }))
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  /** Анкету щойно надіслано — на весь екран свято з котом (Celebration). */
  const [celebrating, setCelebrating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Username: формат тут, зайнятість — у сервера, з паузою ───
  const uname = username.trim().toLowerCase()
  const unameFormat = usernameProblem(uname)
  const [taken, setTaken] = useState<'checking' | 'free' | 'taken' | null>(null)
  useEffect(() => {
    if (unameFormat || uname === (u.username ?? '')) {
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
        // Не перевірили (мережа) — не тримаємо людину: сервер перевірить.
        .catch(() => live && setTaken(null))
    }, 400)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [uname, unameFormat, u.username])

  // ─── Похідні ───
  const nameTrim = name.trim()
  const nameValid = nameTrim.length >= NAME_MIN && nameTrim.length <= NAME_MAX
  const usernameOk = !unameFormat && taken !== 'taken' && taken !== 'checking'
  const districts = cityDistricts(data.districts, place.city)
  const needsDistrict = districts.length > 0
  const districtValid =
    !needsDistrict || districts.some((d) => d.slug === place.district)
  const cleans = categories.includes(CLEANING_SLUG)
  const descTrim = description.trim()
  const descValid = descTrim.length >= DESC_MIN && descTrim.length <= DESC_MAX
  const cityName = data.cities.find((x) => x.slug === place.city)?.name ?? ''
  const districtName =
    districts.find((d) => d.slug === place.district)?.name ?? ''

  const steps = stepsFor(company).filter(
    (s) =>
      (needsDistrict || s.id !== 'radius') &&
      (cleans || s.id !== 'premises') &&
      (!company || s.id !== 'crew'),
  )
  const indexOf = (id: string) => steps.findIndex((s) => s.id === id)

  /** Чи заповнений крок — без побічних ефектів, для пошуку першої дірки. */
  function stepOk(id: string): boolean {
    switch (id) {
      case 'who':
        return kind !== null
      case 'name':
        return nameValid && usernameOk
      case 'phone':
        return phoneValid(phone)
      case 'services':
        return categories.length > 0 && (!cleans || services.length > 0)
      case 'premises':
        return !cleans || premises.length > 0
      case 'city':
        return !!place.city && districtValid
      case 'transport':
        return vehicle !== null
      case 'crew':
        return personCrew !== null
      case 'about':
        return descValid
      default:
        return true
    }
  }

  /**
   * Перед «Далі»: поля кроку стають «торкнутими» — підписи під ними
   * зʼявляються саме зараз. На перевірці — на перший незаповнений крок.
   */
  function validate(id: string): boolean {
    if (id === 'review') {
      const gap = steps.find((s) => !stepOk(s.id))
      if (!gap) return true
      touch(gap.id)
      setStep(indexOf(gap.id))
      return false
    }
    touch(id)
    return stepOk(id)
  }

  // ─── Помилки (ті самі, що на сайті) ───
  const err = (id: string, ok: boolean, text: string) =>
    touched[id] && !ok ? text : null
  const whoError = err('who', kind !== null, 'Оберіть один із варіантів')
  const nameError = err(
    'name',
    nameValid,
    !nameTrim
      ? company
        ? 'Введіть назву компанії'
        : 'Введіть імʼя'
      : `${company ? 'Назва' : 'Імʼя'}: ${NAME_MIN}–${NAME_MAX} символів`,
  )
  const usernameError = touched.name
    ? unameFormat || (taken === 'taken' ? 'Цей username уже зайнято' : null)
    : null
  const phoneError = err(
    'phone',
    phoneValid(phone),
    phone ? 'Перевірте номер: +380 XX XXX XX XX' : 'Введіть номер',
  )
  const categoriesError = err(
    'services',
    categories.length > 0,
    'Оберіть хоча б одну послугу',
  )
  const servicesError = err(
    'services',
    !cleans || services.length > 0,
    'Оберіть хоча б один вид прибирання',
  )
  const premisesError = err(
    'premises',
    !cleans || premises.length > 0,
    'Оберіть хоча б один варіант',
  )
  const cityError = err('city', !!place.city, 'Оберіть місто')
  const districtError =
    touched.city && place.city && !districtValid ? 'Оберіть район' : null
  const vehicleError = err(
    'transport',
    vehicle !== null,
    'Оберіть один із варіантів',
  )
  const crewError = err(
    'crew',
    personCrew !== null,
    'Оберіть один із варіантів',
  )
  const descError = err(
    'about',
    descValid,
    descTrim.length < DESC_MIN
      ? `Ще ${DESC_MIN - descTrim.length} символів до мінімуму`
      : 'Опис задовгий',
  )

  // ─── Дії ───

  /** Вийти до «Хто ви?»: надіслані в хмару, але не збережені фото робіт — геть. */
  function exit() {
    const keep = new Set(m?.portfolioImagesPublicIds ?? [])
    for (const p of portfolio) {
      if (!keep.has(p.publicId))
        void discardPortfolioPhoto(p.publicId).catch(() => {})
    }
    onExit()
  }

  async function save() {
    if (submitting) return
    setError(null)
    setSubmitting(true)
    if (!saved) {
      try {
        await api('/api/profile/master', {
          method: 'POST',
          json: {
            name: nameTrim,
            username: uname,
            phone: '+380' + phone,
            city: place.city,
            district: needsDistrict ? place.district : null,
            travelRadiusKm: radius,
            categories,
            vehicle,
            crew: company ? 'COMPANY' : personCrew,
            skills: cleans ? { [CLEANING_SLUG]: { services, premises } } : {},
            description: descTrim,
            // Фото профілю — поточне: без нього сервер прибрав би його.
            avatar: photo.avatar.url || null,
            avatarPublicId: photo.avatar.url
              ? photo.avatar.publicId || null
              : null,
            portfolioImages: portfolio.map((p) => p.url),
            portfolioImagesPublicIds: portfolio.map((p) => p.publicId),
          },
        })
        setSaved(true)
      } catch (e) {
        setError(errorText(e))
        setSubmitting(false)
        return
      }
      // Надіслано — спершу свято на весь екран, застосунок — після нього.
      setCelebrating(true)
      return
    }
    await open()
  }

  // Успіх — корінь сам відкриє застосунок майстра, і цей екран (разом зі
  // святом) зникне. Ні — свято геть, помилка й «ще раз» (без свята).
  async function open() {
    if (!(await enterApp())) {
      setCelebrating(false)
      setError(
        'Анкету надіслано, але застосунок не відкрився. Спробуйте ще раз',
      )
      setSubmitting(false)
    }
  }

  const serviceNames = SERVICES.filter((s) => services.includes(s.key)).map(
    (s) => s.label,
  )
  const premiseNames = PREMISE_GROUPS.filter((g) =>
    premises.includes(g.key),
  ).map((g) => g.label)
  const categoryNames = data.categories
    .filter((x) => categories.includes(x.slug))
    .map((x) => x.name)
  const allServices = services.length === SERVICES.length

  function renderStep(id: string, next: () => void) {
    switch (id) {
      case 'who':
        return (
          <ChoiceList
            options={KIND_OPTIONS.map((o) => ({
              ...o,
              icon:
                o.value === 'person'
                  ? ('profile' as const)
                  : ('office' as const),
            }))}
            selected={(v) => kind === v}
            onPress={(v) => setKind(v)}
            error={whoError}
          />
        )
      case 'name':
        return (
          <>
            <TextField
              focusOnMount
              label={company ? 'Чисто Плюс' : 'Олена Коваленко'}
              accessibilityLabel={company ? 'Назва компанії' : 'Імʼя'}
              value={name}
              onChangeText={setName}
              error={nameError}
              maxLength={NAME_MAX}
              autoCapitalize="words"
              autoComplete={company ? 'organization' : 'name'}
              textContentType={company ? 'organizationName' : 'name'}
              returnKeyType="next"
              onSubmitEditing={() => usernameRef.current?.focus()}
              submitBehavior="submit"
            />
            <TextField
              ref={usernameRef}
              prefix="@"
              label={company ? 'chysto_plus' : 'olena_clean'}
              accessibilityLabel="Username"
              value={username}
              onChangeText={(t) =>
                setUsername(t.toLowerCase().replace(/\s/g, ''))
              }
              error={usernameError}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={next}
              submitBehavior="submit"
              trailing={unameFormat ? null : <UsernameState state={taken} />}
            />
            {/* Адреса сторінки — видимим рядком: людина саме її й придумує. */}
            <Text className="pl-0.5 text-[14px] text-muted-foreground">
              {company ? 'Сторінка компанії' : 'Ваша сторінка'}: zunor.org/@
              {uname || 'username'}
            </Text>
          </>
        )
      case 'photo':
        return (
          <AvatarPicker
            uri={photo.avatar.url}
            name={nameTrim || u.email}
            busy={photo.busy}
            onChange={photo.change}
            noun={company ? 'логотип' : 'фото'}
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
      case 'services':
        return (
          <>
            {!onlyCategory ? (
              <ChoiceList
                options={data.categories.map((x) => ({
                  value: x.slug,
                  label: x.name,
                }))}
                selected={(v) => categories.includes(v)}
                onPress={(v) => {
                  if (
                    !categories.includes(v) &&
                    categories.length >= CATEGORIES_MAX
                  )
                    return
                  setCategories(toggle(categories, v))
                }}
                error={categoriesError}
              />
            ) : null}
            {cleans ? (
              <>
                {/* Універсалів більшість — «Обрати всі» замість шести дотиків. */}
                <Pressable
                  onPress={() =>
                    setServices(allServices ? [] : SERVICES.map((s) => s.key))
                  }
                  hitSlop={8}
                  className="self-end active:opacity-60"
                >
                  <Text className="text-[15px] font-semibold text-foreground">
                    {allServices ? 'Зняти всі' : 'Обрати всі'}
                  </Text>
                </Pressable>
                <ChoiceList
                  options={SERVICES.map((s) => ({
                    value: s.key as string,
                    label: s.label,
                    hint: SERVICE_HINTS[s.key],
                    leading: <ServiceBadge service={s.key} size={40} />,
                  }))}
                  selected={(v) => services.includes(v)}
                  onPress={(v) => setServices(toggle(services, v))}
                  error={servicesError}
                />
              </>
            ) : null}
          </>
        )
      case 'premises':
        return (
          <ChoiceList
            options={PREMISE_GROUPS.map((g) => ({
              value: g.key,
              label: g.label,
              hint: g.hint,
              icon: g.key === 'home' ? ('house' as const) : ('office' as const),
            }))}
            selected={(v) => premises.includes(v)}
            onPress={(v) => setPremises(toggle<PremiseGroup>(premises, v))}
            error={premisesError}
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
      case 'transport':
        return (
          <ChoiceList
            options={VEHICLE_OPTIONS.map((o) => ({
              ...o,
              icon: o.value ? ('car' as const) : ('bus' as const),
            }))}
            selected={(v) => vehicle === v}
            onPress={(v) => setVehicle(v)}
            error={vehicleError}
          />
        )
      case 'radius':
        return (
          <ChoiceList
            options={TRAVEL_OPTIONS.map((o) => ({
              ...o,
              icon: 'radius' as const,
            }))}
            selected={(v) => radius === v}
            onPress={(v) => setRadius(v)}
          />
        )
      case 'crew':
        return (
          <ChoiceList
            options={PERSON_CREW_OPTIONS.map((o) => ({
              ...o,
              icon:
                o.value === 'SOLO' ? ('profile' as const) : ('team' as const),
            }))}
            selected={(v) => personCrew === v}
            onPress={(v) => setPersonCrew(v)}
            error={crewError}
          />
        )
      case 'about':
        return (
          <>
            <TextField
              focusOnMount
              multiline
              label={
                company
                  ? 'Скільки років працюєте, яка команда, що прибираєте найкраще.'
                  : 'Досвід, що прибираєте найкраще, чим відрізняєтесь.'
              }
              accessibilityLabel={company ? 'Про компанію' : 'Про себе'}
              value={description}
              onChangeText={setDescription}
              error={descError}
              maxLength={DESC_MAX}
            />
            {!descError ? (
              <Text className="-mt-2 pl-0.5 text-[13px] text-muted-foreground">
                {descTrim.length < DESC_MIN
                  ? `Щонайменше ${DESC_MIN} символів — ще ${DESC_MIN - descTrim.length}`
                  : `${descTrim.length}/${DESC_MAX}`}
              </Text>
            ) : null}
          </>
        )
      case 'portfolio':
        return (
          <PortfolioEditor
            photos={portfolio}
            setPhotos={(update) => setPortfolio(update)}
            max={PORTFOLIO_MAX}
            onBusy={setUploading}
          />
        )
      case 'review':
        return (
          <>
            {m?.verificationStatus === 'REJECTED' &&
            m.verificationRejectReason ? (
              <View className="flex-row gap-2.5 rounded-2xl bg-secondary p-3.5">
                <Glyph name="alert" size={18} color={c.destructive} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-semibold text-foreground">
                    Профіль не пройшов перевірку
                  </Text>
                  <Text className="text-[14px] leading-[19px] text-muted-foreground">
                    {m.verificationRejectReason}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Превʼю «як побачить клієнт», під ним — рядок із кожного кроку. */}
            <View className="flex-row items-center gap-4">
              <Avatar
                uri={photo.avatar.url || null}
                name={nameTrim || '?'}
                size={64}
              />
              <View className="flex-1">
                <Text
                  numberOfLines={1}
                  className="text-[18px] font-semibold text-foreground"
                >
                  {nameTrim}
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-[15px] text-muted-foreground"
                >
                  @{uname}
                  {cityName ? ` · ${cityName}` : ''}
                </Text>
              </View>
            </View>

            <View className="border-y border-border">
              <ReviewRow
                label="Хто ви"
                value={KIND_OPTIONS.find((o) => o.value === kind)?.label ?? ''}
                onEdit={() => setStep(indexOf('who'))}
                first
              />
              <ReviewRow
                label={company ? 'Логотип' : 'Фото'}
                value={photo.avatar.url ? 'Додано' : ''}
                onEdit={() => setStep(indexOf('photo'))}
              />
              <ReviewRow
                label="Послуги"
                value={(cleans ? serviceNames : categoryNames).join(', ')}
                onEdit={() => setStep(indexOf('services'))}
              />
              {cleans ? (
                <ReviewRow
                  label="Де прибираєте"
                  value={premiseNames.join(', ')}
                  onEdit={() => setStep(indexOf('premises'))}
                />
              ) : null}
              <ReviewRow
                label={company ? 'Звідки виїжджаєте' : 'Де живете'}
                value={[districtName, cityName].filter(Boolean).join(', ')}
                onEdit={() => setStep(indexOf('city'))}
              />
              <ReviewRow
                label="Дорога"
                value={
                  VEHICLE_OPTIONS.find((o) => o.value === vehicle)?.label ?? ''
                }
                onEdit={() => setStep(indexOf('transport'))}
              />
              {needsDistrict ? (
                <ReviewRow
                  label="Виїзд"
                  value={
                    TRAVEL_OPTIONS.find((o) => o.value === radius)?.label ?? ''
                  }
                  onEdit={() => setStep(indexOf('radius'))}
                />
              ) : null}
              {!company ? (
                <ReviewRow
                  label="Як працюєте"
                  value={
                    PERSON_CREW_OPTIONS.find((o) => o.value === personCrew)
                      ?.label ?? ''
                  }
                  onEdit={() => setStep(indexOf('crew'))}
                />
              ) : null}
              <ReviewRow
                label="Телефон"
                value={phone ? `+380 ${formatPhone(phone)}` : ''}
                onEdit={() => setStep(indexOf('phone'))}
              />
              <ReviewRow
                label={company ? 'Про компанію' : 'Про себе'}
                value={descTrim}
                onEdit={() => setStep(indexOf('about'))}
              />
              <ReviewRow
                label="Приклади робіт"
                value={portfolio.length ? `${portfolio.length} фото` : ''}
                onEdit={() => setStep(indexOf('portfolio'))}
              />
            </View>
          </>
        )
      default:
        return null
    }
  }

  return (
    <View className="flex-1">
      <Wizard
        steps={steps}
        phases={phasesFor(company)}
        current={step}
        onStep={setStep}
        validate={validate}
        onExit={exit}
        onSubmit={save}
        submitLabel="Надіслати на перевірку"
        busy={submitting || photo.busy || uploading}
        submitting={submitting}
        note="Фото ще завантажується…"
        error={error}
        renderStep={renderStep}
      />
      {celebrating ? (
        <Celebration
          title="Анкету надіслано!"
          text="Перевіримо профіль і напишемо вам. Після цього заявки почнуть приходити самі."
          onDone={() => void open()}
        />
      ) : null}
    </View>
  )
}

/** Рядок перевірки: що вказано і «Змінити» — на той крок. */
function ReviewRow({
  label,
  value,
  onEdit,
  first = false,
}: {
  label: string
  value: string
  onEdit: () => void
  first?: boolean
}) {
  return (
    <View
      className={`flex-row items-start gap-3 py-3.5 ${
        first ? '' : 'border-t border-border'
      }`}
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-[14px] text-muted-foreground">{label}</Text>
        <Text
          numberOfLines={3}
          className={`text-[16px] leading-[21px] ${
            value ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {value || 'Не вказано'}
        </Text>
      </View>
      <Pressable
        onPress={onEdit}
        hitSlop={8}
        className="py-0.5 active:opacity-60"
      >
        <Text className="text-[15px] font-semibold text-foreground">
          Змінити
        </Text>
      </Pressable>
    </View>
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
  return (
    <View className="size-11 items-center justify-center">
      {state === 'checking' ? (
        <ActivityIndicator size="small" color={c.mutedForeground} />
      ) : state === 'free' ? (
        <Glyph name="check" size={16} color="#34c759" weight="semibold" />
      ) : (
        <Glyph name="close" size={15} color={c.destructive} weight="semibold" />
      )}
    </View>
  )
}
