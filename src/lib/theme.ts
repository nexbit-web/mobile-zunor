// Кольори для місць, де className не дістає: тема навігації (шапки, фон
// між екранами), колір вкладок, плейсхолдер поля, іконки. Джерело — ті
// самі змінні з global.css, тож палітра одна. Запасні значення — світла
// тема, на випадок, якщо змінна ще не прочиталась.

import { DarkTheme, DefaultTheme, type Theme } from 'expo-router'
import { useColorScheme } from 'react-native'
import { useCSSVariable } from 'uniwind'

const pick = (value: string | number | undefined, fallback: string) =>
  typeof value === 'string' && value ? value : fallback

export function useColors() {
  const [
    background,
    foreground,
    card,
    mutedForeground,
    primary,
    primaryForeground,
    border,
    input,
    shell,
    destructive,
    secondary,
    drawer,
    drawerEdge,
    field,
  ] = useCSSVariable([
    '--color-background',
    '--color-foreground',
    '--color-card',
    '--color-muted-foreground',
    '--color-primary',
    '--color-primary-foreground',
    '--color-border',
    '--color-input',
    '--color-shell',
    '--color-destructive',
    '--color-secondary',
    '--color-drawer',
    '--color-drawer-edge',
    '--color-field',
  ])

  return {
    background: pick(background, '#ffffff'),
    foreground: pick(foreground, '#1f1f1f'),
    card: pick(card, '#f6f6f7'),
    mutedForeground: pick(mutedForeground, '#6b6b70'),
    primary: pick(primary, '#1f6feb'),
    primaryForeground: pick(primaryForeground, '#ffffff'),
    border: pick(border, 'rgba(0, 0, 0, 0.07)'),
    input: pick(input, 'rgba(0, 0, 0, 0.12)'),
    shell: pick(shell, '#f2f2f4'),
    destructive: pick(destructive, '#e5484d'),
    secondary: pick(secondary, '#eaeaed'),
    drawer: pick(drawer, '#f6f6f7'),
    drawerEdge: pick(drawerEdge, 'rgba(0, 0, 0, 0.1)'),
    field: pick(field, '#f2f2f4'),
  }
}

/**
 * Колір токена з прозорістю `alpha` (0…1). Токени — #rgb / #rrggbb;
 * інший запис (rgba) повертаємо як є — краще непрозоро, ніж зламано.
 */
export function withAlpha(color: string, alpha: number): string {
  let hex = color.trim()
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    hex = `#${[...hex.slice(1)].map((ch) => ch + ch).join('')}`
  }
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return color
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  return `${hex}${a.toString(16).padStart(2, '0')}`
}

/**
 * Колір, змішаний із білим на частку `amount` (0…1): акцент, що читається
 * на темній плашці («Скасувати» — undo-toast). Не #rrggbb — як є.
 */
export function mixWhite(color: string, amount: number): string {
  let hex = color.trim()
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    hex = `#${[...hex.slice(1)].map((ch) => ch + ch).join('')}`
  }
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return color
  const t = Math.min(1, Math.max(0, amount))
  const mix = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16)
    return Math.round(v + (255 - v) * t)
      .toString(16)
      .padStart(2, '0')
  })
  return `#${mix.join('')}`
}

/** Тема навігації в кольорах застосунку — інакше шапки були б білими й у темній. */
export function useNavigationTheme(): Theme {
  const dark = useColorScheme() === 'dark'
  const c = useColors()
  const base = dark ? DarkTheme : DefaultTheme
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.background,
      card: c.background,
      text: c.foreground,
      border: c.border,
    },
  }
}
