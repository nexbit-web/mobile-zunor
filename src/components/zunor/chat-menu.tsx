import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { RoundButton } from '@/components/ui/round-button'
import { SITE_URL } from '@/lib/config'
import { useColors } from '@/lib/theme'

/**
 * Дії з розмовою — меню з кнопки праворуч угорі, як chat-header.svelte на
 * сайті: нова розмова, копія розмови, заявка без чату, налаштування
 * асистента. Останні два — поки на сайті (екранів у застосунку ще немає).
 */
export function ChatMenu({
  started,
  onReset,
  onCopy,
}: {
  /** Розмова вже йде: є що скидати й копіювати. */
  started: boolean
  onReset: () => void
  onCopy: () => void
}) {
  const c = useColors()
  const insets = useSafeAreaInsets()
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
    {
      icon: 'tune',
      label: 'Налаштування асистента',
      onPress: () =>
        WebBrowser.openBrowserAsync(`${SITE_URL}/dashboard/settings/assistant`),
    },
  ]

  return (
    <>
      <RoundButton
        icon="more"
        label="Дії з розмовою"
        onPress={() => setOpen(true)}
      />
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setOpen(false)}
          accessibilityLabel="Закрити меню"
        />
        {open ? (
          <Animated.View
            entering={ZoomIn.duration(140).withInitialValues({
              transform: [{ scale: 0.92 }],
            })}
            exiting={FadeOut.duration(100)}
            style={{
              position: 'absolute',
              top: insets.top + 54,
              right: 16,
              boxShadow: '0 14px 36px rgba(0, 0, 0, 0.22)',
              borderRadius: 18,
              transformOrigin: 'top right',
            }}
          >
            {/* Класи — на звичайному View: анімований компонент їх не
                гарантовано розбирає. */}
            <View
              className="w-[268px] rounded-[20px] bg-card p-1.5 dark:bg-secondary"
              style={{ borderCurve: 'continuous' }}
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
                  className={`flex-row items-center gap-3 rounded-[14px] px-3 py-3 active:opacity-60 ${
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
            </View>
          </Animated.View>
        ) : (
          <View />
        )}
      </Modal>
    </>
  )
}
