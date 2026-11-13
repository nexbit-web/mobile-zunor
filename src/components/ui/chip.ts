import { useColorScheme } from 'react-native'

/**
 * Підкладка кнопок шапки (RoundButton, HeaderPill) і поля пошуку в чатах:
 * колір `chip` і чітка грань `chip-edge` (global.css).
 */
export const CHIP = 'border border-chip-edge bg-chip'

/**
 * Тінь — лише у світлій темі: біле коло на білому тлі видно за гранню й
 * тінню, а не за сірою заливкою (сіра з напівпрозорим контуром виглядала
 * «брудно»). Тінь тісна, коротка — край кнопки лишається чітким. У темній
 * коло й так світліше за фон.
 */
const LIGHT_SHADOW =
  '0 1px 2px rgba(0, 0, 0, 0.07), 0 2px 8px rgba(0, 0, 0, 0.06)'

export function useChipShadow(): string | undefined {
  return useColorScheme() === 'dark' ? undefined : LIGHT_SHADOW
}
