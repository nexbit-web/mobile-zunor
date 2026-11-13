import { BlurView } from 'expo-blur'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { Glyph, type GlyphName } from '@/components/icons/glyph'
import { useColors } from '@/lib/theme'
import {
  messageSummary,
  myReaction,
  REACTIONS,
  type ChatMessage,
} from '@/shared/chat'

export interface MenuAction {
  label: string
  icon: GlyphName
  destructive?: boolean
  onPress: () => void
}

/**
 * Меню повідомлення за довгим дотиком, як у Telegram: екран
 * розмивається, зверху — смужка реакцій (обрана підсвічена), під нею —
 * саме повідомлення, нижче — дії (відповісти, копіювати, змінити,
 * видалити). Набір реакцій — закритий, той самий, що на сайті.
 */
export function MessageMenu({
  message,
  mine,
  me,
  actions,
  onReact,
  onClose,
}: {
  message: ChatMessage | null
  mine: boolean
  me: string
  actions: MenuAction[]
  onReact: (emoji: string) => void
  onClose: () => void
}) {
  const c = useColors()
  const dark = useColorScheme() === 'dark'
  if (!message) return null
  const current = myReaction(message.reactions ?? [], me)
  const preview = messageSummary(message)

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(120)}
        style={StyleSheet.absoluteFill}
      >
        {Platform.OS === 'android' ? null : (
          <BlurView
            tint={dark ? 'dark' : 'light'}
            intensity={30}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Pressable
          onPress={onClose}
          accessibilityLabel="Закрити меню"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: dark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.22)' },
          ]}
        />
      </Animated.View>

      <View
        pointerEvents="box-none"
        className={`flex-1 justify-center px-4 ${mine ? 'items-end' : 'items-start'}`}
      >
        <Animated.View
          entering={FadeIn.duration(150)}
          className={`max-w-[88%] gap-2 ${mine ? 'items-end' : 'items-start'}`}
        >
          {/* ─── Реакції ─── */}
          <View
            className="flex-row items-center rounded-full bg-card px-1.5 py-1"
            style={{ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)' }}
          >
            {REACTIONS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => onReact(e)}
                  accessibilityRole="button"
                  accessibilityLabel={`Реакція ${e}`}
                  accessibilityState={{ selected: current === e }}
                  className={`size-[42px] items-center justify-center rounded-full active:opacity-60 ${
                    current === e ? 'bg-secondary' : ''
                  }`}
                >
                  <Text className="text-[27px]">{e}</Text>
                </Pressable>
            ))}
          </View>

          {/* ─── Саме повідомлення ─── */}
          {preview ? (
            <View
              className={`max-w-[320px] rounded-[18px] px-3 py-2 ${
                mine ? 'bg-primary' : 'bg-card'
              }`}
              style={{ borderCurve: 'continuous' }}
            >
              <Text
                numberOfLines={8}
                className={`text-[17px] leading-[22px] ${
                  mine ? 'text-primary-foreground' : 'text-foreground'
                }`}
              >
                {preview}
              </Text>
            </View>
          ) : null}

          {/* ─── Дії ─── */}
          {/* Дії — як контекстне меню iOS у Telegram: 17 pt, рядок 46. */}
          <View
            className="w-[250px] overflow-hidden rounded-[18px] bg-card"
            style={{
              borderCurve: 'continuous',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
            }}
          >
            {actions.map((a, i) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                accessibilityRole="menuitem"
                className="min-h-[46px] flex-row items-center justify-between px-4 py-3 active:bg-secondary"
                style={
                  i > 0
                    ? {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: c.border,
                      }
                    : undefined
                }
              >
                <Text
                  className={`text-[17px] ${
                    a.destructive ? 'text-destructive' : 'text-foreground'
                  }`}
                >
                  {a.label}
                </Text>
                <Glyph
                  name={a.icon}
                  size={21}
                  color={a.destructive ? c.destructive : c.foreground}
                />
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}
