import { useMemo, type ReactElement } from 'react'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import { useDrawerPan } from '@/lib/drawer-swipe'

/**
 * Горизонтальний список (перемикач розділів, стрічки Zunor), який
 * поступається свайпу бічної панелі: його прокрутка чекає, поки жест
 * панелі відмовиться (lib/drawer-swipe). Свайп управо з зони біля лівого
 * краю відкриває панель, навіть якщо палець потрапив на список чи картку
 * в ньому; уліво, вертикально чи поза зоною — жест панелі одразу
 * відмовляється, і список гортається як завжди.
 *
 * Без цього родна прокрутка iOS забирала свайп собі навіть на першому
 * розділі, де гортати вправо нікуди, — панель там майже не відкривалась.
 *
 * `children` — сам ScrollView (один нативний елемент). Без панелі
 * (майстер) — звичайна прокрутка.
 */
export function YieldToDrawer({ children }: { children: ReactElement }) {
  const pan = useDrawerPan()
  const gesture = useMemo(() => {
    const native = Gesture.Native()
    if (pan) native.requireExternalGestureToFail(pan)
    return native
  }, [pan])
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>
}
