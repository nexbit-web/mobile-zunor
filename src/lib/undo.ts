import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'

/** Скільки є, щоб передумати, — потім дія остаточна. */
export const UNDO_MS = 5000

/** Що показує плашка «Скасувати» (components/undo-toast). */
export interface UndoOffer {
  /** Нова дія — нова плашка (й новий відлік). */
  key: number
  text: string
  /** Від низу екрана до плашки — над нижньою панеллю, якщо вона є. */
  bottom: number
  /** Коли дія стане остаточною (Date.now()). */
  until: number
}

type Pending = UndoOffer & { commit: () => void; undo: () => void }

let pending: Pending | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

/**
 * Дія з правом передумати — як «Чат видалено · Скасувати» в Telegram
 * (власник): на екрані її вже видно (рядок зник), а `commit` — сама
 * незворотна дія (запит на сервер) — іде лише за 5 с. «Скасувати» за цей
 * час — `undo` (повернути як було), і на сервер нічого не йде.
 *
 * Нова дія, поки висить попередня, робить попередню остаточною одразу —
 * плашка одна. Застосунок пішов у фон — теж: з фону таймер може й не
 * дочекатися.
 */
export function offerUndo(offer: {
  text: string
  bottom: number
  commit: () => void
  undo: () => void
}) {
  flushUndo()
  pending = { ...offer, key: ++seq, until: Date.now() + UNDO_MS }
  timer = setTimeout(flushUndo, UNDO_MS)
  emit()
}

/** Зробити дію остаточною зараз (час вийшов, нова дія, фон). */
export function flushUndo() {
  const p = pending
  if (!p) return
  clearTimeout(timer)
  pending = null
  emit()
  p.commit()
}

/** «Скасувати» — повернути як було, на сервер нічого не йде. */
export function cancelUndo() {
  const p = pending
  if (!p) return
  clearTimeout(timer)
  pending = null
  emit()
  p.undo()
}

AppState.addEventListener('change', (state) => {
  if (state === 'background') flushUndo()
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useUndoOffer(): UndoOffer | null {
  return useSyncExternalStore(subscribe, () => pending)
}
