import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

/**
 * Чи відкрита клавіатура. Поки вона є, відступ під смужку «додому» під
 * полем вводу не потрібен — інакше між полем і клавіатурою порожня смуга.
 * На iOS — «will» (разом з анімацією), на Android таких подій немає.
 */
export function useKeyboardShown(): boolean {
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
