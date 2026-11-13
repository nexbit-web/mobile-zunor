import { router } from 'expo-router'
import { Pressable, Text } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { Glyph } from '@/components/icons/glyph'
import { useColors } from '@/lib/theme'

import { useChats } from './use-chats'

/**
 * «Назад» у розмові — до списку чатів. Лише шеврон, без круглої
 * підкладки (так попросив власник), а поруч — скільки непрочитаних у
 * ІНШИХ розмовах, як у Telegram: написали, поки ти тут, — видно одразу.
 * Число — червоний кружечок, як на вкладці «Чати» в нижній панелі;
 * зʼявляється й гасне плавно.
 *
 * Розмову відкрили без історії (push на холодному старті) — веде до
 * списку чатів, а не нікуди.
 */
export function ChatBack({
  chatId,
  canGoBack,
}: {
  /** Ця розмова — її непрочитані не рахуємо. */
  chatId: string
  canGoBack: boolean
}) {
  const c = useColors()
  const { data } = useChats()
  const unread = (data ?? []).reduce(
    (n, chat) => (chat.id === chatId ? n : n + chat.unreadCount),
    0,
  )
  return (
    <Pressable
      onPress={() => (canGoBack ? router.back() : router.navigate('/messages'))}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? `Назад, непрочитаних: ${unread}` : 'Назад'
      }
      className="h-11 flex-row items-center gap-1 pr-1 active:opacity-50"
    >
      <Glyph name="back" size={24} color={c.foreground} weight="medium" />
      {unread > 0 ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
          className="h-[22px] min-w-[22px] items-center justify-center rounded-full bg-destructive px-1.5"
        >
          <Text
            className="text-[13px] font-semibold leading-4 text-white"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {unread > 99 ? '99+' : unread}
          </Text>
        </Animated.View>
      ) : null}
    </Pressable>
  )
}
