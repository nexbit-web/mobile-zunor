// Анкета майстра — КОПІЯ правил сайту, щоб форма в застосунку питала те
// саме й тими самими словами:
//   web/src/lib/masters/meta.ts            — хто, формат роботи, транспорт
//   web/src/lib/geo/travel.ts              — як далеко їздити
//   web/src/lib/categories/cleaning/skills.ts — які прибирання й де
//   web/src/lib/username.ts                — правила username
// Сервер (POST /api/profile/master → saveMasterProfile) перевіряє все
// повторно. Міняється там — міняй тут у тій самій задачі.

import { SERVICES } from './cleaning'

/** Slug категорії «Прибирання» (categories/cleaning/presets.ts). */
export const CLEANING_SLUG = 'prybyrannya'

export type Crew = 'SOLO' | 'TEAM' | 'COMPANY'
export type MasterKind = 'person' | 'company'
export type PersonCrew = Exclude<Crew, 'COMPANY'>

export const KIND_OPTIONS = [
  {
    value: 'person',
    label: 'Приватний майстер',
    hint: 'Працюю сам(а) або з напарником',
  },
  {
    value: 'company',
    label: 'Клінінгова компанія',
    hint: 'Працюємо командою під назвою компанії',
  },
] as const satisfies readonly { value: MasterKind; label: string; hint: string }[]

export const PERSON_CREW_OPTIONS = [
  {
    value: 'SOLO',
    label: 'Сам(а)',
    hint: 'Квартири й невеликі прибирання йтимуть вам першими',
  },
  {
    value: 'TEAM',
    label: 'З напарником або бригадою',
    hint: 'Великі квартири, будинки, прибирання після ремонту',
  },
] as const satisfies readonly { value: PersonCrew; label: string; hint: string }[]

export const VEHICLE_OPTIONS = [
  {
    value: true,
    label: 'Своїм авто',
    hint: 'Покличемо й на дальші заявки та ті, де треба вивезти сміття',
  },
  {
    value: false,
    label: 'Громадським транспортом',
    hint: 'Пропонуватимемо заявки ближче до вас',
  },
] as const

/** null — «будь-де», без обмеження. */
export type TravelRadius = 5 | 10 | 15 | null

export const TRAVEL_OPTIONS: readonly {
  value: TravelRadius
  label: string
  hint: string
}[] = [
  { value: 5, label: 'До 5 км', hint: 'Свій район і сусідні' },
  { value: 10, label: 'До 10 км', hint: 'Пів міста' },
  { value: 15, label: 'До 15 км', hint: 'Майже все місто' },
  { value: null, label: 'Будь-де', hint: 'Усе місто й передмістя' },
]

export function isTravelRadius(v: unknown): v is TravelRadius {
  return v === null || v === 5 || v === 10 || v === 15
}

/** Що входить у послугу — підказка під назвою. */
export const SERVICE_HINTS: Record<string, string> = {
  standard: 'Пил, підлоги, кухня, санвузол',
  deep: 'До дрібниць: техніка, шафи, плитка',
  'post-renovation': 'Будівельний пил, фарба, сміття',
  windows: 'Вікна, балкони, вітрини',
  sofa: 'Дивани, крісла, матраци, килими',
  regular: 'Постійні клієнти за графіком',
}

export const PREMISE_GROUPS = [
  {
    key: 'home',
    label: 'Квартири й будинки',
    hint: 'Житло: квартири, будинки, дачі',
  },
  {
    key: 'business',
    label: 'Офіси й комерція',
    hint: 'Офіси, магазини, салони, кафе',
  },
] as const

export type PremiseGroup = (typeof PREMISE_GROUPS)[number]['key']

export interface CleaningSkills {
  services: string[]
  premises: PremiseGroup[]
}

/** Уміння з бази: що є — те й беремо, у порядку довідника. */
export function parseCleaningSkills(raw: unknown): CleaningSkills {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const pick = <T extends string>(v: unknown, allowed: readonly T[]): T[] =>
    Array.isArray(v) ? allowed.filter((k) => v.includes(k)) : []
  return {
    services: pick(
      r.services,
      SERVICES.map((s) => s.key),
    ),
    premises: pick(
      r.premises,
      PREMISE_GROUPS.map((g) => g.key),
    ),
  }
}

// ─── Username ───

export const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/

const RESERVED = new Set([
  'admin', 'root', 'api', 'support', 'help', 'zunor', 'system', 'user',
  'users', 'profile', 'dashboard', 'settings', 'login', 'register', 'signup',
  'logout', 'moderation', 'verified', 'null', 'undefined', 'anonymous',
])

/** Те саме, що validateUsername на сайті: '' — усе добре, інакше причина. */
export function usernameProblem(raw: string): string {
  const v = raw.trim().toLowerCase()
  if (!v) return 'Введіть username'
  if (!USERNAME_RE.test(v)) {
    return '3–20 символів: латиниця, цифри, «_», починається з літери'
  }
  if (RESERVED.has(v)) return 'Цей username зарезервовано'
  return ''
}

// ─── Межі (web/src/lib/server/profile.ts) ───

export const NAME_MIN = 2
export const NAME_MAX = 80
export const DESC_MIN = 50
export const DESC_MAX = 2000
export const CATEGORIES_MAX = 5
export const PORTFOLIO_MAX = 6

/** Стан перевірки профілю — словами й тоном. */
export function verificationLook(status: string): {
  label: string
  tone: 'done' | 'progress' | 'off' | 'danger'
} {
  switch (status) {
    case 'VERIFIED':
      return { label: 'Перевірено', tone: 'done' }
    case 'PENDING':
      return { label: 'На перевірці', tone: 'progress' }
    case 'REJECTED':
      return { label: 'Не пройшов перевірку', tone: 'danger' }
    default:
      return { label: 'Не перевірено', tone: 'off' }
  }
}
