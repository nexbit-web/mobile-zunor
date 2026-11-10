import { ActionSheetIOS, Alert, Platform } from 'react-native'

export interface SheetAction {
  label: string
  destructive?: boolean
  onPress: () => void
}

/**
 * Вибір дії системним меню: на iOS — аркуш знизу (як «Змінити фото» в
 * Telegram), на Android — діалог. «Скасувати» додається сам.
 */
export function showActionSheet(title: string | undefined, actions: SheetAction[]) {
  if (Platform.OS === 'ios') {
    const labels = [...actions.map((a) => a.label), 'Скасувати']
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: actions.flatMap((a, i) =>
          a.destructive ? [i] : [],
        ),
      },
      (i) => actions[i]?.onPress(),
    )
    return
  }

  if (Platform.OS === 'web') {
    // dev у браузері: Alert з React Native там нічого не показує.
    const first = actions[0]
    if (first && window.confirm(first.label)) first.onPress()
    return
  }

  Alert.alert(
    title ?? '',
    undefined,
    [
      ...actions.map((a) => ({
        text: a.label,
        style: a.destructive ? ('destructive' as const) : ('default' as const),
        onPress: a.onPress,
      })),
      { text: 'Скасувати', style: 'cancel' as const },
    ],
    { cancelable: true },
  )
}
