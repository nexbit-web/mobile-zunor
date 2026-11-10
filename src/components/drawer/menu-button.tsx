import { useNavigation } from 'expo-router'

import { RoundButton } from '@/components/ui/round-button'

/**
 * Кнопка бічної панелі клієнта. Без крапки непрочитаного: сповіщення —
 * дзвіночком праворуч у тій самій шапці (HeaderBell).
 */
export function MenuButton() {
  const navigation = useNavigation()
  return (
    <RoundButton
      icon="menu"
      label="Меню"
      // Дія спливає до найближчого навігатора-панелі (так робить і
      // DrawerToggleButton).
      onPress={() => navigation.dispatch({ type: 'OPEN_DRAWER' })}
    />
  )
}
