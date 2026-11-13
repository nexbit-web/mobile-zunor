import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EmptyState } from '@/components/empty-state'
import { Glyph } from '@/components/icons/glyph'
import { HeaderFade } from '@/components/ui/header-fade'
import { CHIP, useChipShadow } from '@/components/ui/chip'
import { RoundButton } from '@/components/ui/round-button'
import { HEADER_BAR, useContentBottom } from '@/lib/large-title'
import { useColors } from '@/lib/theme'
import type { ChatPreview } from '@/shared/chat'

import { ChatRow, ChatSeparator } from './chat-row'
import { searchChats } from './use-chats'

/**
 * Пошук у списку чатів, як у Telegram iOS: лупа в шапці → шапка (назва,
 * дзвіночок) поступається полю пошуку на всю ширину з круглою «✕»
 * праворуч (замість слова «Скасувати» — так попросив власник), клавіатура відкрита одразу. Нижче — один список збігів (без
 * розділів «Усі / Непрочитані»): спершу за імʼям, далі — за останнім
 * повідомленням. Порожнє поле — усі чати.
 *
 * Лежить поверх розділів, а не замість них: «✕» повертає туди ж,
 * де людина була (розділ і прокрутка цілі).
 *
 * Поява — за `shown` (0 → 1, веде ChatList рівним timing, без пружин):
 * шапка екрана в цей час гасне (headerAway), поле виїжджає справа, від
 * лупи, «✕» — слідом, список проявляється. Закриття — те саме
 * назад, і лише потім ChatList прибирає пошук.
 */
export function ChatSearch({
  chats,
  me,
  shown,
  onClose,
}: {
  chats: ChatPreview[]
  me: string | undefined
  shown: SharedValue<number>
  onClose: () => void
}) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const bottom = useContentBottom()
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchChats(chats, query), [chats, query])
  const bar = insets.top + HEADER_BAR
  const shadow = useChipShadow()

  const layer = useAnimatedStyle(() => ({ opacity: shown.get() }))
  const field = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateX: (1 - shown.get()) * 56 }],
  }))
  const cancel = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateX: (1 - shown.get()) * 56 }],
  }))
  const list = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - shown.get()) * 14 }],
  }))

  const close = () => {
    Keyboard.dismiss()
    onClose()
  }

  // Android: системне «назад» закриває пошук, а не виходить зі вкладки.
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [onClose])

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, layer]}
      className="bg-background"
    >
      <Animated.FlatList
        style={list}
        data={results}
        keyExtractor={(chat) => chat.id}
        renderItem={({ item }) => (
          <ChatRow
            chat={item}
            me={me}
            onPress={() =>
              router.push({ pathname: '/chat/[id]', params: { id: item.id } })
            }
          />
        )}
        ItemSeparatorComponent={ChatSeparator}
        // Перший дотик по рядку відкриває чат, а не лише ховає клавіатуру.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="grow"
        contentContainerStyle={{ paddingTop: bar + 4, paddingBottom: bottom }}
        ListEmptyComponent={
          query.trim() ? (
            <EmptyState
              icon="search"
              title="Нічого не знайдено"
              text="Спробуйте інше імʼя чи слово з повідомлення."
            />
          ) : undefined
        }
      />

      {/* На місці шапки — те саме тло, що в шапки: список іде під смугу
          й плавно розмивається до краю екрана. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: bar,
          paddingTop: insets.top,
        }}
      >
        <HeaderFade height={bar} />
        <View
          className="flex-row items-center gap-2 px-4"
          style={{ height: HEADER_BAR }}
        >
          <Animated.View
            // Та сама підкладка, що в кнопок шапки (ui/chip.ts).
            className={`h-11 flex-1 flex-row items-center rounded-full pl-3.5 ${CHIP}`}
            style={[{ borderCurve: 'continuous', boxShadow: shadow }, field]}
          >
            <Glyph name="search" size={19} color={c.mutedForeground} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Пошук"
              placeholderTextColor={c.mutedForeground}
              selectionColor={c.primary}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Пошук у чатах"
              className="h-11 flex-1 pl-2 text-foreground"
              style={{ fontSize: 17 }}
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Очистити"
                className="size-11 items-center justify-center active:opacity-50"
              >
                <Glyph name="clear" size={18} color={c.mutedForeground} />
              </Pressable>
            ) : (
              <View className="w-3" />
            )}
          </Animated.View>
          <Animated.View style={cancel}>
            <RoundButton icon="close" label="Скасувати пошук" onPress={close} />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  )
}
