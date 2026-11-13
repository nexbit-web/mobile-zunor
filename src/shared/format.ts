// КОПІЯ з сайту — web/src/lib/utils/time.ts і web/src/lib/utils/plural.ts.
// Ті самі слова, що на сайті: «учора» не має стати «1 дн тому» в одному
// з двох місць. Міняються там — міняй тут.

/** «щойно / 5 хв тому / учора / 3 дн тому», далі дата. */
export function formatRelative(value: string | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const min = Math.floor((Date.now() - date.getTime()) / 60_000)
  const hr = Math.floor(min / 60)
  const days = Math.floor(hr / 24)

  if (min < 1) return 'щойно'
  if (min < 60) return `${min} хв тому`
  if (hr < 24) return `${hr} год тому`
  if (days === 1) return 'учора'
  if (days < 7) return `${days} дн тому`

  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
}

/** Календарний день за Києвом: «Сьогодні», «Завтра», «Учора», «Пт, 30 жовт.». */
export function formatDay(iso: string, now: Date = new Date()): string {
  const day = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(day)) return ''

  const today = Date.parse(
    `${now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' })}T00:00:00Z`,
  )
  const diff = Math.round((day - today) / 86_400_000)
  if (diff === 0) return 'Сьогодні'
  if (diff === 1) return 'Завтра'
  if (diff === -1) return 'Учора'

  const label = new Date(day).toLocaleDateString('uk-UA', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * День повністю, як у документі: «Субота, 14 листопада»; сьогодні й
 * завтра — «Сьогодні, 11 листопада», «Завтра, 12 листопада».
 */
export function formatDayLong(iso: string, now: Date = new Date()): string {
  const day = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(day)) return ''
  const date = new Date(day).toLocaleDateString('uk-UA', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  })
  const near = formatDay(iso, now)
  if (near === 'Сьогодні' || near === 'Завтра' || near === 'Учора') {
    return `${near}, ${date}`
  }
  const weekday = new Date(day).toLocaleDateString('uk-UA', {
    timeZone: 'UTC',
    weekday: 'long',
  })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date}`
}

export function pluralUk(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod100 = Math.abs(n) % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  const mod10 = mod100 % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
