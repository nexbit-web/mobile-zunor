// Телефон — як у формі профілю на сайті (client-onboarding.svelte): у полі
// лише 9 значущих цифр, «+380» стоїть перед ним і додається при збереженні.

/** Будь-що введене чи вставлене → не більше 9 цифр після коду країни. */
export function normalizePhone(input: string): string {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('380')) d = d.slice(3)
  else if (d.startsWith('80')) d = d.slice(2)
  else if (d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 9)
}

/** 671234567 → «67 123 45 67». */
export function formatPhone(d: string): string {
  let out = d.slice(0, 2)
  if (d.length > 2) out += ' ' + d.slice(2, 5)
  if (d.length > 5) out += ' ' + d.slice(5, 7)
  if (d.length > 7) out += ' ' + d.slice(7, 9)
  return out
}

/** Український мобільний: 9 цифр, перша — 3, 5, 6, 7 або 9. */
export function phoneValid(d: string): boolean {
  return d.length === 9 && /^[35679]/.test(d)
}
