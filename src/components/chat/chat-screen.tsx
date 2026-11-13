import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import type { ImagePickerAsset } from 'expo-image-picker'
import { Stack, useIsFocused, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  useColorScheme,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EmptyState, EmptyStateInset } from '@/components/empty-state'
import { Glyph } from '@/components/icons/glyph'
import { PhotoViewer } from '@/components/photo-grid'
import { Avatar } from '@/components/ui/avatar'
import { showActionSheet } from '@/lib/action-sheet'
import { api, errorText } from '@/lib/api'
import { authClient } from '@/lib/auth'
import { confirmAction } from '@/lib/confirm'
import { useInputReset } from '@/lib/input-reset'
import { HEADER_BAR } from '@/lib/large-title'
import { useColors } from '@/lib/theme'
import { useChannel, useChannelLive } from '@/lib/realtime'
import { pickPhotos, uploadChatPhoto } from '@/lib/upload'
import {
  applyReaction,
  canEdit,
  MAX_TEXT_LENGTH,
  messageSummary,
  nextReaction,
  presenceLabel,
  sameDay,
  type ChatDetails,
  type ChatMessage,
  type LinkPreview,
  type ReactionGroup,
} from '@/shared/chat'
import { formatRelative } from '@/shared/format'
import { notificationDay } from '@/shared/notifications'

import { ChatBack } from './chat-back'
import { ChatBackground } from './chat-background'
import { ChatComposer, type ComposerContext } from './chat-composer'
import {
  AvatarSkeleton,
  ChatTitleSkeleton,
  MessagesSkeleton,
} from './chat-skeleton'
import { EMOJI_PANEL_HEIGHT, EmojiPanel } from './emoji-panel'
import { MessageBubble } from './message-bubble'
import { MessageMenu, type MenuAction } from './message-menu'
import {
  applyChatUpdate,
  markChatReadInList,
  previewText,
  setOpenChat,
} from './use-chats'
import { useChatMessages } from './use-chat-messages'

/** Чернетки на час сесії: вийшов із розмови й повернувся — текст на місці. */
const drafts = new Map<string, string>()

/** Повідомлення одного автора ближче за це — одна серія. */
const GROUP_MS = 5 * 60_000

/** Своє повідомлення, що ще йде (чи не дійшло) — поки без id сервера. */
interface Outgoing {
  tmp: ChatMessage
  state: 'sending' | 'failed'
  asset: ImagePickerAsset | null
}

/**
 * Розмова — як на сайті (`/dashboard/messages/[id]`) і в Telegram:
 * поверх вкладок, без нижньої панелі; у шапці — імʼя, «у мережі» й фото
 * співрозмовника; унизу — поле вводу з фото й емодзі.
 *
 * Що вміє: відповідь із цитатою (і перехід до неї), реакції, правка
 * (своє текстове, протягом доби) і видалення, ✓✓ (з `peerLastReadAt`),
 * фото з підписом, посилання з карткою, «прочитано» при відкритті.
 * Надіслане зʼявляється одразу (оптимістично) з годинником; не дійшло —
 * червоний знак із «Надіслати ще раз».
 *
 * Дані — ті самі ендпоінти, що на сайті (`/api/chats/[id]/*`); правила
 * (хто що може, вікно правки) перевіряє сервер. Нове приходить живим
 * каналом (Pusher, `private-chat-{id}` — ті самі події, що на сайті); поки
 * його немає — перепитом.
 */
export function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const eid = encodeURIComponent(id)
  const c = useColors()
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const { data: session } = authClient.useSession()
  const me = session?.user?.id ?? ''
  const focused = useIsFocused()
  // «Живо» — лише коли підписка на канал розмови справді пройшла: інакше
  // перепит лишається, і нове не запізнюється.
  const live = useChannelLive(`private-chat-${id}`)

  const details = useQuery({
    queryKey: ['chat', id],
    queryFn: () =>
      api<{ chat: ChatDetails; currentUserId: string }>(`/api/chats/${eid}`),
    // «У мережі» живий канал не приносить (presence — лише з сервера),
    // тож шапку перепитуємо й з ним, але рідше; ✓✓ приходить подією.
    refetchInterval: focused ? (live ? 30_000 : 10_000) : false,
  })
  const chat = details.data?.chat
  const peer = chat?.peer
  const peerName = peer?.name || 'Співрозмовник'

  // З живим каналом перепит не потрібен: пропущене за час без зʼєднання
  // докачуємо, щойно підписка (знову) пройшла.
  const store = useChatMessages(id, focused && !live ? 4000 : false)
  const [outgoing, setOutgoing] = useState<Outgoing[]>([])

  // Поки розмова на екрані, нове в ній не рахується непрочитаним у списку.
  useEffect(() => (focused ? setOpenChat(id) : undefined), [focused, id])

  // ─── Живий канал розмови ───
  const [typing, setTyping] = useState(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
    },
    [],
  )
  const channel = useChannel(`private-chat-${id}`, {
    // Підписка пройшла — уперше чи після повернення з тла / обриву
    // мережі: те, що прийшло без каналу, докачуємо одним запитом.
    'pusher:subscription_succeeded': () => {
      void store.refetch({ cancelRefetch: false })
      void details.refetch({ cancelRefetch: false })
    },
    'message:new': (d: { message: ChatMessage }) => {
      const m = d.message
      if (m.senderId === me) {
        // Своє прийшло подією раніше за відповідь на POST — годинник
        // знімаємо одразу (та сама відповідь потім лише підтвердить).
        setOutgoing((o) => {
          const i = o.findIndex(
            (x) =>
              x.state === 'sending' &&
              x.tmp.type === m.type &&
              x.tmp.text === m.text,
          )
          if (i < 0) return o
          keyFor.current.set(m.id, o[i].tmp.id)
          return o.filter((_, j) => j !== i)
        })
      } else {
        setTyping(false)
      }
      store.upsert(m)
    },
    'message:edit': (d: {
      messageId: string
      text: string
      editedAt: string
      linkPreview?: LinkPreview | null
    }) =>
      store.patch(d.messageId, (x) => ({
        ...x,
        text: d.text,
        editedAt: d.editedAt,
        ...('linkPreview' in d ? { linkPreview: d.linkPreview ?? null } : null),
      })),
    'message:delete': (d: { messageId: string }) =>
      store.patch(d.messageId, (x) => ({
        ...x,
        text: '',
        attachmentUrl: null,
        deletedAt: x.deletedAt ?? new Date().toISOString(),
        reactions: [],
        linkPreview: null,
      })),
    'message:reaction': (d: {
      messageId: string
      reactions: ReactionGroup[]
    }) => store.patch(d.messageId, (x) => ({ ...x, reactions: d.reactions })),
    'message:preview': (d: { messageId: string; linkPreview: LinkPreview }) =>
      store.patch(d.messageId, (x) => ({ ...x, linkPreview: d.linkPreview })),
    // Співрозмовник прочитав — ✓✓ одразу, без перепиту шапки.
    'message:read': (d: { readerId: string; lastReadAt: string }) => {
      if (d.readerId === me) return
      qc.setQueryData<{ chat: ChatDetails; currentUserId: string }>(
        ['chat', id],
        (old) =>
          old
            ? { ...old, chat: { ...old.chat, peerLastReadAt: d.lastReadAt } }
            : old,
      )
    },
    // «друкує…» — 3 с після останнього сигналу, як на сайті.
    'client-typing': (d: { userId: string }) => {
      if (d.userId === me) return
      setTyping(true)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setTyping(false), 3000)
    },
  })
  const lastTyping = useRef(0)

  // ─── Поле вводу ───
  const [text, setText] = useState(() => drafts.get(id) ?? '')
  const sel = useRef({ start: text.length, end: text.length })
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  // Поле їде за клавіатурою кадр у кадр — і вгору, і вниз, і коли її
  // зсувають пальцем: висота під полем береться з UI-потоку
  // (useAnimatedKeyboard), а не стрибком після події, як було з
  // KeyboardAvoidingView (донизу поле «падало»).
  const keyboard = useAnimatedKeyboard()
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null)
  const sent = useInputReset(inputRef)

  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null)
  const [viewer, setViewer] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const list = useRef<FlatList<ChatMessage>>(null)
  // Підтверджене сервером повідомлення лишається тим самим рядком, що й
  // тимчасове (той самий key): без перемонтування й повторної появи —
  // лише годинник плавно стає галочкою.
  const keyFor = useRef(new Map<string, string>())
  const [scrolledUp, setScrolledUp] = useState(false)

  // Годинник для «був(ла) 5 хв тому» — без запитів.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

  // ─── Що на екрані: своє, що ще йде, — найсвіжіше, унизу ───
  const items = useMemo(
    () => [...outgoing.map((o) => o.tmp), ...store.messages],
    [outgoing, store.messages],
  )
  const outgoingById = useMemo(
    () => new Map(outgoing.map((o) => [o.tmp.id, o])),
    [outgoing],
  )

  const peerRead = chat?.peerLastReadAt
    ? new Date(chat.peerLastReadAt).getTime()
    : 0
  const isRead = (m: ChatMessage) =>
    m.isRead || peerRead >= new Date(m.createdAt).getTime()

  // ─── Прочитано: щойно на екрані нове від співрозмовника ───
  const newestPeer = store.messages.find((m) => m.senderId !== me)
  const marked = useRef<string | null>(null)
  useEffect(() => {
    if (!focused || !me || !newestPeer) return
    if (marked.current === newestPeer.id) return
    marked.current = newestPeer.id
    // Лічильник у списку гасимо одразу; перепитувати список після запиту
    // не треба — він уже такий, як на сервері.
    markChatReadInList(qc, id)
    api(`/api/chats/${eid}/read`, { method: 'POST' }).catch(() => {
      marked.current = null
    })
  }, [focused, me, newestPeer, qc, id, eid])

  // «У мережі»: остання активність — свіже з presence і з його повідомлень.
  const lastSeen = [chat?.peerLastSeen, newestPeer?.createdAt]
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1)
  const status = typing
    ? 'друкує…'
    : chat
      ? presenceLabel(lastSeen ?? null, formatRelative, now)
      : ''
  const online = typing || status === 'у мережі'

  // ─── Надсилання ───
  const trimmed = text.trim()
  const canSend = editing
    ? trimmed.length > 0 && trimmed !== editing.text
    : trimmed.length > 0 || photo !== null

  function changeText(value: string) {
    // Клавіатура повернула щойно надісланий текст (lib/input-reset).
    if (sent.isEcho(value)) return
    setText(value)
    if (!editing) {
      if (value) drafts.set(id, value)
      else drafts.delete(id)
    }
    // «друкує…» співрозмовникові — не частіше, ніж раз на 2,5 с (як сайт).
    if (!editing && value && Date.now() - lastTyping.current > 2500) {
      lastTyping.current = Date.now()
      try {
        channel.current?.trigger('client-typing', {
          userId: me,
          userName: session?.user?.name ?? '',
        })
      } catch {
        // Канал ще не підписаний — нічого страшного.
      }
    }
  }

  async function deliver(out: Outgoing) {
    setOutgoing((o) =>
      o.map((x) => (x.tmp.id === out.tmp.id ? { ...x, state: 'sending' } : x)),
    )
    try {
      const attachment = out.asset ? await uploadChatPhoto(out.asset) : null
      const { message } = await api<{ message: ChatMessage }>(
        `/api/chats/${eid}/messages`,
        {
          method: 'POST',
          json: {
            type: out.tmp.type,
            text: out.tmp.text,
            attachment,
            replyToId: out.tmp.replyToId,
          },
        },
      )
      if (!keyFor.current.has(message.id)) {
        keyFor.current.set(message.id, out.tmp.id)
      }
      store.upsert(message)
      setOutgoing((o) => o.filter((x) => x.tmp.id !== out.tmp.id))
      // Своє — у список одразу (сервер шле chat:update лише співрозмовнику).
      applyChatUpdate(
        qc,
        {
          chatId: id,
          lastMessageText: previewText(message),
          lastMessageAt: message.createdAt,
          lastSenderId: message.senderId,
        },
        me,
      )
    } catch {
      setOutgoing((o) =>
        o.map((x) => (x.tmp.id === out.tmp.id ? { ...x, state: 'failed' } : x)),
      )
    }
  }

  function send() {
    if (editing) {
      void saveEdit()
      return
    }
    if (!trimmed && !photo) return
    const tmp: ChatMessage = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: photo ? 'PHOTO' : 'TEXT',
      text: trimmed,
      attachmentUrl: photo?.uri ?? null,
      attachmentMimeType: photo?.mimeType ?? null,
      attachmentSize: photo?.fileSize ?? null,
      attachmentName: photo?.fileName ?? null,
      isRead: false,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      senderId: me,
      replyToId: replyTo?.id ?? null,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            text: replyTo.text,
            senderId: replyTo.senderId,
            type: replyTo.type,
          }
        : null,
      reactions: [],
      linkPreview: null,
    }
    const out: Outgoing = { tmp, state: 'sending', asset: photo }
    setOutgoing((o) => [out, ...o])
    setText('')
    // Порожньо й у самому полі, навіть з «позначеним» словом клавіатури.
    sent.reset()
    drafts.delete(id)
    sel.current = { start: 0, end: 0 }
    setPhoto(null)
    setReplyTo(null)
    list.current?.scrollToOffset({ offset: 0, animated: true })
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    void deliver(out)
  }

  function failedPress(m: ChatMessage) {
    const out = outgoingById.get(m.id)
    if (!out) return
    showActionSheet('Повідомлення не надіслано', [
      { label: 'Надіслати ще раз', onPress: () => void deliver(out) },
      {
        label: 'Видалити',
        destructive: true,
        onPress: () => setOutgoing((o) => o.filter((x) => x.tmp.id !== m.id)),
      },
    ])
  }

  // ─── Правка ───
  function startEdit(m: ChatMessage) {
    setEditing(m)
    setReplyTo(null)
    setPhoto(null)
    setText(m.text)
    sel.current = { start: m.text.length, end: m.text.length }
    setEmojiOpen(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function cancelEdit() {
    setEditing(null)
    const draft = drafts.get(id) ?? ''
    setText(draft)
    sel.current = { start: draft.length, end: draft.length }
  }

  async function saveEdit() {
    const m = editing
    if (!m) return
    if (!trimmed || trimmed === m.text) {
      cancelEdit()
      return
    }
    const before = m
    store.patch(m.id, (x) => ({
      ...x,
      text: trimmed,
      editedAt: new Date().toISOString(),
    }))
    cancelEdit()
    try {
      const res = await api<{
        text: string
        editedAt: string
        linkPreview?: LinkPreview | null
      }>(`/api/chats/${eid}/messages/${encodeURIComponent(m.id)}`, {
        method: 'PATCH',
        json: { text: trimmed },
      })
      store.patch(m.id, (x) => ({
        ...x,
        text: res.text,
        editedAt: res.editedAt,
        linkPreview: res.linkPreview ?? null,
      }))
    } catch {
      store.patch(m.id, () => before)
      setToast('Не вдалося змінити повідомлення')
    }
  }

  // ─── Видалення ───
  async function remove(m: ChatMessage) {
    const ok = await confirmAction('Видалити повідомлення?', {
      confirm: 'Видалити',
      destructive: true,
      message: 'Воно зникне й у співрозмовника.',
    })
    if (!ok) return
    const before = m
    store.patch(m.id, (x) => ({
      ...x,
      text: '',
      attachmentUrl: null,
      deletedAt: new Date().toISOString(),
      reactions: [],
      linkPreview: null,
    }))
    try {
      await api(`/api/chats/${eid}/messages/${encodeURIComponent(m.id)}`, {
        method: 'DELETE',
      })
      void qc.invalidateQueries({ queryKey: ['chats'] })
    } catch {
      store.patch(m.id, () => before)
      setToast('Не вдалося видалити')
    }
  }

  // ─── Реакції ───
  async function react(m: ChatMessage, emoji: string) {
    const before: ReactionGroup[] = m.reactions ?? []
    const next = nextReaction(before, me, emoji)
    store.patch(m.id, (x) => ({
      ...x,
      reactions: applyReaction(x.reactions ?? [], me, next),
    }))
    if (Platform.OS !== 'web') void Haptics.selectionAsync()
    try {
      const res = await api<{ reactions: ReactionGroup[] }>(
        `/api/chats/${eid}/messages/${encodeURIComponent(m.id)}/reaction`,
        { method: 'PUT', json: { emoji: next } },
      )
      store.patch(m.id, (x) => ({ ...x, reactions: res.reactions }))
    } catch {
      store.patch(m.id, (x) => ({ ...x, reactions: before }))
      setToast('Не вдалося поставити реакцію')
    }
  }

  // ─── Меню повідомлення ───
  function openMenu(m: ChatMessage) {
    Keyboard.dismiss()
    setEmojiOpen(false)
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
    setMenuFor(m)
  }

  function menuActions(m: ChatMessage): MenuAction[] {
    const close = (fn: () => void) => () => {
      setMenuFor(null)
      fn()
    }
    const actions: MenuAction[] = [
      {
        label: 'Відповісти',
        icon: 'reply',
        onPress: close(() => {
          setEditing(null)
          setReplyTo(m)
          setTimeout(() => inputRef.current?.focus(), 50)
        }),
      },
    ]
    if (m.text) {
      actions.push({
        label: 'Копіювати',
        icon: 'copy',
        onPress: close(() => {
          void Clipboard.setStringAsync(m.text)
          setToast('Текст скопійовано')
        }),
      })
    }
    if (canEdit(m, me)) {
      actions.push({
        label: 'Змінити',
        icon: 'edit',
        onPress: close(() => startEdit(m)),
      })
    }
    if (m.senderId === me) {
      actions.push({
        label: 'Видалити',
        icon: 'trash',
        destructive: true,
        onPress: close(() => void remove(m)),
      })
    }
    return actions
  }

  // ─── Перехід до цитати ───
  function jumpTo(messageId: string) {
    const index = items.findIndex((m) => m.id === messageId)
    if (index < 0) {
      setToast('Повідомлення вище — догорніть розмову')
      return
    }
    list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true })
  }

  // ─── Емодзі ───
  // Панель і клавіатура міняються місцями без стрибка: панель лишається
  // під клавіатурою, поки та виїжджає (≈ 250 мс), і лише тоді зникає.
  const closingEmoji = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (closingEmoji.current) clearTimeout(closingEmoji.current)
    },
    [],
  )
  function closeEmojiSoon() {
    if (closingEmoji.current) clearTimeout(closingEmoji.current)
    closingEmoji.current = setTimeout(() => setEmojiOpen(false), 260)
  }

  /**
   * Дотик по розмові (повідомлення, порожнє місце, прокрутка) — панель
   * емодзі ховається, як ховалась би клавіатура (так попросив власник):
   * плавно їде вниз разом із полем.
   */
  function closeEmoji() {
    if (closingEmoji.current) clearTimeout(closingEmoji.current)
    setEmojiOpen(false)
  }

  function toggleEmoji() {
    if (emojiOpen) {
      inputRef.current?.focus()
      closeEmojiSoon()
    } else {
      if (closingEmoji.current) clearTimeout(closingEmoji.current)
      Keyboard.dismiss()
      setEmojiOpen(true)
    }
  }

  function insertEmoji(emoji: string) {
    const { start, end } = sel.current
    const next = text.slice(0, start) + emoji + text.slice(end)
    if (next.length > MAX_TEXT_LENGTH) return
    changeText(next)
    const at = start + emoji.length
    sel.current = { start: at, end: at }
  }

  async function attach() {
    const [asset] = await pickPhotos(1)
    if (asset) {
      setPhoto(asset)
      setEmojiOpen(false)
    }
  }

  const context: ComposerContext | null = editing
    ? { kind: 'edit', title: 'Редагування', text: messageSummary(editing) }
    : replyTo
      ? {
          kind: 'reply',
          title: `Відповідь: ${replyTo.senderId === me ? 'ви' : peerName}`,
          text: messageSummary(replyTo),
        }
      : null

  const headerBottom = insets.top + HEADER_BAR
  // Під полем: клавіатура, панель емодзі чи смужка «додому» — що вище.
  const floor = emojiOpen ? EMOJI_PANEL_HEIGHT + insets.bottom : insets.bottom
  // Панель виїжджає й ховається плавно (260 мс, без пружини). Лише коли
  // її відкривають замість клавіатури — одразу: клавіатура ще закриває
  // низ, і плавний підйом панелі дав би «провал» між ними.
  const floorY = useSharedValue(floor)
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    const instant =
      reduceMotion || (floor > floorY.get() && keyboard.height.get() > 0)
    floorY.set(
      instant
        ? floor
        : withTiming(floor, {
            duration: 260,
            easing: Easing.out(Easing.cubic),
          }),
    )
  }, [floor, floorY, keyboard, reduceMotion])
  const under = useAnimatedStyle(() => ({
    height: Math.max(keyboard.height.get(), floorY.get()),
  }))

  return (
    <View className="flex-1 bg-background">
      <ChatBackground />
      <Stack.Screen
        options={{
          // Шапка розмови — тверда, з чітким краєм (Backdrop), а не тане,
          // як на решті екранів: суцільний фон і лінія, як у поля внизу
          // (так попросив власник).
          headerBlurEffect: 'systemMaterial',
          // «Назад» — лише шеврон, без підкладки, і поруч непрочитані в
          // інших розмовах, як у Telegram (власник; chat-back).
          headerLeft: ({ canGoBack }) => (
            <ChatBack chatId={id} canGoBack={Boolean(canGoBack)} />
          ),
          // Поки чат вантажиться — імʼя й фото брусками (chat-skeleton).
          headerTitle: () =>
            !chat && details.isPending ? (
              <ChatTitleSkeleton />
            ) : (
              <ChatTitle
                name={chat ? peerName : ''}
                verified={Boolean(peer?.isVerified)}
                status={status}
                online={online}
              />
            ),
          headerRight: () =>
            peer ? (
              <Avatar uri={peer.avatar} name={peerName} size={36} />
            ) : details.isPending ? (
              <AvatarSkeleton />
            ) : null,
        }}
      />

      {/* Дотик будь-де в розмові ховає панель емодзі (closeEmoji). */}
      <View
        className="flex-1"
        onTouchStart={emojiOpen ? closeEmoji : undefined}
      >
        <FlatList
          ref={list}
          inverted
          data={items}
          keyExtractor={(m) => keyFor.current.get(m.id) ?? m.id}
          showsVerticalScrollIndicator={false}
          extraData={[peerRead, outgoingById, me, peerName]}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          // Перевернутий список: paddingBottom — це верх екрана (під шапкою).
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 8,
            paddingTop: 10,
            paddingBottom: headerBottom + 10,
          }}
          // Нове повідомлення внизу не зсуває те, що людина читає вище.
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 120,
          }}
          onEndReached={() => void store.loadOlder()}
          onEndReachedThreshold={0.4}
          onScroll={(e) => setScrolledUp(e.nativeEvent.contentOffset.y > 400)}
          scrollEventThrottle={64}
          onScrollToIndexFailed={(info) => {
            list.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            })
          }}
          renderItem={({ item: m, index }) => {
            const older = items[index + 1]
            const newer = items[index - 1]
            const showDate = !older || !sameDay(older.createdAt, m.createdAt)
            const gap = (a: ChatMessage, b: ChatMessage) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            const first =
              showDate ||
              !older ||
              older.senderId !== m.senderId ||
              gap(older, m) > GROUP_MS
            const last =
              !newer ||
              newer.senderId !== m.senderId ||
              !sameDay(newer.createdAt, m.createdAt) ||
              gap(m, newer) > GROUP_MS
            return (
              <View>
                {showDate ? <DateChip iso={m.createdAt} /> : null}
                <MessageBubble
                  m={m}
                  mine={m.senderId === me}
                  read={isRead(m)}
                  state={outgoingById.get(m.id)?.state ?? 'sent'}
                  first={first}
                  last={last}
                  peerName={peerName}
                  me={me}
                  onLongPress={openMenu}
                  onOpenPhoto={setViewer}
                  onQuote={jumpTo}
                  onReact={(msg, e) => void react(msg, e)}
                  onFailedPress={failedPress}
                />
              </View>
            )
          }}
          ListFooterComponent={
            store.loadingOlder ? (
              <ActivityIndicator className="py-3" color={c.mutedForeground} />
            ) : undefined
          }
          // Обгортка обовʼязкова: перевернутий список «розвертає» порожній
          // стан через його style, а свого style наші компоненти не беруть —
          // без неї підказка стояла б догори дриґом.
          ListEmptyComponent={
            <View className="flex-1">
              {store.pending ? (
                <MessagesSkeleton />
              ) : store.error ? (
                // Тут середина — область повідомлень, а не екран.
                <EmptyStateInset value={null}>
                  <EmptyState
                    icon="warning"
                    title="Не вдалося завантажити"
                    text={errorText(store.error)}
                    action={{
                      label: 'Спробувати ще',
                      onPress: () => void store.refetch(),
                    }}
                  />
                </EmptyStateInset>
              ) : (
                <QuietStart name={chat ? peerName : ''} />
              )}
            </View>
          }
        />

        {scrolledUp ? (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(120)}
            className="absolute bottom-3 right-3"
          >
            <Pressable
              onPress={() =>
                list.current?.scrollToOffset({ offset: 0, animated: true })
              }
              accessibilityRole="button"
              accessibilityLabel="До останніх повідомлень"
              className="size-11 items-center justify-center rounded-full bg-card active:opacity-70"
              style={{ boxShadow: '0 4px 14px rgba(0, 0, 0, 0.16)' }}
            >
              <Glyph
                name="toBottom"
                size={18}
                color={c.foreground}
                weight="semibold"
              />
            </Pressable>
          </Animated.View>
        ) : null}
      </View>

      <ChatComposer
        inputRef={inputRef}
        value={text}
        onChange={changeText}
        onSelectionChange={(s) => {
          sel.current = s
        }}
        onSend={send}
        canSend={canSend}
        context={context}
        onCancelContext={() => (editing ? cancelEdit() : setReplyTo(null))}
        photoUri={photo?.uri ?? null}
        onRemovePhoto={() => setPhoto(null)}
        onAttach={() => void attach()}
        emojiOpen={emojiOpen}
        onToggleEmoji={toggleEmoji}
        onFocus={() => {
          if (emojiOpen) closeEmojiSoon()
        }}
      />
      {/* Місце під полем — висота клавіатури (анімовано) чи панелі емодзі. */}
      <Animated.View style={under} className="bg-background">
        {emojiOpen ? (
          // Ховається разом із місцем під полем — їде вниз і гасне.
          <Animated.View
            exiting={FadeOut.duration(220)}
            className="absolute inset-x-0 top-0"
          >
            <EmojiPanel onPick={insertEmoji} />
          </Animated.View>
        ) : null}
      </Animated.View>

      <MessageMenu
        message={menuFor}
        mine={menuFor?.senderId === me}
        me={me}
        actions={menuFor ? menuActions(menuFor) : []}
        onReact={(e) => {
          const m = menuFor
          setMenuFor(null)
          if (m) void react(m, e)
        }}
        onClose={() => setMenuFor(null)}
      />

      {viewer ? (
        <PhotoViewer
          urls={[viewer]}
          start={0}
          onClose={() => setViewer(null)}
        />
      ) : null}

      {toast ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          pointerEvents="none"
          className="absolute inset-x-0 items-center"
          style={{ top: headerBottom + 10 }}
        >
          <View className="rounded-full bg-foreground px-4 py-2">
            <Text className="text-[14px] font-medium text-background">
              {toast}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  )
}

/** Шапка розмови: імʼя (з галочкою перевіреного) і «у мережі» під ним. */
function ChatTitle({
  name,
  verified,
  status,
  online,
}: {
  name: string
  verified: boolean
  status: string
  online: boolean
}) {
  const c = useColors()
  return (
    <View className="items-center">
      <View className="max-w-full flex-row items-center gap-1">
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          className="shrink text-[17px] font-semibold text-foreground"
        >
          {name}
        </Text>
        {verified ? (
          <Glyph name="verified" size={14} color={c.primary} />
        ) : null}
      </View>
      {status ? (
        <Text
          numberOfLines={1}
          className={`text-[13.5px] ${online ? 'text-primary' : 'text-muted-foreground'}`}
        >
          {status}
        </Text>
      ) : null}
    </View>
  )
}

/** Плашка дня між повідомленнями: «Сьогодні», «Учора», «5 листопада». */
function DateChip({ iso }: { iso: string }) {
  const service = useService()
  return (
    <View className="items-center pb-1 pt-3">
      <View
        className="rounded-full px-3 py-1"
        style={{ backgroundColor: service.bg }}
      >
        <Text
          className="text-[13px] font-semibold"
          style={{ color: service.fg }}
        >
          {notificationDay(iso)}
        </Text>
      </View>
    </View>
  )
}

/**
 * Плашки поверх шпалер (день, порожня розмова) — як `--chat-service` на
 * сайті: напівпрозоре темне тло й світлий текст, читається на будь-якому
 * місці узору.
 */
function useService() {
  const dark = useColorScheme() === 'dark'
  return dark
    ? { bg: 'rgba(144, 147, 152, 0.32)', fg: '#dbdee3' }
    : { bg: 'rgba(0, 0, 0, 0.22)', fg: '#ffffff' }
}

/** Порожня розмова — підказка, з чого почати. */
function QuietStart({ name }: { name: string }) {
  const service = useService()
  return (
    <View className="flex-1 items-center justify-center px-10">
      <View
        className="items-center gap-1.5 rounded-[22px] px-6 py-5"
        style={{ backgroundColor: service.bg, borderCurve: 'continuous' }}
      >
        <Text className="text-[38px]">👋</Text>
        <Text
          className="text-center text-[17px] font-semibold"
          style={{ color: service.fg }}
        >
          Тут поки тихо
        </Text>
        <Text
          className="text-center text-[14.5px] leading-[20px]"
          style={{ color: service.fg, opacity: 0.85 }}
        >
          {name
            ? `Напишіть ${name}: домовтеся про час, адресу й деталі прибирання.`
            : 'Домовтеся про час, адресу й деталі прибирання.'}
        </Text>
      </View>
    </View>
  )
}
