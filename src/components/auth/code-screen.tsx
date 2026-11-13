import * as Haptics from 'expo-haptics'
import { router, type Href } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'

import { AuthScreen } from '@/components/auth/auth-screen'
import { CodeInput } from '@/components/auth/code-input'
import { Glyph } from '@/components/icons/glyph'
import { useColors } from '@/lib/theme'

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 60

/** Відповідь better-auth: помилка або `null`. */
type AuthCall = Promise<{
  error: { code?: string; status?: number } | null
}>

/**
 * Екран коду з листа — один на підтвердження пошти (`verify-email`) і
 * відновлення пароля (`reset-code`), як на сайті (otp-form): «Ми надіслали
 * код на …», шість клітинок, кнопки «Підтвердити» немає — шоста цифра й
 * є «готово». Що робити з кодом, вирішує екран: `check` питає сервер,
 * `onVerified` веде далі (немає — сесію дала сама перевірка, і корінь
 * відкриє застосунок).
 *
 * Невірний — клітинки червоні й порожні, вібрація, «Невірний або
 * застарілий код»; пʼять промахів чи код сплив — «Запросіть новий», і
 * «Надіслати ще раз» доступна одразу. Інакше вона — через 60 с (код уже
 * щойно пішов). Місце під статус — завжди, щоб посилання нижче не
 * стрибали. «Інша пошта» — назад, туди, де пошту вводили.
 *
 * `ifExists` — відновлення пароля: сервер не каже, чи є акаунт із такою
 * поштою (інакше перебором збирали б, хто зареєстрований), тож і ми
 * пишемо «якщо існує», як сайт.
 */
export function CodeScreen({
  title,
  email,
  ifExists = false,
  check,
  onVerified,
  resend,
  back,
}: {
  title: string
  email: string
  ifExists?: boolean
  check: (otp: string) => AuthCall
  onVerified?: (otp: string) => void
  resend: () => AuthCall
  /** «Інша пошта», коли повертатись нікуди. */
  back: Href
}) {
  const c = useColors()
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function verify(otp: string) {
    if (verifying) return
    setVerifying(true)
    setError(null)
    setNote(null)
    try {
      const { error: failed } = await check(otp)
      if (!failed) {
        onVerified?.(otp)
        return
      }
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      if (failed.code === 'TOO_MANY_ATTEMPTS') {
        setError('Забагато спроб. Запросіть новий код')
        setCooldown(0)
      } else if (failed.code === 'OTP_EXPIRED') {
        setError('Код застарів. Запросіть новий')
        setCooldown(0)
      } else if (failed.code === 'USER_ALREADY_EXISTS') {
        // Реєстрація: поки вводили код, акаунт зʼявився іншим шляхом (Google).
        setError('Акаунт із цією поштою вже є. Увійдіть')
      } else if (failed.status === 429) {
        setError('Забагато запитів. Спробуйте за хвилину')
      } else {
        setError('Невірний або застарілий код')
      }
      setCode('')
    } catch {
      setError('Немає зʼєднання з сервером. Перевірте інтернет.')
    } finally {
      setVerifying(false)
    }
  }

  async function sendAgain() {
    if (resending || cooldown > 0) return
    setResending(true)
    setError(null)
    setNote(null)
    try {
      const { error: failed } = await resend()
      if (failed) {
        setError(
          failed.status === 429
            ? 'Забагато запитів. Зачекайте трохи'
            : 'Не вдалося надіслати код',
        )
        return
      }
      setCode('')
      setCooldown(RESEND_COOLDOWN)
      setNote('Новий код надіслано')
    } catch {
      setError('Немає зʼєднання з сервером. Перевірте інтернет.')
    } finally {
      setResending(false)
    }
  }

  const timer = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`
  const address = <Text className="font-semibold text-foreground">{email}</Text>

  return (
    <AuthScreen
      title={title}
      subtitle={
        <Text className="text-center text-[16px] leading-[22px] text-muted-foreground">
          {ifExists ? (
            <>
              Якщо акаунт із поштою {address} існує, ми надіслали на неї код.
              Лист міг потрапити в «Спам».
            </>
          ) : (
            <>Ми надіслали код на {address}. Введіть його, щоб продовжити.</>
          )}
        </Text>
      }
    >
      <CodeInput
        value={code}
        length={CODE_LENGTH}
        invalid={!!error}
        disabled={verifying}
        onChange={(next) => {
          setCode(next)
          if (error) setError(null)
          if (next.length === CODE_LENGTH) void verify(next)
        }}
      />

      {/* Статус — місце є завжди: поява помилки не зсуває посилання. */}
      <View className="min-h-5 items-center justify-center">
        {verifying ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color={c.mutedForeground} />
            <Text className="text-[14px] text-muted-foreground">
              Перевіряємо…
            </Text>
          </View>
        ) : error ? (
          <View
            accessibilityLiveRegion="polite"
            className="flex-row items-center gap-1.5"
          >
            <Glyph name="alert" size={15} color={c.destructive} />
            <Text className="text-[14px] text-destructive">{error}</Text>
          </View>
        ) : note ? (
          <Text className="text-[14px] text-muted-foreground">{note}</Text>
        ) : null}
      </View>

      <View className="items-center gap-1">
        <Pressable
          onPress={sendAgain}
          disabled={cooldown > 0 || resending}
          className="py-1.5 active:opacity-60"
        >
          <Text
            className={`text-[16px] font-semibold ${
              cooldown > 0 ? 'text-muted-foreground' : 'text-foreground'
            }`}
          >
            {cooldown > 0
              ? `Надіслати ще раз через ${timer}`
              : resending
                ? 'Надсилаємо…'
                : 'Надіслати код ще раз'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace(back)
          }
          className="py-1.5 active:opacity-60"
        >
          <Text className="text-[15px] text-muted-foreground">Інша пошта</Text>
        </Pressable>
      </View>
    </AuthScreen>
  )
}
