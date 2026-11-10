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
    border,
    input,
  ] = useCSSVariable([
    '--color-background',
    '--color-foreground',
    '--color-card',
    '--color-muted-foreground',
    '--color-primary',
    '--color-border',
    '--color-input',
  ])

  return {
    background: pick(background, '#fbfbfb'),
    foreground: pick(foreground, '#0b2833'),
    card: pick(card, '#ffffff'),
    mutedForeground: pick(mutedForeground, '#475d65'),
    primary: pick(primary, '#1f6feb'),
    border: pick(border, 'rgba(11, 40, 51, 0.07)'),
    input: pick(input, 'rgba(11, 40, 51, 0.15)'),
  }
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
