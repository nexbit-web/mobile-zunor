import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'

import { GoogleTile } from '@/components/icons/brand-tiles'
import { Glyph } from '@/components/icons/glyph'
import { CatScene } from '@/components/mascot/cat-scene'
import { queryClient } from '@/components/providers'
import {
  ActionRow,
  FieldRow,
  Footnote,
  QueryGate,
  Row,
  Section,
  SettingsScroll,
  TINT,
} from '@/components/settings/list'
import { Button } from '@/components/ui/button'
import { GlowButton } from '@/components/ui/glow-button'
import { api, errorText } from '@/lib/api'
import { authClient } from '@/lib/auth'
import { forgetPush } from '@/lib/push'
import { useColors } from '@/lib/theme'
import type { SecurityData } from '@/shared/settings'

const MIN_LEN = 8

/**
 * Безпека — як розділ на сайті: зміна пароля (або перший пароль для
 * акаунта з Google), способи входу й видалення акаунта.
 */
export default function SecuritySettings() {
  const query = useQuery({
    queryKey: ['me', 'security'],
    queryFn: () => api<SecurityData>('/api/me/security'),
  })
  return (
    <QueryGate
      query={query}
      // Зміна пароля (3 поля й кнопка), способи входу, видалення акаунта.
      skeleton={[
        { rows: 3, tiles: false },
        'button',
        { rows: 3 },
        { rows: 1, title: false },
      ]}
    >
      {(data) => (
        <SettingsScroll>
          {/* Угорі — кіт-грабіжник, що не може відімкнути замок (власник). */}
          <CatScene scene="lock" />

          {data.hasPassword ? (
            <PasswordForm />
          ) : (
            <SetPassword email={data.email} />
          )}

          <Section title="Способи входу">
            <Row
              icon="mail"
              tint={TINT.blue}
              label="Пошта"
              value={data.email}
            />
            <Row
              icon="key"
              tint={TINT.gray}
              label="Пароль"
              value={data.hasPassword ? 'Увімкнено' : 'Не налаштовано'}
            />
            <Row
              leading={<GoogleTile />}
              label="Google"
              value={data.hasGoogle ? 'Привʼязано' : 'Не привʼязано'}
            />
          </Section>

          <DeleteAccount email={data.email} activeOrders={data.activeOrders} />
        </SettingsScroll>
      )}
    </QueryGate>
  )
}

function PasswordForm() {
  const c = useColors()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  const lengthOk = next.length >= MIN_LEN
  const differs = next.length > 0 && next !== current
  const matches = confirm.length > 0 && confirm === next
  const valid = current.length > 0 && lengthOk && differs && matches

  // Підказка — з першого символу нового пароля: лише тоді є що
  // перевіряти, а не «помилка» під порожнім полем.
  const hint = serverError
    ? serverError
    : next.length > 0 && !lengthOk
      ? `Мінімум ${MIN_LEN} символів`
      : next.length > 0 && !differs
        ? 'Новий пароль збігається зі старим'
        : confirm.length > 0 && !matches
          ? 'Паролі не збігаються'
          : ''

  async function submit() {
    if (saving || !valid) return
    setSaving(true)
    setServerError('')
    try {
      // revokeOtherSessions: зміна пароля зазвичай означає, що доступ міг
      // витекти — інші пристрої треба вигнати. Цей лишається.
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      })
      if (error) {
        // 400 тут — майже завжди невірний поточний пароль.
        setServerError(
          error.status === 400
            ? 'Поточний пароль невірний'
            : error.status === 429
              ? 'Забагато спроб. Спробуйте пізніше.'
              : 'Не вдалося змінити пароль',
        )
        return
      }
      setCurrent('')
      setNext('')
      setConfirm('')
      Alert.alert('Пароль змінено', 'Інші пристрої відключено.')
    } catch {
      setServerError('Немає зʼєднання. Перевірте інтернет.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="gap-3">
      <Section
        title="Змінити пароль"
        inset="text"
        footer={
          hint ? (
            <Footnote tone="error">{hint}</Footnote>
          ) : (
            `Мінімум ${MIN_LEN} символів. Інші пристрої буде відключено.`
          )
        }
      >
        <FieldRow
          value={current}
          onChangeText={(t) => {
            setCurrent(t)
            setServerError('')
          }}
          placeholder="Поточний пароль"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
        />
        <FieldRow
          value={next}
          onChangeText={setNext}
          placeholder="Новий пароль"
          secureTextEntry={!show}
          autoComplete="new-password"
          textContentType="newPassword"
          right={
            <Pressable
              onPress={() => setShow((v) => !v)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={show ? 'Сховати пароль' : 'Показати пароль'}
            >
              <Glyph
                name={show ? 'eyeOff' : 'eye'}
                size={18}
                color={c.mutedForeground}
              />
            </Pressable>
          }
        />
        <FieldRow
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Повторіть новий пароль"
          secureTextEntry={!show}
          autoComplete="new-password"
          textContentType="newPassword"
          right={
            matches ? (
              <Glyph name="check" size={16} color="#34c759" weight="bold" />
            ) : null
          }
        />
      </Section>
      {/* Головна дія екрана — «світна» капсула, як «Подати пропозицію». */}
      <GlowButton
        label="Змінити пароль"
        onPress={submit}
        disabled={!valid}
        loading={saving}
      />
    </View>
  )
}

/**
 * Акаунт із Google — пароля немає, і changePassword тут не спрацює (він
 * перевіряє поточний). Перший пароль задається листом зі скиданням, як
 * на сайті.
 */
function SetPassword({ email }: { email: string }) {
  const [sending, setSending] = useState(false)

  async function send() {
    if (sending) return
    setSending(true)
    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: '/user/reset-password',
      })
      if (error) Alert.alert('Не вдалося надіслати лист')
      else Alert.alert('Лист надіслано', `Перевірте пошту ${email}.`)
    } catch {
      Alert.alert('Немає зʼєднання', 'Перевірте інтернет.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Section
      title="Пароль"
      inset="text"
      footer={`Щоб входити й поштою — надішлемо посилання на ${email}.`}
    >
      <Row label="Пароль не встановлено" />
      <ActionRow
        label="Задати пароль"
        align="left"
        loading={sending}
        onPress={send}
      />
    </Section>
  )
}

function DeleteAccount({
  email,
  activeOrders,
}: {
  email: string
  activeOrders: number
}) {
  const [open, setOpen] = useState(false)
  const blocked = activeOrders > 0

  return (
    <>
      <Section
        title="Видалення акаунта"
        footer={
          blocked
            ? 'Спершу завершіть або скасуйте активні замовлення — на вас розраховують.'
            : 'Профіль і дані буде стерто назавжди.'
        }
      >
        {blocked ? (
          <Row
            icon="box"
            tint={TINT.orange}
            label="Активні замовлення"
            value={String(activeOrders)}
            onPress={() => router.navigate('/orders')}
          />
        ) : null}
        <ActionRow
          label="Видалити акаунт"
          tone="destructive"
          disabled={blocked}
          onPress={() => setOpen(true)}
        />
      </Section>
      <DeleteDialog email={email} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/**
 * Підтвердження — своя пошта, введена руками (як назва репозиторію в
 * GitHub): дія незворотна, і один випадковий дотик її не запускає.
 * Пароль не питаємо — у Google-акаунтів його немає.
 */
function DeleteDialog({
  email,
  open,
  onClose,
}: {
  email: string
  open: boolean
  onClose: () => void
}) {
  const c = useColors()
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase()

  // Поки запит іде, діалог не закривається: інакше людина не побачила б,
  // чим він скінчився.
  const close = () => {
    if (deleting) return
    setTyped('')
    setError('')
    onClose()
  }

  async function remove() {
    if (deleting || !matches) return
    setDeleting(true)
    setError('')
    try {
      await api('/api/me', { method: 'DELETE', json: { confirm: typed } })
    } catch (err) {
      setError(errorText(err))
      setDeleting(false)
      return
    }
    // Акаунт уже знеособлено на сервері, сесії й пристрої для push
    // відкликані — лишилось прибрати сліди на пристрої. Вихід перекине на
    // екран входу.
    forgetPush()
    await authClient.signOut().catch(() => {})
    queryClient.clear()
    Alert.alert('Акаунт видалено', 'Дякуємо, що були з нами.')
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center bg-black/50 px-5"
      >
        <Pressable
          className="absolute inset-0"
          onPress={close}
          accessibilityLabel="Закрити"
        />
        <View
          className="w-full max-w-[420px] gap-4 rounded-[26px] bg-card p-5"
          style={{ borderCurve: 'continuous' }}
        >
          <View className="gap-2">
            <Text className="text-[19px] font-bold text-foreground">
              Видалити акаунт назавжди?
            </Text>
            <Text className="text-[14.5px] leading-[20px] text-muted-foreground">
              Зникнуть імʼя, фото, профіль і способи входу, відкриті заявки й
              пропозиції буде скасовано. Завершені замовлення, листування й
              відгуки лишаться в інших людей під іменем «Видалений акаунт».
              Відновити акаунт не вийде.
            </Text>
          </View>

          <View className="gap-2">
            <Text className="text-[14px] text-muted-foreground">
              Щоб підтвердити, введіть свою пошту{' '}
              <Text className="font-semibold text-foreground">{email}</Text>
            </Text>
            <TextInput
              value={typed}
              onChangeText={(t) => {
                setTyped(t)
                setError('')
              }}
              editable={!deleting}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              keyboardType="email-address"
              placeholder={email}
              placeholderTextColor={c.mutedForeground}
              className="h-[50px] rounded-[14px] bg-secondary px-4 text-[16px] text-foreground"
            />
            {error ? (
              <Text className="text-[13px] text-destructive">{error}</Text>
            ) : null}
          </View>

          <View className="flex-row gap-3">
            <Button
              variant="secondary"
              onPress={close}
              disabled={deleting}
              className="flex-1"
            >
              Скасувати
            </Button>
            <Pressable
              onPress={remove}
              disabled={!matches || deleting}
              accessibilityRole="button"
              accessibilityState={{
                disabled: !matches || deleting,
                busy: deleting,
              }}
              className={`h-[50px] flex-1 items-center justify-center rounded-[14px] bg-destructive active:opacity-85 ${
                !matches || deleting ? 'opacity-45' : ''
              }`}
            >
              {deleting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-[16px] font-semibold text-white">
                  Видалити
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
