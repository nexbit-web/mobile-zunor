import { Alert, Platform } from 'react-native'

/**
 * Питання «так / ні» системним діалогом. У браузері (dev) `Alert.alert`
 * з React Native нічого не показує — там звичайний `window.confirm`.
 */
export function confirmAction(
  title: string,
  options: {
    confirm: string
    destructive?: boolean
    /** Пояснення під заголовком: що станеться. */
    message?: string
    /** Кнопка «ні»; «Назад», коли дія сама — «Скасувати …». */
    cancel?: string
  },
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(
      window.confirm(options.message ? `${title}

${options.message}` : title),
    )
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      options.message,
      [
        {
          text: options.cancel ?? 'Скасувати',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: options.confirm,
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      // Android: тап повз діалог закриває його — це «ні».
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
}
