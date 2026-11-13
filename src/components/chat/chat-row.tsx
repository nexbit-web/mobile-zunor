import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Glyph } from '@/components/icons/glyph'
import { Avatar } from '@/components/ui/avatar'
import { Bone } from '@/components/ui/skeleton'
import { useColors } from '@/lib/theme'
import { formatChatTime, type ChatPreview } from '@/shared/chat'

import { Ticks } from './ticks'

/** Відступ лінії між рядками — від початку тексту, як у Telegram. */
export const ROW_INSET = 16 + 54 + 12

/**
 * Рядок списку чатів, як у Telegram: аватар, імʼя (з галочкою перевіреного
 * майстра), час праворуч; нижче — останнє повідомлення на два рядки й
 * лічильник непрочитаних кольору акценту. Біля свого останнього —
 * ✓ / ✓✓ (прочитав чи ні співрозмовник).
 */
export function ChatRow({
  chat,
  me,
  onPress,
}: {
  chat: ChatPreview
  me: string | undefined
  onPress: () => void
}) {
  const c = useColors()
  const mine = Boolean(me) && chat.lastSenderId === me
  const read =
    mine &&
    Boolean(chat.peerLastReadAt && chat.lastMessageAt) &&
    new Date(chat.peerLastReadAt as string).getTime() >=
      new Date(chat.lastMessageAt as string).getTime()
  const unread = chat.unreadCount
  const name = chat.peer.name || 'Користувач'

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}${unread ? `, непрочитаних: ${unread}` : ''}`}
      className="flex-row items-center gap-3 px-4 py-2.5 active:bg-secondary"
    >
      <Avatar uri={chat.peer.avatar} name={name} size={54} />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text
            numberOfLines={1}
            className="shrink text-[16px] font-semibold text-foreground"
          >
            {name}
          </Text>
          {chat.peer.isVerified ? (
            <Glyph name="verified" size={14} color={c.primary} />
          ) : null}
          <View className="flex-1" />
          {mine ? <Ticks read={read} color={c.primary} /> : null}
          <Text
            className={`text-[13px] ${
              unread ? 'text-primary' : 'text-muted-foreground'
            }`}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatChatTime(chat.lastMessageAt ?? chat.updatedAt)}
          </Text>
        </View>
        <View className="flex-row items-start gap-2">
          <Text
            numberOfLines={2}
            className="flex-1 text-[15px] leading-[20px] text-muted-foreground"
          >
            {mine ? <Text className="text-foreground">Ви: </Text> : null}
            {chat.lastMessageText || 'Розмову розпочато'}
          </Text>
          {unread > 0 ? (
            <View className="mt-0.5 h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5">
              <Text
                className="text-[13px] font-semibold text-primary-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

/**
 * Лінія між розмовами — від початку тексту, як у Telegram. Колір `input`,
 * а не `border`: 7% майже не видно (так сказав власник).
 */
export function ChatSeparator() {
  return (
    <View
      className="bg-input"
      style={{ marginLeft: ROW_INSET, height: StyleSheet.hairlineWidth }}
    />
  )
}

/** Довжини імені й прев'ю по черзі — список не виглядає штампом. */
const SKELETON_WIDTHS: [`${number}%`, `${number}%`][] = [
  ['45%', '80%'],
  ['36%', '66%'],
  ['52%', '74%'],
]

/**
 * Заглушка рядка, поки список вантажиться: фото, імʼя й останнє
 * повідомлення брусками. «Дихає» — у <Skeleton> списку (ui/skeleton).
 */
export function ChatRowSkeleton({ index = 0 }: { index?: number }) {
  const [name, preview] = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]
  return (
    <View className="flex-row items-center gap-3 px-4 py-2.5">
      <Bone width={54} height={54} radius={27} />
      <View className="flex-1 gap-2">
        <Bone width={name} height={14} />
        <Bone width={preview} height={12} />
      </View>
    </View>
  )
}
