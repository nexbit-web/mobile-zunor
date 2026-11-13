import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { Glyph } from '@/components/icons/glyph'
import { ServiceIcon } from '@/components/icons/service-icon'
import { HeaderMenu } from '@/components/ui/header-menu'
import { RoundButton } from '@/components/ui/round-button'
import { useColors } from '@/lib/theme'
import { SERVICES, serviceLabel } from '@/shared/cleaning'

/**
 * Фільтр стрічки майстра — як на сайті (master-feed.svelte): компактне
 * меню з іконками послуг, «Усі послуги» зверху, обране — з галочкою.
 * Відбирає вже завантажені заявки за `metadata.service`, без нового
 * запиту — так само, як сайт.
 *
 * Кнопка в шапці поруч із дзвіночком; увімкнений фільтр видно одразу —
 * іконка зафарбована кольором акценту.
 */
export function FeedFilter({
  value,
  onChange,
}: {
  /** null — усі послуги. */
  value: string | null
  onChange: (service: string | null) => void
}) {
  const c = useColors()
  const [open, setOpen] = useState(false)

  const pick = (service: string | null) => {
    setOpen(false)
    if (service === value) return
    if (Platform.OS !== 'web') void Haptics.selectionAsync()
    onChange(service)
  }

  const options: { key: string | null; label: string }[] = [
    { key: null, label: 'Усі послуги' },
    ...SERVICES.map((s) => ({ key: s.key, label: s.label })),
  ]

  return (
    <>
      <RoundButton
        icon={value ? 'filterOn' : 'filter'}
        tint={value ? c.primary : undefined}
        label={value ? `Фільтр: ${serviceLabel(value)}` : 'Фільтр: усі послуги'}
        onPress={() => setOpen(true)}
      />
      {/* Виростає з кнопки фільтра (друга справа, поруч із дзвіночком) і
          стягується в неї (ui/header-menu). */}
      <HeaderMenu
        open={open}
        onClose={() => setOpen(false)}
        width={248}
        slot={1}
        label="Закрити фільтр"
      >
        <Text className="px-3 pb-1 pt-2 text-[13px] font-medium text-muted-foreground">
          Показати
        </Text>
        {options.map((o) => {
          const on = o.key === value
          return (
            <View key={o.key ?? 'all'}>
              <Pressable
                onPress={() => pick(o.key)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: on }}
                className="flex-row items-center gap-3 rounded-[14px] px-3 py-2.5 active:bg-secondary"
              >
                <View className="w-6 items-center">
                  {o.key ? (
                    <ServiceIcon service={o.key} size={20} />
                  ) : (
                    <Glyph
                      name="allServices"
                      size={17}
                      color={c.mutedForeground}
                    />
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  className={`flex-1 text-[16px] text-foreground ${
                    on ? 'font-semibold' : ''
                  }`}
                >
                  {o.label}
                </Text>
                {on ? (
                  <Glyph
                    name="check"
                    size={15}
                    color={c.primary}
                    weight="semibold"
                  />
                ) : null}
              </Pressable>
              {/* «Усі» — окремо від послуг, як роздільник на сайті. */}
              {o.key === null ? (
                <View
                  className="mx-3 my-1 bg-border"
                  style={{ height: StyleSheet.hairlineWidth * 2 }}
                />
              ) : null}
            </View>
          )
        })}
      </HeaderMenu>
    </>
  )
}
