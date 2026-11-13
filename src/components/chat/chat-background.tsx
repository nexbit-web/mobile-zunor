import {
  AlphaType,
  BlendMode,
  Canvas,
  ColorType,
  FilterMode,
  Group,
  Image,
  ImageSVG,
  MipmapMode,
  Skia,
  type SkImage,
  type SkSVG,
} from '@shopify/react-native-skia'
import { useMemo, useState } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'

import { CHAT_PATTERN_SVG } from './chat-pattern'

/** Власний розмір узору сайту (width/height у самому SVG). */
const SVG_W = 1440
const SVG_H = 2960
/** Ширина плитки — узор дрібніший, ніж на компʼютері (там 540). */
const TILE = 460
/**
 * Skia малює SVG у ЙОГО розмірі (1440 px), а не в прямокутнику ImageSVG —
 * без масштабу узор виходив утричі більшим і «жирним». Тому плитку
 * зменшуємо самі.
 */
const SCALE = TILE / SVG_W

/**
 * Узор розбираємо один раз на весь застосунок (Skia, нативно): ні
 * завантаження файлу, ні растеризації SVG у картинку — тому шпалери стоять
 * із першого кадру (через expo-image узор зʼявлявся із затримкою).
 */
let svg: SkSVG | null | undefined
function pattern(): SkSVG | null {
  if (svg === undefined) svg = Skia.SVG.MakeFromString(CHAT_PATTERN_SVG)
  return svg
}

// ─── Градієнти шпалер ───
// Копія drawMesh з web/src/lib/components/chat/chat-background.svelte:
// чотири кольори Telegram (--mesh-1…4) у своїх точках, зважування за
// відстанню з легким закрученням. Канва 50 × 50, плавність дає
// розтягування з лінійною вибіркою — як і в браузері.

const MESH_SIZE = 50
/** Світла тема — тло: зеленуватий градієнт Telegram (як на сайті). */
const MESH_LIGHT = ['#dbddbb', '#6ba587', '#d5d88d', '#88b884']
/**
 * Темна тема — колір САМОГО узору, як у темних шпалерах Telegram
 * (скриншот власника): унизу праворуч рожевий, унизу ліворуч синій,
 * угорі ліворуч фіолетовий, угорі праворуч персиковий — приглушено це
 * фіолетово-цегляні лінії на темному. Не залежить від акценту.
 * Порядок — як у MESH_POINTS.
 */
const MESH_DARK = ['#dd6cb9', '#4f5bd5', '#962fbf', '#fec496']
const MESH_POINTS = [
  { x: 0.8, y: 0.9 },
  { x: 0.35, y: 0.75 },
  { x: 0.2, y: 0.1 },
  { x: 0.65, y: 0.25 },
]

const meshes = new Map<string, SkImage | null>()
function meshImage(colors: string[]): SkImage | null {
  const key = colors.join()
  const cached = meshes.get(key)
  if (cached !== undefined) return cached
  const rgb = colors.map((hex) => {
    const n = Number.parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  })
  const px = new Uint8Array(MESH_SIZE * MESH_SIZE * 4)
  let o = 0
  for (let y = 0; y < MESH_SIZE; y++) {
    const dy0 = y / MESH_SIZE - 0.5
    for (let x = 0; x < MESH_SIZE; x++) {
      const dx0 = x / MESH_SIZE - 0.5
      const radius = Math.sqrt(dx0 * dx0 + dy0 * dy0)
      const swirl = 0.35 * radius
      const theta = swirl * swirl * 6.4
      const sin = Math.sin(theta)
      const cos = Math.cos(theta)
      const sx = Math.min(1, Math.max(0, 0.5 + dx0 * cos - dy0 * sin))
      const sy = Math.min(1, Math.max(0, 0.5 + dx0 * sin + dy0 * cos))
      let total = 0
      let r = 0
      let g = 0
      let b = 0
      for (let i = 0; i < MESH_POINTS.length; i++) {
        const dx = sx - MESH_POINTS[i].x
        const dy = sy - MESH_POINTS[i].y
        const base = Math.max(0, 0.9 - Math.sqrt(dx * dx + dy * dy))
        const w = base * base * base * base
        total += w
        r += w * rgb[i][0]
        g += w * rgb[i][1]
        b += w * rgb[i][2]
      }
      px[o++] = Math.round(r / total)
      px[o++] = Math.round(g / total)
      px[o++] = Math.round(b / total)
      px[o++] = 255
    }
  }
  const mesh = Skia.Image.MakeImage(
    {
      width: MESH_SIZE,
      height: MESH_SIZE,
      alphaType: AlphaType.Opaque,
      colorType: ColorType.RGBA_8888,
    },
    Skia.Data.fromBytes(px),
    MESH_SIZE * 4,
  )
  meshes.set(key, mesh)
  return mesh
}

/**
 * Темна тема: прозорість узору (MESH_DARK) — приглушено, щоб шпалери не
 * сперечались із бульбашками, але колір видно, як у Telegram.
 */
const PATTERN_DARK_ALPHA = 0.38

/** Узор у шарі «soft-light 50%» — як `mix-blend-mode` на сайті. */
let softLight: ReturnType<typeof Skia.Paint> | undefined
function softLightPaint() {
  if (!softLight) {
    softLight = Skia.Paint()
    softLight.setBlendMode(BlendMode.SoftLight)
    softLight.setAlphaf(0.5)
  }
  return softLight
}

/**
 * Шпалери розмови, як у Telegram і на сайті (chat-background.svelte):
 * - світла тема — зеленуватий градієнт Telegram, узор поверх нього в
 *   режимі soft-light (лінії однаково темнішають і на жовтому, і на
 *   зеленому);
 * - темна — тло сторінки як є, а САМ узор пофарбований градієнтом, як у
 *   темних шпалерах Telegram (MESH_DARK: фіолетовий, синій, рожевий,
 *   персиковий; власник), приглушено (`PATTERN_DARK_ALPHA`). Від акценту
 *   не залежить — раніше узор був рівно кольору акценту.
 *
 * Малює Skia (Canvas). У браузері (dev) — chat-background.web.tsx.
 */
export function ChatBackground() {
  const dark = useColorScheme() === 'dark'
  const [size, setSize] = useState({ width: 0, height: 0 })
  const svgDoc = pattern()

  const tiles = useMemo(() => {
    const tileH = SVG_H * SCALE
    const cols = Math.max(1, Math.ceil(size.width / TILE))
    const rows = Math.max(1, Math.ceil(size.height / tileH))
    return Array.from({ length: rows * cols }, (_, i) => ({
      x: (i % cols) * TILE,
      y: Math.floor(i / cols) * tileH,
    }))
  }, [size])

  const { width, height } = size
  const ready = width > 0 && height > 0 && svgDoc

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) =>
        setSize({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ready ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {dark ? (
            // Узор — у своєму шарі; градієнт поверх у режимі srcIn фарбує
            // лише лінії, тло лишається чистим.
            <Group layer>
              {tiles.map((t, i) => (
                <Group
                  key={i}
                  transform={[
                    { translateX: t.x },
                    { translateY: t.y },
                    { scale: SCALE },
                  ]}
                >
                  <ImageSVG svg={svgDoc} x={0} y={0} width={SVG_W} height={SVG_H} />
                </Group>
              ))}
              <Image
                image={meshImage(MESH_DARK)}
                x={0}
                y={0}
                width={width}
                height={height}
                fit="fill"
                sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.None }}
                blendMode="srcIn"
                opacity={PATTERN_DARK_ALPHA}
              />
            </Group>
          ) : (
            <>
              <Image
                image={meshImage(MESH_LIGHT)}
                x={0}
                y={0}
                width={width}
                height={height}
                fit="fill"
                sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.None }}
              />
              <Group layer={softLightPaint()}>
                {tiles.map((t, i) => (
                  <Group
                    key={i}
                    transform={[
                      { translateX: t.x },
                      { translateY: t.y },
                      { scale: SCALE },
                    ]}
                  >
                    <ImageSVG svg={svgDoc} x={0} y={0} width={SVG_W} height={SVG_H} />
                  </Group>
                ))}
              </Group>
            </>
          )}
        </Canvas>
      ) : null}
    </View>
  )
}
