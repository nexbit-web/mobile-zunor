import { Pressable, Text, useColorScheme, View } from 'react-native'

import { Icon } from '@/components/icons/icon'
import {
  ACCENTS,
  setAccent,
  setThemeMode,
  useAppearance,
  type ThemeMode,
} from '@/lib/appearance'
import { useColors } from '@/lib/theme'

/** Кружки кольорів, як палітра на сайті; під ними — назва обраного. */
export function AccentPicker() {
  const { accent } = useAppearance()
  const tone = useColorScheme() === 'dark' ? 'dark' : 'light'
  const selected = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[2]

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap justify-between gap-y-3">
        {ACCENTS.map((a) => {
          const on = a.id === accent
          const fill = a.color[tone]
          const tick = 'foreground' in a ? a.foreground[tone] : '#ffffff'
          return (
            <Pressable
              key={a.id}
              onPress={() => setAccent(a.id)}
              role="radio"
              aria-checked={on}
              aria-label={a.label}
              hitSlop={4}
              // 5 у ряд: (ширина − відступи) / 5 — кружок 40 + кільце.
              className="w-[19%] items-center"
            >
              <View
                className="size-[48px] items-center justify-center rounded-full border-2"
                style={{ borderColor: on ? fill : 'transparent' }}
              >
                <View
                  className="size-[38px] items-center justify-center rounded-full"
                  style={{ backgroundColor: fill }}
                >
                  {on ? (
                    <Icon name="check" size={20} color={tick} strokeWidth={2.4} />
                  ) : null}
                </View>
              </View>
            </Pressable>
          )
        })}
      </View>
      <Text className="text-center text-[14px] text-muted-foreground">
        {selected.label}
      </Text>
    </View>
  )
}

export const THEME_LABEL: Record<ThemeMode, string> = {
  light: 'Світла',
  dark: 'Темна',
  system: 'Системна',
}

const THEMES: ThemeMode[] = ['light', 'dark', 'system']

/** Три мініатюри: світла, темна і «як на пристрої» — навпіл. */
export function ThemePicker() {
  const c = useColors()
  const { theme } = useAppearance()
  return (
    <View className="flex-row gap-3">
      {THEMES.map((t) => {
        const on = t === theme
        return (
          <Pressable
            key={t}
            onPress={() => setThemeMode(t)}
            role="radio"
            aria-checked={on}
            aria-label={`${THEME_LABEL[t]} тема`}
            className="flex-1 items-center gap-2"
          >
            <View
              className="h-[86px] w-full flex-row overflow-hidden rounded-[14px] border-2"
              style={{ borderColor: on ? c.primary : c.border }}
            >
              {t === 'system' ? (
                <>
                  <Preview tone="light" accent={c.primary} />
                  <Preview tone="dark" accent={c.primary} />
                </>
              ) : (
                <Preview tone={t} accent={c.primary} />
              )}
            </View>
            <Text
              className={`text-[14px] ${
                on ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
            >
              {THEME_LABEL[t]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// Мініатюра — у СВОЇХ кольорах, а не в увімкненій темі (як на сайті).
// Значення — з global.css: фон, картка, лінія.
const PREVIEW = {
  light: { bg: '#f2f2f7', card: '#ffffff', line: '#e5e5ea' },
  dark: { bg: '#000000', card: '#1c1c1e', line: '#3a3a3c' },
} as const

function Preview({ tone, accent }: { tone: 'light' | 'dark'; accent: string }) {
  const p = PREVIEW[tone]
  return (
    <View className="flex-1 gap-1.5 p-2.5" style={{ backgroundColor: p.bg }}>
      <View
        className="h-[7px] w-[60%] rounded-full"
        style={{ backgroundColor: p.line }}
      />
      <View
        className="flex-1 gap-1.5 rounded-[6px] p-1.5"
        style={{ backgroundColor: p.card }}
      >
        <View
          className="h-[5px] w-[80%] rounded-full"
          style={{ backgroundColor: p.line }}
        />
        <View
          className="h-[5px] w-[55%] rounded-full"
          style={{ backgroundColor: p.line }}
        />
      </View>
      <View
        className="h-[8px] w-[45%] self-end rounded-full"
        style={{ backgroundColor: accent }}
      />
    </View>
  )
}
