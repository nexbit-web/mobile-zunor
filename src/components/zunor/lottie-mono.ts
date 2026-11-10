// Монохром для Lottie-знака Zunor — як `.lottie-mono` на сайті
// (web/src/routes/layout.css): біле тіло → колір тексту, чорне (очі) →
// колір фону. Колір із JSON інакше ігнорував би тему.

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const m = hex.replace('#', '')
  const full =
    m.length === 3
      ? m
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : m.slice(0, 6)
  const n = parseInt(full, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Копія анімації з заливками в кольорах теми (`fg`, `bg` — hex). */
export function recolorMono<T>(animation: T, fg: string, bg: string): T {
  const front = hexToRgb(fg)
  const back = hexToRgb(bg)
  const copy = JSON.parse(JSON.stringify(animation)) as T
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) return o.forEach(walk)
    if (!o || typeof o !== 'object') return
    const node = o as { ty?: string; c?: { k?: number[] } }
    if (node.ty === 'fl' && Array.isArray(node.c?.k)) {
      const [r, g, b, a = 1] = node.c.k
      node.c.k = r > 0.5 && g > 0.5 && b > 0.5 ? [...front, a] : [...back, a]
    }
    Object.values(node).forEach(walk)
  }
  walk(copy)
  return copy
}
