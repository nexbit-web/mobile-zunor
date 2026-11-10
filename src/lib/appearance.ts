// Вигляд — як «Налаштування → Вигляд» на сайті: тема, колір акценту й
// висока контрастність. Особистий вибір цього пристрою (на сервері його
// немає), лежить у SecureStore — він уже є в застосунку й читається
// синхронно, тож потрібні кольори стоять із першого кадру.
//
// Кольори — КОПІЯ web/src/routes/layout.css (блоки [data-accent] і
// [data-contrast='more']), список — web/src/lib/stores/appearance.svelte.ts.
// Базові значення (тема, звичайна контрастність) — src/global.css.
// Міняєш там — міняй і тут.

import * as SecureStore from 'expo-secure-store'
import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import { Uniwind } from 'uniwind'

export type ThemeMode = 'system' | 'light' | 'dark'

type Tone = 'light' | 'dark'

interface Accent {
  id: string
  label: string
  /** Колір акценту в світлій і темній темі. */
  color: Record<Tone, string>
  /** Текст на кнопці кольору акценту, якщо не білий. */
  foreground?: Record<Tone, string>
}

export const ACCENTS = [
  {
    id: 'mono',
    label: 'Чорно-білий',
    color: { light: '#202020', dark: '#f5f5f7' },
    foreground: { light: '#ffffff', dark: '#000000' },
  },
  { id: 'violet', label: 'Фіалковий', color: { light: '#7b68ee', dark: '#7b68ee' } },
  { id: 'blue', label: 'Синій', color: { light: '#1f6feb', dark: '#1f6feb' } },
  { id: 'pink', label: 'Рожевий', color: { light: '#ee5e99', dark: '#ee5e99' } },
  { id: 'purple', label: 'Бузковий', color: { light: '#b660e0', dark: '#b660e0' } },
  { id: 'indigo', label: 'Волошковий', color: { light: '#6985ff', dark: '#6985ff' } },
  { id: 'orange', label: 'Помаранчевий', color: { light: '#e16b16', dark: '#e16b16' } },
  { id: 'teal', label: 'Бірюзовий', color: { light: '#0f9d9f', dark: '#0f9d9f' } },
  { id: 'mocha', label: 'Мокко', color: { light: '#aa8d80', dark: '#aa8d80' } },
  { id: 'green', label: 'Зелений', color: { light: '#238636', dark: '#238636' } },
] as const satisfies readonly Accent[]

export type AccentId = (typeof ACCENTS)[number]['id']

/** Синій — базовий у global.css; його не зберігаємо, як і на сайті. */
export const DEFAULT_ACCENT: AccentId = 'blue'

// Звичайні й контрастні значення сірого тексту, рамок і полів.
const CONTRAST: Record<'normal' | 'more', Record<Tone, Record<string, string>>> = {
  normal: {
    light: {
      '--color-muted-foreground': '#5f6e75',
      '--color-border': 'rgba(11, 40, 51, 0.08)',
      '--color-input': 'rgba(11, 40, 51, 0.14)',
    },
    dark: {
      '--color-muted-foreground': '#98989f',
      '--color-border': 'rgba(255, 255, 255, 0.08)',
      '--color-input': 'rgba(255, 255, 255, 0.13)',
    },
  },
  more: {
    light: {
      '--color-muted-foreground': '#424242',
      '--color-border': '#b3b3b3',
      '--color-input': '#646464',
    },
    dark: {
      '--color-muted-foreground': '#d4d4d4',
      '--color-border': '#646464',
      '--color-input': '#b3b3b3',
    },
  },
}

const KEYS = {
  theme: 'zunor-theme',
  accent: 'zunor-accent',
  contrast: 'zunor-contrast',
} as const

// У браузері (dev) SecureStore немає — там localStorage. Сховище може
// кинути: тоді вибір діє до перезапуску, без помилки на екрані.
function read(key: string): string | null {
  try {
    return Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(key) ?? null
      : SecureStore.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (Platform.OS === 'web') {
      if (value === null) globalThis.localStorage?.removeItem(key)
      else globalThis.localStorage?.setItem(key, value)
    } else if (value === null) {
      void SecureStore.deleteItemAsync(key)
    } else {
      SecureStore.setItem(key, value)
    }
  } catch {}
}

export interface AppearanceState {
  theme: ThemeMode
  accent: AccentId
  highContrast: boolean
}

function load(): AppearanceState {
  const theme = read(KEYS.theme)
  const accent = read(KEYS.accent)
  return {
    theme: theme === 'light' || theme === 'dark' ? theme : 'system',
    accent: ACCENTS.some((a) => a.id === accent)
      ? (accent as AccentId)
      : DEFAULT_ACCENT,
    highContrast: read(KEYS.contrast) === 'more',
  }
}

let state: AppearanceState = load()
const listeners = new Set<() => void>()

function apply(next: AppearanceState): void {
  Uniwind.setTheme(next.theme)
  const accent = ACCENTS.find((a) => a.id === next.accent) ?? ACCENTS[2]
  const contrast = CONTRAST[next.highContrast ? 'more' : 'normal']
  for (const tone of ['light', 'dark'] as const) {
    const fg = 'foreground' in accent ? accent.foreground[tone] : '#ffffff'
    Uniwind.updateCSSVariables(tone, {
      '--color-primary': accent.color[tone],
      '--color-primary-foreground': fg,
      ...contrast[tone],
    })
  }
}

function update(patch: Partial<AppearanceState>): void {
  state = { ...state, ...patch }
  apply(state)
  listeners.forEach((l) => l())
}

/** Один раз до першого кадру (корінь застосунку). */
export function initAppearance(): void {
  apply(state)
}

export function setThemeMode(theme: ThemeMode): void {
  write(KEYS.theme, theme === 'system' ? null : theme)
  update({ theme })
}

export function setAccent(accent: AccentId): void {
  // Типовий не пишемо: зміна типового в global.css дійде до всіх, хто
  // його не міняв.
  write(KEYS.accent, accent === DEFAULT_ACCENT ? null : accent)
  update({ accent })
}

export function setHighContrast(on: boolean): void {
  write(KEYS.contrast, on ? 'more' : null)
  update({ highContrast: on })
}

export function useAppearance(): AppearanceState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => state,
  )
}
