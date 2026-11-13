import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { HeaderMenu } from '@/components/ui/header-menu'
import { RoundButton } from '@/components/ui/round-button'
import { SITE_URL } from '@/lib/config'
import { CLIENT_DOCK } from '@/lib/dock'
import { useColors } from '@/lib/theme'

/**
 * Дії з розмовою — меню з кнопки праворуч угорі, як chat-header.svelte на
 * сайті: нова розмова, копія розмови, заявка без чату (поки на сайті),
 * налаштування асистента (екран застосунку, settings/assistant).
 */
export function ChatMenu({
  started,
  onReset,
  onCopy,
  slot = 0,
}: {
  /** Розмова вже йде: є що скидати й копіювати. */
  started: boolean
  onReset: () => void
  onCopy: () => void
  /** Котра кнопка від правого краю (меню виростає з неї, HeaderMenu). */
  slot?: number
}) {
  const c = useColors()
  const [open, setOpen] = useState(false)

  const items: {
    icon: GlyphName
    label: string
    onPress: () => void
    disabled?: boolean
  }[] = [
    {
      icon: 'compose',
      label: 'Нова розмова',
      onPress: onReset,
      disabled: !started,
    },
    {
      icon: 'copy',
      label: 'Скопіювати розмову',
      onPress: onCopy,
      disabled: !started,
    },
    {
      icon: 'document',
      label: 'Заповнити заявку самому',
      onPress: () =>
        WebBrowser.openBrowserAsync(`${SITE_URL}/dashboard/jobs/new/manual`),
    },
    // З нижньою панеллю (прототип, lib/dock) анкета асистента — «✎» у
    // бічній панелі, тут її вже не треба.
    ...(CLIENT_DOCK
      ? []
      : [
          {
            icon: 'tune' as const,
            label: 'Налаштування асистента',
            onPress: () => router.push('/settings/assistant'),
          },
        ]),
  ]

  return (
    <>
      <RoundButton
        icon="more"
        label="Дії з розмовою"
        onPress={() => setOpen(true)}
      />
      {/* Виростає з самої кнопки й стягується в неї (ui/header-menu). */}
      <HeaderMenu
        open={open}
        onClose={() => setOpen(false)}
        width={268}
        slot={slot}
        label="Закрити меню"
      >
        {items.map((item) => (
          <Pressable
            key={item.label}
            disabled={item.disabled}
            onPress={() => {
              setOpen(false)
              item.onPress()
            }}
            accessibilityRole="menuitem"
            className={`flex-row items-center gap-3 rounded-[14px] px-3 py-3 active:bg-secondary ${
              item.disabled ? 'opacity-40' : ''
            }`}
          >
            <View className="w-6 items-center">
              <Glyph name={item.icon} size={18} color={c.foreground} />
            </View>
            <Text className="flex-1 text-[16.5px] text-foreground">
              {item.label}
            </Text>
          </Pressable>
        ))}
      </HeaderMenu>
    </>
  )
}
