// КОПІЯ з сайту — web/src/lib/categories/cleaning/presets.ts.
// Репозиторії різні, тож імпорт `../web/...` у збірці EAS не працює
// (../AGENTS.md). Міняються на сайті підписи чи логіка дня — міняй тут
// у тій самій задачі.

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
