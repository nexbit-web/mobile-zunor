// КОПІЯ з сайту — web/src/lib/categories/cleaning/presets.ts.
// Репозиторії різні, тож імпорт `../web/...` у збірці EAS не працює
// (../AGENTS.md). Міняються на сайті підписи чи логіка дня — міняй тут
// у тій самій задачі.

import { pluralUk } from './format'

export const PREMISES = [
  { key: 'apartment', label: 'Квартира' },
  { key: 'house', label: 'Дім' },
  { key: 'office', label: 'Офіс' },
  { key: 'commercial', label: 'Комерційне' },
  { key: 'other', label: 'Інше' },
] as const

export const SERVICES = [
  { key: 'standard', label: 'Звичайне' },
  { key: 'deep', label: 'Генеральне' },
  { key: 'post-renovation', label: 'Після ремонту' },
  { key: 'windows', label: 'Миття вікон' },
  { key: 'sofa', label: 'Хімчистка' },
  { key: 'regular', label: 'Регулярне' },
] as const

export function premiseLabel(key: string): string {
  return PREMISES.find((p) => p.key === key)?.label ?? key
}

export function serviceLabel(key: string): string {
  return SERVICES.find((s) => s.key === key)?.label ?? key
}

const QUICK_WHEN_OFFSET: Record<string, number> = { today: 0, tomorrow: 1 }

/**
 * День прибирання як ISO-день за Києвом. «today»/«tomorrow» у заявці —
 * відносно дня її СТВОРЕННЯ, тож без createdAt вони брешуть.
 */
export function resolveWhen(
  when: unknown,
  createdAt: string | Date,
): string | null {
  if (typeof when !== 'string') return null
  const offset = QUICK_WHEN_OFFSET[when]
  if (offset === undefined)
    return /^\d{4}-\d{2}-\d{2}$/.test(when) ? when : null

  const base = new Date(createdAt).getTime()
  if (Number.isNaN(base)) return null
  return new Date(base + offset * 86_400_000).toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Kyiv',
  })
}

// ─── Деталі (адаптивні, залежать від послуги) ───

const ROOMS: Record<string, string> = {
  '1': '1 кімната',
  '2': '2 кімнати',
  '3': '3 кімнати',
  '4plus': '4+ кімнати',
}
const ELEVATOR: Record<string, string> = { yes: 'Є ліфт', no: 'Немає ліфта' }
const BALCONY: Record<string, string> = {
  none: 'Немає',
  standard: 'Звичайний',
  panoramic: 'Панорамний',
}
const WINDOW_SIDE: Record<string, string> = {
  inside: 'Зсередини',
  outside: 'Ззовні',
  both: 'З двох боків',
}
const TRASH: Record<string, string> = {
  removed: 'Сміття вже винесене',
  'needs-removal': 'Потрібно винести сміття',
}
const FREQUENCY: Record<string, string> = {
  daily: 'Щодня',
  weekly: 'Раз на тиждень',
  biweekly: 'Раз на 2 тижні',
  monthly: 'Раз на місяць',
}

const SOFA_ITEMS: {
  key: string
  label: string
  variants?: Record<string, string>
}[] = [
  {
    key: 'sofa',
    label: 'Диван',
    variants: { '2': '2-місний', '3': '3-місний', corner: 'Кутовий' },
  },
  { key: 'armchair', label: 'Крісло' },
  {
    key: 'mattress',
    label: 'Матрац',
    variants: { single: '1-спальний', double: '2-спальний' },
  },
  {
    key: 'carpet',
    label: 'Килим',
    variants: { small: 'Малий', medium: 'Середній', large: 'Великий' },
  },
  { key: 'chairs', label: 'Стільці' },
]

const label = (map: Record<string, string>, key: unknown) =>
  map[String(key)] ?? String(key)

/**
 * Характеристики заявки короткими тегами — КОПІЯ `jobTags` з
 * web/src/lib/components/jobs/display.ts (поверх describeJob з
 * categories/cleaning/describe.ts): помешкання, кімнати, площа, частота,
 * сміття, вікна, поверх, ліфт, предмети хімчистки. Без послуги й дня —
 * вони в картці окремим рядком.
 */
export function jobTags(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  const m = metadata as Record<string, unknown>
  const tags: string[] = []

  if (m.premise) tags.push(premiseLabel(String(m.premise)))
  if (m.rooms) tags.push(label(ROOMS, m.rooms))
  if (typeof m.areaM2 === 'number' && m.areaM2 > 0) tags.push(`≈ ${m.areaM2} м²`)
  if (m.frequency) tags.push(label(FREQUENCY, m.frequency))
  if (m.trash) tags.push(label(TRASH, m.trash))
  if (m.windowsCount) {
    const n = Number(m.windowsCount)
    tags.push(`${n} ${pluralUk(n, 'вікно', 'вікна', 'вікон')}`)
  }
  if (m.windowSide) tags.push(label(WINDOW_SIDE, m.windowSide))
  if (m.balcony) tags.push(label(BALCONY, m.balcony))
  if (m.floor != null) tags.push(`${m.floor}-й поверх`)
  if (m.hasElevator) tags.push(label(ELEVATOR, m.hasElevator))
  if (Array.isArray(m.items)) {
    for (const raw of m.items) {
      const it = (raw ?? {}) as Record<string, unknown>
      const def = SOFA_ITEMS.find((i) => i.key === String(it.type))
      const name = def?.label ?? String(it.type)
      const variant =
        it.variant && def?.variants
          ? ` (${def.variants[String(it.variant)] ?? String(it.variant)})`
          : ''
      const qty = Number(it.qty) || 1
      tags.push(qty > 1 ? `${name}${variant} × ${qty}` : `${name}${variant}`)
    }
  }
  return tags.filter(Boolean)
}
