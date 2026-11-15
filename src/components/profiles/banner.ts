import { CLEANING_SLUG } from '@/shared/masters'

/**
 * Банер шапки профілю майстра за категорією — КОПІЯ реєстру сайту
 * (web/src/lib/categories/registry.ts, CATEGORY_META) і його картинок
 * (web/static/banners). Картинка — у застосунку, а не з сайту: шапка
 * зʼявляється одразу, без завантаження. Нова категорія з банером на сайті
 * — поклади копію в assets/images/banners і додай рядок тут.
 */
const BANNERS: Record<string, number> = {
  [CLEANING_SLUG]: require('../../../assets/images/banners/cleaning-living-room.webp'),
}

/**
 * Перша категорія, для якої є банер. Немає — null, шапка без банера
 * (запасний банер сайту, `web-development.gif`, у static відсутній).
 */
export function bannerFor(slugs: string[] | undefined): number | null {
  for (const slug of slugs ?? []) {
    const banner = BANNERS[slug]
    if (banner) return banner
  }
  return null
}
