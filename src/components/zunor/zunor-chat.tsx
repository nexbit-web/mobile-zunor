import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { Image } from 'expo-image'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutDown,
} from 'react-native-reanimated'
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'

import { MenuButton } from '@/components/drawer/menu-button'
import { HeaderBell } from '@/components/header-bell'
import { Glyph } from '@/components/icons/glyph'
import { ServiceBadge } from '@/components/icons/service-icon'
import { Button } from '@/components/ui/button'
import { SQUIRCLE, Tile, TINT } from '@/components/ui/tile'
import { api, ApiError, errorText } from '@/lib/api'
import { useColors } from '@/lib/theme'
import {
  MAX_PHOTOS,
  pickPhotos,
  uploadJobPhoto,
  UploadError,
  type Photo,
} from '@/lib/upload'
import { askZunor } from '@/lib/zunor'
import {
  visibleText,
  type ZunorClientMessage,
  type ZunorDraft,
} from '@/shared/zunor'

import { ChatMenu } from './chat-menu'
import { Composer } from './composer'
import { DraftCard } from './draft-card'
import { MessageText } from './message-text'
import { Thinking } from './thinking'
import { ZunorBlinkMark } from './zunor-mark-blink'

type Msg =
  | { id: number; role: 'user'; text: string; images?: string[] }
  /** thinkSeconds — скільки модель думала до першого слова (0 — не показуємо). */
  | { id: number; role: 'zunor'; text: string; thinkSeconds: number }
  /** Збій чи «Стоп» — не репліка Zunor, у історію для моделі не йде. */
  | { id: number; role: 'notice'; text: string; retry: boolean }
  | { id: number; role: 'draft'; draft: ZunorDraft }

/**
 * Перші слова розмови — послуги сайту (web/src/lib/categories/cleaning/
 * presets.ts, SERVICES). Кожна — з іконкою послуги сайту (ServiceBadge),
 * тією самою, що на картках заявок і замовлень.
 */
const SUGGESTIONS: { service: string; lead: string; rest: string }[] = [
  { service: 'standard', lead: 'Звичайне', rest: 'прибирання' },
  { service: 'deep', lead: 'Генеральне', rest: 'прибирання' },
  { service: 'windows', lead: 'Помити', rest: 'вікна' },
  { service: 'post-renovation', lead: 'Прибрати', rest: 'після ремонту' },
  { service: 'sofa', lead: 'Хімчистка', rest: 'дивана' },
  { service: 'regular', lead: 'Регулярне', rest: 'прибирання' },
]

const EDIT_PROMPT = 'Добре! Напишіть, що змінити, — я оновлю заявку.'

/** Ближче до низу, ніж на стільки, — вважаємо, що людина внизу розмови. */
const NEAR_BOTTOM = 120

/**
 * Кнопка «Додати фото» від Zunor приходить мовою розмови, тож — за
 * змістом (копія isAddPhotoChip зі сторінки сайту). «без» / «without» —
 * це «Продовжити без фото».
 */
function isAddPhotoChip(label: string): boolean {
  const s = label.toLowerCase()
  const photo = s.includes('фото') || s.includes('photo')
  return photo && !s.includes('без') && !s.includes('without')
}

/**
 * Історія для API: репліки людини й Zunor, без карток і приміток. Про
 * фото модель дізнається з позначки (як на сайті) — самі фото їй не йдуть.
 */
function historyOf(list: Msg[]): ZunorClientMessage[] {
  return list.flatMap((m): ZunorClientMessage[] => {
    if (m.role === 'user') {
      const suffix = m.images?.length
        ? `\n[attachment: ${m.images.length} photo]`
        : ''
      return [{ role: 'user', content: (m.text + suffix).trim() }]
    }
    if (m.role === 'zunor' && m.text.trim())
      return [{ role: 'assistant', content: m.text.trim() }]
    return []
  })
}

/** Уся розмова текстом — як «Скопіювати розмову» на сайті. */
function dialogText(list: Msg[]): string {
  return list
    .flatMap((m): string[] => {
      if (m.role === 'user') return m.text ? [`Я: ${m.text}`] : []
      if (m.role === 'zunor')
        return m.text ? [`Zunor: ${m.text.replaceAll('**', '')}`] : []
      if (m.role === 'draft') {
        const { title, description } = m.draft
        return [`Заявка: ${title}${description ? `\n${description}` : ''}`]
      }
      return []
    })
    .join('\n\n')
}

/**
 * Головний екран клієнта — розмова з Zunor, як у застосунках ІІ: увесь
 * екран — чат, розділи в бічній панелі (кнопка зліва вгорі), дії з
 * розмовою — у меню праворуч. Людина описує прибирання (і додає фото),
 * Zunor уточнює й складає заявку, а створює її система після
 * підтвердження. Майстра Zunor шукає сам — без каталогу й вибору
 * конкретного майстра (MANIFESTO).
 *
 * Поки не зроблено: голосовий ввід (у Expo Go немає модуля розпізнавання
 * мови) і збереження розмови між запусками.
 */
export function ZunorChat() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  // Бічна панель «Нова розмова» відкриває цей екран із новим `fresh`.
  const { fresh } = useLocalSearchParams<{ fresh?: string }>()

  const [messages, setMessages] = useState<Msg[]>([])
  const [chips, setChips] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  /** Запит пішов, а тексту ще немає — «Думаю…». */
  const [waiting, setWaiting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [duplicate, setDuplicate] = useState<{
    draft: ZunorDraft
    title: string
  } | null>(null)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  /** Фото до наступної репліки і вже надіслані (підуть у заявку). */
  const [pendingPhotos, setPendingPhotos] = useState<Photo[]>([])
  const [sentPhotos, setSentPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(0)
  const [uploadError, setUploadError] = useState('')

  /** Людина внизу розмови: тоді нові рядки підтягують прокрутку за собою. */
  const [atBottom, setAtBottom] = useState(true)
  const atBottomRef = useRef(true)

  const nextId = useRef(0)
  const turn = useRef<AbortController | null>(null)
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null)
  const frame = useRef<ComponentRef<typeof View>>(null)
  const [frameTop, setFrameTop] = useState(0)
  const keyboardShown = useKeyboardShown()

  // Розмову покинули — відповідь, яку ніхто не прочитає, не оплачуємо.
  useEffect(() => () => turn.current?.abort(), [])

  useEffect(() => {
    if (fresh) newChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(id)
  }, [toast])

  const started = messages.length > 0
  const canSend =
    (input.trim().length > 0 || pendingPhotos.length > 0) &&
    uploading === 0 &&
    !creating

  function addNotice(text: string, retry: boolean) {
    setMessages((m) => [
      ...m,
      { id: nextId.current++, role: 'notice', text, retry },
    ])
  }

  function scrollToEnd(animated = true) {
    atBottomRef.current = true
    setAtBottom(true)
    scroll.current?.scrollToEnd({ animated })
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const near =
      contentSize.height - (contentOffset.y + layoutMeasurement.height) <
      NEAR_BOTTOM
    atBottomRef.current = near
    if (near !== atBottom) setAtBottom(near)
  }

  async function addPhotos() {
    setUploadError('')
    const free =
      MAX_PHOTOS - sentPhotos.length - pendingPhotos.length - uploading
    if (free <= 0) {
      setUploadError(`Можна додати до ${MAX_PHOTOS} фото`)
      return
    }
    let assets: Awaited<ReturnType<typeof pickPhotos>>
    try {
      assets = await pickPhotos(free)
    } catch {
      setUploadError('Не вдалося відкрити фото. Дозвольте доступ у налаштуваннях телефона.')
      return
    }
    // Усі обрані одразу стають «вантажиться» — видно, скільки їх буде.
    // Вантажимо по одному, щоб фото стали в порядку вибору.
    setUploading((n) => n + assets.length)
    for (const asset of assets) {
      try {
        const photo = await uploadJobPhoto(asset)
        setPendingPhotos((p) => [...p, photo])
      } catch (err) {
        console.warn('[zunor-chat] photo upload failed', err)
        setUploadError(
          err instanceof UploadError || err instanceof ApiError
            ? err.message
            : 'Не вдалося завантажити фото',
        )
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  async function ask(history: ZunorClientMessage[]) {
    const ctrl = new AbortController()
    turn.current = ctrl
    setStreaming(true)
    setWaiting(true)

    const startedAt = Date.now()
    const zunorId = nextId.current++
    let raw = ''
    let bubble = false
    // Розмову скинули «Новою розмовою» — старому ходу писати нікуди.
    const discarded = () => turn.current !== ctrl
    const thought = () =>
      Math.max(1, Math.round((Date.now() - startedAt) / 1000))

    const onText = (delta: string) => {
      if (discarded()) return
      raw += delta
      const text = visibleText(raw)
      if (!bubble) {
        bubble = true
        setWaiting(false)
        const thinkSeconds = thought()
        setMessages((m) => [
          ...m,
          { id: zunorId, role: 'zunor', text, thinkSeconds },
        ])
      } else {
        setMessages((m) =>
          m.map((x) => (x.id === zunorId ? { ...x, text } : x)),
        )
      }
    }

    try {
      const final = await askZunor(history, onText, ctrl.signal)
      if (discarded()) return
      if (!final) {
        if (!bubble) addNotice('Щось пішло не так. Спробуйте ще раз.', true)
        return
      }
      // Фінал — чистий текст без службового рядка кнопок.
      if (bubble) {
        setMessages((m) =>
          m.map((x) =>
            x.id === zunorId && x.role === 'zunor'
              ? { ...x, text: final.reply || x.text }
              : x,
          ),
        )
      } else if (final.reply) {
        const thinkSeconds = thought()
        setMessages((m) => [
          ...m,
          { id: zunorId, role: 'zunor', text: final.reply, thinkSeconds },
        ])
      }
      if (final.kind === 'message') {
        setChips(final.suggestions ?? [])
      } else {
        setDuplicate(null)
        setMessages((m) => [
          ...m.filter((x) => x.role !== 'draft'),
          { id: nextId.current++, role: 'draft', draft: final.draft },
        ])
      }
    } catch (err) {
      if (discarded()) return
      if (ctrl.signal.aborted) {
        // «Стоп»: надруковане лишається, як на сайті.
        if (!bubble) addNotice('Відповідь зупинено', true)
        return
      }
      setMessages((m) => m.filter((x) => x.id !== zunorId))
      addNotice(
        err instanceof ApiError
          ? errorText(err)
          : "Помилка з'єднання. Перевірте інтернет і спробуйте ще раз.",
        true,
      )
    } finally {
      if (!discarded()) {
        turn.current = null
        setStreaming(false)
        setWaiting(false)
      }
    }
  }

  function send(text: string) {
    const clean = text.trim()
    const photos = pendingPhotos
    if ((!clean && !photos.length) || streaming || creating || uploading)
      return
    const next: Msg[] = [
      ...messages,
      {
        id: nextId.current++,
        role: 'user',
        text: clean,
        images: photos.length ? photos.map((p) => p.url) : undefined,
      },
    ]
    setMessages(next)
    setSentPhotos((s) => [...s, ...photos])
    setPendingPhotos([])
    setUploadError('')
    setChips([])
    setInput('')
    // Своя репліка — завжди внизу, навіть якщо людина гортала вгору.
    atBottomRef.current = true
    setAtBottom(true)
    void ask(historyOf(next))
  }

  function pickChip(label: string) {
    if (isAddPhotoChip(label)) void addPhotos()
    else send(label)
  }

  function retry() {
    if (streaming) return
    const next = messages.filter((m) => m.role !== 'notice')
    setMessages(next)
    void ask(historyOf(next))
  }

  function stop() {
    turn.current?.abort()
  }

  function newChat() {
    const t = turn.current
    turn.current = null
    t?.abort()
    setMessages([])
    setChips([])
    setInput('')
    setStreaming(false)
    setWaiting(false)
    setDuplicate(null)
    setCreatedJobId(null)
    setPendingPhotos([])
    setSentPhotos([])
    setUploadError('')
    atBottomRef.current = true
    setAtBottom(true)
  }

  async function copyDialog() {
    await Clipboard.setStringAsync(dialogText(messages))
    setToast('Розмову скопійовано')
  }

  // «Змінити» на картці: підказка Zunor (піде моделі в історії як його
  // репліка — вона бачитиме контекст) і фокус у поле.
  function requestEdit() {
    setMessages((m) => [
      ...m,
      {
        id: nextId.current++,
        role: 'zunor',
        text: EDIT_PROMPT,
        // Репліка локальна, моделі тут не було: «Думав 1 с» — неправда.
        thinkSeconds: 0,
      },
    ])
    inputRef.current?.focus()
  }

  async function createJob(draft: ZunorDraft) {
    if (creating) return
    setCreating(true)
    try {
      const res = await api<{ job: { id: string } }>('/api/jobs', {
        method: 'POST',
        json: {
          metadata: draft.metadata,
          title: draft.title,
          description: draft.description,
          attachments: sentPhotos.map((p) => p.url),
          attachmentsPublicIds: sentPhotos.map((p) => p.publicId),
          // Попередження про схожу заявку на цьому драфті вже бачили.
          allowDuplicate: duplicate?.draft === draft ? true : undefined,
        },
      })
      setCreatedJobId(res.job.id)
      void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    } catch (err) {
      const body = err instanceof ApiError ? err.body : null
      const dup = (body as { duplicate?: { title?: string } } | null)
        ?.duplicate
      if (err instanceof ApiError && err.status === 409 && dup) {
        setDuplicate({ draft, title: dup.title ?? 'Заявка' })
        return
      }
      addNotice(errorText(err), false)
    } finally {
      setCreating(false)
    }
  }

  // Своя верхня смуга замість системної шапки: кругла кнопка меню зліва,
  // дії з розмовою праворуч (як шапка чату на сайті).
  const topBar = (
    <View style={{ paddingTop: insets.top }} className="bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="h-[52px] flex-row items-center justify-between px-1.5">
        <MenuButton />
        <View className="flex-row items-center">
          <HeaderBell />
          <ChatMenu
            started={started || Boolean(createdJobId)}
            onReset={newChat}
            onCopy={() => void copyDialog()}
          />
        </View>
      </View>
      {toast ? (
        <Animated.View
          entering={FadeInUp.duration(160)}
          exiting={FadeOut.duration(160)}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            alignItems: 'center',
            top: insets.top + 62,
          }}
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

  if (createdJobId) {
    return (
      <View className="flex-1 bg-background">
        {topBar}
        <View className="flex-1 items-center justify-center gap-4 px-8 pb-16">
          <Tile icon="check" tint={TINT.green} size={68} />
          <Text className="text-center text-[26px] font-bold tracking-tight text-foreground">
            Готово!
          </Text>
          <Text className="text-center text-[16px] leading-[22px] text-muted-foreground">
            Заявку опубліковано — шукаю вам клінера поруч. Пропозиції
            зʼявляться в «Замовленнях».
          </Text>
          <View className="mt-3 w-full gap-2">
            <Button
              onPress={() =>
                router.push({
                  pathname: '/job/[id]',
                  params: { id: createdJobId },
                })
              }
            >
              Відкрити заявку
            </Button>
            <Button variant="secondary" onPress={newChat}>
              Нова розмова
            </Button>
          </View>
        </View>
      </View>
    )
  }

  const zunorChips = chips.length > 0 && !streaming

  return (
    <View className="flex-1 bg-background">
      {topBar}
      <View
        ref={frame}
        // Відступ над клавіатурою рахується від верху вікна — міряємо, де
        // починається ця частина екрана.
        onLayout={() =>
          frame.current?.measureInWindow((_x, y) => setFrameTop(y))
        }
        className="flex-1"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={frameTop}
          className="flex-1"
        >
          {started ? (
            <View className="flex-1">
              <ScrollView
                ref={scroll}
                onScroll={onScroll}
                scrollEventThrottle={32}
                onContentSizeChange={() => {
                  // Нові рядки тягнуть прокрутку, лише якщо людина внизу:
                  // інакше відповідь, що друкується, смикала б її, поки
                  // вона читає вище.
                  if (atBottomRef.current)
                    scroll.current?.scrollToEnd({ animated: true })
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentContainerClassName="gap-5 px-5 pb-4 pt-2"
              >
                {messages.map((m) => {
                  switch (m.role) {
                    case 'user':
                      return (
                        <View
                          key={m.id}
                          className="max-w-[85%] gap-1.5 self-end"
                        >
                          {m.images?.length ? (
                            <View className="flex-row flex-wrap justify-end gap-1.5">
                              {m.images.map((url) => (
                                <Image
                                  key={url}
                                  source={url}
                                  contentFit="cover"
                                  style={{
                                    width: 96,
                                    height: 96,
                                    borderRadius: 18,
                                    borderCurve: 'continuous',
                                  }}
                                />
                              ))}
                            </View>
                          ) : null}
                          {m.text ? (
                            <View
                              className="self-end rounded-[22px] bg-secondary px-4 py-2.5"
                              style={SQUIRCLE}
                            >
                              <Text className="text-[16px] leading-[22px] text-foreground">
                                {m.text}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      )
                    case 'zunor':
                      return (
                        <View key={m.id} className="gap-1.5">
                          {m.thinkSeconds > 0 ? (
                            <Text className="text-[13px] text-muted-foreground">
                              Думав {m.thinkSeconds} с
                            </Text>
                          ) : null}
                          <MessageText text={m.text} />
                        </View>
                      )
                    case 'notice':
                      return (
                        <View key={m.id} className="items-center gap-1 py-1">
                          <Text className="text-center text-[14px] text-muted-foreground">
                            {m.text}
                          </Text>
                          {m.retry && !streaming ? (
                            <Pressable onPress={retry} hitSlop={8}>
                              <Text className="text-[14px] font-semibold text-primary">
                                Спробувати ще
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      )
                    case 'draft':
                      return (
                        <DraftCard
                          key={m.id}
                          draft={m.draft}
                          photos={sentPhotos.map((p) => p.url)}
                          creating={creating}
                          duplicateTitle={
                            duplicate?.draft === m.draft
                              ? duplicate.title
                              : null
                          }
                          onCreate={() => createJob(m.draft)}
                          onEdit={requestEdit}
                        />
                      )
                  }
                })}

                {waiting ? <Thinking /> : null}
              </ScrollView>

              {/* «Донизу» — виїжджає з-під поля, коли людина відгорнула
                  розмову вгору. */}
              {!atBottom ? (
                <Animated.View
                  entering={FadeInDown.duration(180)}
                  exiting={FadeOutDown.duration(140)}
                  style={{ position: 'absolute', bottom: 12, alignSelf: 'center' }}
                >
                  <Pressable
                    onPress={() => scrollToEnd()}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="До кінця розмови"
                    className="size-10 items-center justify-center rounded-full bg-shell active:opacity-70"
                    style={{ boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)' }}
                  >
                    <Glyph
                      name="down"
                      size={16}
                      color={c.foreground}
                      weight="semibold"
                    />
                  </Pressable>
                </Animated.View>
              ) : null}
            </View>
          ) : (
            // Порожня розмова: лише знак по центру — як у застосунках ІІ.
            <Pressable
              onPress={Keyboard.dismiss}
              accessible={false}
              className="flex-1 items-center justify-center gap-3 pb-6"
            >
              {/* Знак кліпає, як на сайті; і він, і назва — кольору
                  тексту: чорні у світлій темі, білі в темній. */}
              <ZunorBlinkMark size={48} />
              <Text className="text-[40px] font-semibold tracking-tight text-foreground">
                Zunor
              </Text>
            </Pressable>
          )}

          {!started ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              className="grow-0"
              contentContainerClassName="gap-2.5 px-4 pb-3"
            >
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s.lead + s.rest}
                  onPress={() => send(`${s.lead} ${s.rest}`)}
                  accessibilityRole="button"
                  className="w-[150px] gap-3 rounded-[22px] bg-shell p-3.5 active:opacity-70"
                  style={SQUIRCLE}
                >
                  <ServiceBadge service={s.service} size={36} />
                  <Text
                    numberOfLines={2}
                    className="text-[15px] leading-[20px] text-muted-foreground"
                  >
                    <Text className="font-semibold text-foreground">
                      {s.lead}
                    </Text>{' '}
                    {s.rest}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <SafeAreaView
            // Над смужкою «додому»; з клавіатурою відступ дав би порожню
            // смугу між нею й полем.
            edges={keyboardShown ? [] : ['bottom']}
            style={{ backgroundColor: c.background }}
          >
            <View className="gap-2 pb-2 pt-1">
              {uploadError ? (
                <Text className="px-5 text-[13px] text-destructive">
                  {uploadError}
                </Text>
              ) : null}
              <View className="px-3">
                <Composer
                  inputRef={inputRef}
                  value={input}
                  onChange={setInput}
                  onSend={() => send(input)}
                  onStop={stop}
                  streaming={streaming}
                  canSend={canSend}
                  placeholder={
                    started ? 'Напишіть Zunor…' : 'Що потрібно прибрати?'
                  }
                  photos={pendingPhotos}
                  uploading={uploading}
                  onAddPhoto={() => void addPhotos()}
                  onRemovePhoto={(i) =>
                    setPendingPhotos((p) => p.filter((_, idx) => idx !== i))
                  }
                />
              </View>

              {/* Кнопки-відповіді Zunor — ПІД полем, як на сайті. */}
              {zunorChips ? (
                <Animated.View entering={FadeInUp.duration(180)}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerClassName="gap-2 px-3"
                  >
                    {chips.map((chip) => (
                      <Pressable
                        key={chip}
                        onPress={() => pickChip(chip)}
                        accessibilityRole="button"
                        className="flex-row items-center gap-1.5 rounded-full bg-shell px-4 py-2.5 active:opacity-70"
                      >
                        {isAddPhotoChip(chip) ? (
                          <Glyph
                            name="photo"
                            size={16}
                            color={c.foreground}
                            weight="medium"
                          />
                        ) : null}
                        <Text className="text-[15px] font-medium text-foreground">
                          {chip}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </Animated.View>
              ) : null}
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </View>
  )
}

function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const ios = Platform.OS === 'ios'
    const show = Keyboard.addListener(
      ios ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setShown(true),
    )
    const hide = Keyboard.addListener(
      ios ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setShown(false),
    )
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return shown
}
