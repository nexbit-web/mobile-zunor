import { Switch, View } from 'react-native'

import {
  AccentPicker,
  ThemePicker,
} from '@/components/settings/appearance-pickers'
import { Row, Section, SettingsScroll } from '@/components/settings/list'
import { setHighContrast, useAppearance } from '@/lib/appearance'
import { useColors } from '@/lib/theme'

/**
 * Вигляд — як розділ на сайті: колір акценту, тема й контрастність.
 * Зберігається на цьому пристрої (lib/appearance).
 */
export default function AppearanceSettings() {
  const c = useColors()
  const look = useAppearance()

  return (
    <SettingsScroll>
      <Section title="Колір акценту">
        <View className="p-4">
          <AccentPicker />
        </View>
      </Section>

      <Section title="Тема">
        <View className="p-4">
          <ThemePicker />
        </View>
      </Section>

      <Section
        title="Контрастність"
        inset="text"
        footer="Вигляд зберігається лише на цьому пристрої."
      >
        <Row
          label="Висока контрастність"
          description="Чіткіший текст і рамки."
          right={
            <Switch
              value={look.highContrast}
              onValueChange={setHighContrast}
              trackColor={{ true: c.primary, false: c.input }}
              ios_backgroundColor={c.input}
              accessibilityLabel="Висока контрастність"
            />
          }
        />
      </Section>
    </SettingsScroll>
  )
}
