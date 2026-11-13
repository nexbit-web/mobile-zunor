import { useEffect } from 'react'
import {
  Keyboard,
  Platform,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native'
import {
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

/** Відступ від кнопки дії до верху клавіатури, pt. */
export const KEYBOARD_GAP = 10
/** Крива клавіатури iOS (UIKit, крива 7) — наближення. */
const KEYBOARD_EASING = Easing.bezier(0.38, 0.7, 0.125, 1)

/**
 * Висота клавіатури, що їде разом із нею, — для розпірки під кнопкою
 * дії (екрани без акаунта, анкета). З подій клавіатури (iOS
 * keyboardWillChangeFrame: куди й за скільки поїде) — withTiming з тією
 * ж тривалістю й кривою. Не useAnimatedKeyboard: клавіатура виїжджає ще
 * під час появи екрана, і він віддавав одразу кінцеву висоту — кнопка
 * стрибала (власник помітив).
 *
 * Екран відкрили з уже відкритою клавіатурою (код → новий пароль) —
 * одразу поточна висота: фокус перейде в нове поле, і якщо висота та
 * сама, подій не буде зовсім. Підписка — в ефекті; поле, що кличе
 * клавіатуру одразу (`focusOnMount`), робить це кадром пізніше.
 */
export function useKeyboardHeight(): SharedValue<number> {
  const { height: screen } = useWindowDimensions()
  const keyboard = useSharedValue(0)

  useEffect(() => {
    const open = Keyboard.isVisible() ? Keyboard.metrics() : undefined
    if (open)
      keyboard.set(
        Platform.OS === 'ios'
          ? Math.max(0, screen - open.screenY)
          : open.height,
      )

    const follow = (to: number, e: KeyboardEvent) =>
      keyboard.set(
        withTiming(Math.max(0, to), {
          duration: e.duration || 250,
          easing: KEYBOARD_EASING,
        }),
      )
    const subs =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillChangeFrame', (e) =>
              follow(screen - e.endCoordinates.screenY, e),
            ),
            Keyboard.addListener('keyboardWillHide', (e) => follow(0, e)),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', (e) =>
              follow(e.endCoordinates.height, e),
            ),
            Keyboard.addListener('keyboardDidHide', (e) => follow(0, e)),
          ]
    return () => subs.forEach((sub) => sub.remove())
  }, [keyboard, screen])

  return keyboard
}
