import { useRef, type ComponentRef, type RefObject } from 'react'
import type { TextInput } from 'react-native'

/** Скільки після надсилання зміни поля вважаємо «відкатом» клавіатури. */
const ECHO_MS = 400

/**
 * Порожнє поле після надсилання — хоч би що тримала клавіатура.
 *
 * iOS: поки клавіатура тримає «позначене» слово (підкреслене
 * автовиправлення, підказка, набір), просте `value = ''` вона не
 * приймає або за мить дописує слово назад — і надісланий текст лишався в
 * полі (власник). Тому:
 * - `reset()` (одразу після надсилання) чистить поле й нативно
 *   (`clear()`), а за мить — ще раз, коли клавіатура вже віддала слово;
 * - `isEcho(value)` — на початку `onChangeText`: зміна в перші ~400 мс
 *   після надсилання — це той «відкат», її відкидаємо й чистимо знову.
 *   Свою літеру за цей час людина надрукувати не встигає.
 */
export function useInputReset(
  inputRef: RefObject<ComponentRef<typeof TextInput> | null>,
) {
  const sentAt = useRef(0)

  function reset() {
    sentAt.current = Date.now()
    inputRef.current?.clear()
    setTimeout(() => inputRef.current?.clear(), 120)
  }

  function isEcho(value: string): boolean {
    if (!value || Date.now() - sentAt.current > ECHO_MS) return false
    inputRef.current?.clear()
    return true
  }

  return { reset, isEcho }
}
