// Підказки домену пошти під полем входу — як у ClickUp: почав вводити
// пошту — під полем «@gmail.com», «@ukr.net»…; натиснув — домен
// дописався. На телефоні «@» і домен — найдовше й найчастіше з
// помилками (gmial.com), а помилка в пошті — це «Невірна пошта або
// пароль» і людина, що пішла.

/**
 * Поштові домени, за поширеністю в Україні: спершу ті, що в людей
 * найчастіше (gmail, ukr.net, iCloud — у кожного iPhone), далі решта.
 */
export const EMAIL_DOMAINS = [
  'gmail.com',
  'ukr.net',
  'icloud.com',
  'outlook.com',
  'i.ua',
  'meta.ua',
  'yahoo.com',
  'hotmail.com',
  'proton.me',
] as const

/**
 * Які домени підказати для введеного:
 * - порожньо, пробіли, «@» на початку чи двічі — нічого;
 * - «@» ще немає — перші `limit` доменів;
 * - домен почато («ivan@u») — ті, що з нього починаються;
 * - домен уже повний або свій («@company.com») — нічого.
 */
export function domainSuggestions(value: string, limit = 4): string[] {
  const v = value.trim()
  if (!v || /\s/.test(v)) return []
  const at = v.indexOf('@')
  if (at === 0) return []
  if (at < 0) return EMAIL_DOMAINS.slice(0, limit)
  if (v.includes('@', at + 1)) return []
  const typed = v.slice(at + 1).toLowerCase()
  return EMAIL_DOMAINS.filter(
    (d) => d.startsWith(typed) && d !== typed,
  ).slice(0, limit)
}

/** Пошта з обраним доменом: «ivan@u» + ukr.net → «ivan@ukr.net». */
export function withDomain(value: string, domain: string): string {
  const local = value.trim().split('@')[0]
  return `${local}@${domain}`
}
