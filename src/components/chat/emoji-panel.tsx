import * as Haptics from 'expo-haptics'
import { useMemo, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { recentEmoji, rememberEmoji } from '@/lib/recent-emoji'
import { EMOJI_GROUPS, type EmojiGroup } from '@/shared/chat'

/** Висота панелі — приблизно як клавіатура, щоб поле не стрибало. */
export const EMOJI_PANEL_HEIGHT = 290

const COLS = 8

/**
 * Панель емодзі на місці клавіатури, як у Telegram: «Нещодавні» першим
 * рядом, далі групи сайту (shared/chat). Після вибору не закривається —
 * кілька емодзі поспіль ставлять частіше, ніж одне. «Нещодавні»
 * читаються лише при відкритті, щоб емодзі не тікали з-під пальця.
 */
export function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [recent] = useState(recentEmoji)
  const cell = Math.floor((width - 16) / COLS)

  const sections = useMemo<EmojiGroup[]>(
    () =>
      recent.length
        ? [{ title: 'Нещодавні', emoji: recent }, ...EMOJI_GROUPS]
        : EMOJI_GROUPS,
    [recent],
  )

  const pick = (emoji: string) => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync()
    rememberEmoji(emoji)
    onPick(emoji)
  }

  return (
    <View
      className="bg-background"
      style={{ height: EMOJI_PANEL_HEIGHT + insets.bottom }}
    >
      <View
        className="absolute inset-x-0 top-0 bg-border"
        style={{ height: StyleSheet.hairlineWidth }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{
          paddingHorizontal: 8,
          paddingTop: 6,
          paddingBottom: insets.bottom + 8,
        }}
      >
        {sections.map((s) => (
          <View key={s.title} className="mb-1">
            <Text className="px-1.5 pb-1 pt-2 text-[12.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              {s.title}
            </Text>
            <View className="flex-row flex-wrap">
              {s.emoji.map((e) => (
                <Pressable
                  key={`${s.title}-${e}`}
                  onPress={() => pick(e)}
                  accessibilityRole="button"
                  accessibilityLabel={e}
                  className="items-center justify-center rounded-[10px] active:bg-secondary"
                  style={{ width: cell, height: cell }}
                >
                  <Text style={{ fontSize: Math.min(30, cell * 0.66) }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
