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
  ])

  return {
    background: pick(background, '#f2f2f7'),
    foreground: pick(foreground, '#0b2833'),
    card: pick(card, '#ffffff'),
    mutedForeground: pick(mutedForeground, '#5f6e75'),
    primary: pick(primary, '#1f6feb'),
    primaryForeground: pick(primaryForeground, '#ffffff'),
    border: pick(border, 'rgba(11, 40, 51, 0.08)'),
    input: pick(input, 'rgba(11, 40, 51, 0.14)'),
    shell: pick(shell, '#ffffff'),
    destructive: pick(destructive, '#ff3b30'),
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
